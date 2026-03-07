import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';


async function callApiFootball(endpoint: string, token: string, params: Record<string, unknown> = {}) {
  // Add artificial delay to avoid Supabase Edge Function rate limits (bursts)
  await new Promise(r => setTimeout(r, 50));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/api-football`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
    },
    body: JSON.stringify({ endpoint, ...params }),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'No body');
    console.error(`[Resolver] API call failed: ${res.status} ${res.statusText}`, errorText);
    throw new Error(`API error: ${res.status} - ${errorText.substring(0, 100)}`);
  }
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
  const apiKeyHeader = req.headers.get('apikey');

  const isServiceRole = authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY) || apiKeyHeader === SUPABASE_SERVICE_ROLE_KEY;
  const isAnon = authHeader?.includes(SUPABASE_ANON_KEY) || apiKeyHeader === SUPABASE_ANON_KEY;
  const legacyAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E';
  const hasLegacyAnon = authHeader?.includes(legacyAnonKey) || apiKeyHeader === legacyAnonKey;

  if (!isServiceRole && !isAnon && !hasLegacyAnon) {
    console.error('[Auth] Unauthorized request to live-alerts-resolver');
    console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('Starting Live Alerts Resolver...');

    const { data: pendingAlerts, error: fetchErr } = await supabase
      .from('live_alerts')
      .select('*, robot_variations(send_telegram)')
      .or('goal_ht_result.eq.pending,over15_result.eq.pending,final_score.is.null')
      .order('created_at', { ascending: true })
      .limit(100);

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
        console.log(`[Resolver] Fetching data for Fixture ${fixtureId}...`);
        const data = await callApiFootball(`fixtures?id=${fixtureId}`, SUPABASE_SERVICE_ROLE_KEY);
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

            // Send Telegram result (Fire and forget, don't block DB update)
            if (alert.robot_variations?.send_telegram !== false) {
              sendTelegramResult(
                supabase,
                alert.home_team, alert.away_team,
                alert.league_name || '', alert.variation_name || 'Padrão',
                result as 'green' | 'red', 'goal_ht', htScore,
              ).catch(err => console.error(`[Resolver] Telegram Goal HT failed for alert ${alert.id}:`, err));
            } else {
              console.log(`[Resolver] Skipping Telegram Goal HT for ${alert.home_team} (Filter ${alert.variation_name} disabled)`);
            }

            updates.goal_ht_result = result;
            hasUpdate = true;
          }

          // Resolve Over 1.5
          if (alert.over15_result === 'pending' && isMatchFinished) {
            const result = totalGoals >= 2 ? 'green' : 'red';
            const fs = `${fixtureObj.goals.home}x${fixtureObj.goals.away}`;

            // Send Telegram result (Fire and forget, don't block DB update)
            if (alert.robot_variations?.send_telegram !== false) {
              sendTelegramResult(
                supabase,
                alert.home_team, alert.away_team,
                alert.league_name || '', alert.variation_name || 'Padrão',
                result as 'green' | 'red', 'over15', fs,
              ).catch(err => console.error(`[Resolver] Telegram Over 1.5 failed for alert ${alert.id}:`, err));
            } else {
              console.log(`[Resolver] Skipping Telegram Over 1.5 for ${alert.home_team} (Filter ${alert.variation_name} disabled)`);
            }

            updates.over15_result = result;
            updates.final_score = fs;
            hasUpdate = true;
          }

          // Incremental Goal Events and Real-time Telegram Notifications
          const currentEvents = Array.isArray(alert.goal_events) ? alert.goal_events : [];
          if (totalGoals > currentEvents.length && fixtureObj.events) {
            const apiGoalEvents = fixtureObj.events
              .filter((e: any) => e.type === 'Goal' && e.detail !== 'Missed Penalty')
              .map((e: any) => ({
                minute: e.time.elapsed,
                extra: e.time.extra,
                team: e.team?.name,
                player: e.player?.name,
                detail: e.detail
              }));

            if (apiGoalEvents.length > currentEvents.length) {
              // Find new events by comparing minute and player
              const newEvents = apiGoalEvents.filter((ae: any) =>
                !currentEvents.some((ce: any) => ce.minute === ae.minute && ce.player === ae.player)
              );

              if (newEvents.length > 0) {
                updates.goal_events = apiGoalEvents;
                updates.final_score = `${fixtureObj.goals.home}x${fixtureObj.goals.away}`;
                hasUpdate = true;
              }
            }
          }

          // Sync Final Score on match end if not already set
          if (isMatchFinished && !alert.final_score) {
            updates.final_score = `${fixtureObj.goals.home}x${fixtureObj.goals.away}`;
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
