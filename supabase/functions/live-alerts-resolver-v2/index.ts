import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';


async function callApiFootball(endpoint: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/api-football`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function sendTelegramResult(
  supabase: any,
  homeTeam: string,
  awayTeam: string,
  leagueName: string,
  variationName: string,
  resultType: 'green' | 'red',
  market: string,
  finalScore: string,
): Promise<boolean> {
  try {
    // Get first user with telegram configured
    const { data: settings } = await supabase
      .from('settings')
      .select('telegram_bot_token, telegram_chat_id')
      .not('telegram_bot_token', 'is', null)
      .not('telegram_chat_id', 'is', null)
      .limit(1)
      .single();

    if (!settings?.telegram_bot_token || !settings?.telegram_chat_id) return true; // Pretend success if not configured yet

    const emoji = resultType === 'green' ? '✅' : '❌';
    const label = resultType === 'green' ? 'GREEN' : 'RED';
    const marketLabel = market === 'goal_ht' ? 'Gol no 1T' : 'Over 1.5';

    const msg = `${emoji} <b>ROBÔ: ${label}!</b>\n\n⚽ <b>${homeTeam} vs ${awayTeam}</b>\n🏆 ${leagueName}\n📊 Mercado: <b>${marketLabel}</b>\n🎯 Filtro: ${variationName}\n🏁 Placar: <b>${finalScore}</b>`;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        message: msg,
        title: 'Atenção',
        type: 'alert'
      }),
    });

    if (!response.ok) {
      console.error('[Resolver] Telegram target function failed:', await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Resolver] Telegram error:', err);
    return false;
  }
}
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get('Authorization');
  const isServiceRole = authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY);
  const isAnon = authHeader?.includes(SUPABASE_ANON_KEY);
  const legacyAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E';
  const hasLegacyAnon = authHeader?.includes(legacyAnonKey);

  if (!isServiceRole && !isAnon && !hasLegacyAnon) {
    console.error('[Auth] Unauthorized request to live-alerts-resolver');
    console.error(`Received auth format: ${authHeader ? 'present' : 'missing'}`);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('Starting Live Alerts Resolver...');

    const { data: pendingAlerts, error: fetchErr } = await supabase
      .from('live_alerts')
      .select('id, fixture_id, home_team, away_team, league_name, variation_name, goal_ht_result, over15_result, final_score, goal_events')
      .or('goal_ht_result.eq.pending,over15_result.eq.pending,final_score.is.null')
      .limit(50); // limit to avoid timeout

    if (fetchErr) throw fetchErr;
    if (!pendingAlerts || pendingAlerts.length === 0) {
      console.log('No pending alerts to resolve.');
      return new Response(JSON.stringify({ status: 'ok', resolved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const uniqueFixtureIds = [...new Set(pendingAlerts.map((a: any) => a.fixture_id))];
    console.log(`Processing ${pendingAlerts.length} alerts across ${uniqueFixtureIds.length} fixtures.`);

    let resolvedCount = 0;

    for (const fixtureId of uniqueFixtureIds) {
      try {
        const data = await callApiFootball(`fixtures?id=${fixtureId}`);
        const fixtureObj = data?.response?.[0];

        if (!fixtureObj) {
          console.log(`Fixture ${fixtureId} not found in API.`);
          continue;
        }

        const statusStr = fixtureObj.fixture.status.short; // FT, HT, PEN, AET, etc.
        const timeElapsed = fixtureObj.fixture.status.elapsed;
        // Goals at Half Time
        const htGoals = (fixtureObj.score.halftime.home || 0) + (fixtureObj.score.halftime.away || 0);
        // Total Goals
        const totalGoals = (fixtureObj.goals.home || 0) + (fixtureObj.goals.away || 0);

        const isHtFinished = ['HT', '2H', 'FT', 'AET', 'PEN'].includes(statusStr) || timeElapsed > 45;
        const isMatchFinished = ['FT', 'AET', 'PEN'].includes(statusStr);

        const alertsToUpdate = pendingAlerts.filter((a: any) => a.fixture_id === fixtureId);

        for (const alert of alertsToUpdate) {
          const updates: any = { updated_at: new Date().toISOString() };
          let hasUpdate = false;

          // Resolve Goal HT
          if (alert.goal_ht_result === 'pending' && isHtFinished) {
            const result = htGoals > 0 ? 'green' : 'red';
            const htScore = `${fixtureObj.score.halftime.home || 0}x${fixtureObj.score.halftime.away || 0} (HT)`;

            const sent = await sendTelegramResult(
              supabase,
              alert.home_team, alert.away_team,
              alert.league_name || '', alert.variation_name || 'Padrão',
              result as 'green' | 'red', 'goal_ht', htScore,
            );

            if (sent) {
              updates.goal_ht_result = result;
              hasUpdate = true;
            } else {
              console.log(`[Resolver] Retrying Goal HT result for alert ${alert.id} in next cycle due to notification failure`);
            }
          }

          // Resolve Over 1.5
          if (alert.over15_result === 'pending' && isMatchFinished) {
            const result = totalGoals >= 2 ? 'green' : 'red';
            const fs = `${fixtureObj.goals.home}x${fixtureObj.goals.away}`;

            const sent = await sendTelegramResult(
              supabase,
              alert.home_team, alert.away_team,
              alert.league_name || '', alert.variation_name || 'Padrão',
              result as 'green' | 'red', 'over15', fs,
            );

            if (sent) {
              updates.over15_result = result;
              updates.final_score = fs;
              hasUpdate = true;
            } else {
              console.log(`[Resolver] Retrying Over 1.5 result for alert ${alert.id} in next cycle due to notification failure`);
            }
          }

          // Sync Goal Events if match finished and missing (independent of notifications)
          if (isMatchFinished && (!alert.final_score || !alert.goal_events || (Array.isArray(alert.goal_events) && alert.goal_events.length === 0))) {
            const fs = `${fixtureObj.goals.home}x${fixtureObj.goals.away}`;
            if (!updates.final_score) updates.final_score = fs;

            if (totalGoals > 0 && fixtureObj.events) {
              const goalEvents = fixtureObj.events
                .filter((e: any) => e.type === 'Goal' && e.detail !== 'Missed Penalty')
                .map((e: any) => ({
                  minute: e.time.elapsed,
                  extra: e.time.extra,
                  team: e.team?.name,
                  player: e.player?.name,
                  detail: e.detail
                }));
              updates.goal_events = goalEvents;
            } else if (totalGoals === 0) {
              updates.goal_events = [];
            }
            hasUpdate = true;
          }

          if (hasUpdate) {
            const { error: updateErr } = await supabase
              .from('live_alerts')
              .update(updates)
              .eq('id', alert.id);

            if (updateErr) {
              console.error(`Error updating alert ${alert.id}:`, updateErr);
            } else {
              resolvedCount++;
              console.log(`Resolved Alert ${alert.id} - HT: ${updates.goal_ht_result || alert.goal_ht_result}, O1.5: ${updates.over15_result || alert.over15_result}`);
            }
          }
        }
      } catch (e) {
        console.error(`Error processing fixture ${fixtureId}:`, e);
      }
    }

    return new Response(JSON.stringify({ status: 'ok', resolved: resolvedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Resolver Execution Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
