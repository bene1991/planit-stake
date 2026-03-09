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
  userId?: string
): Promise<boolean> {
  const maxRetries = 2;
  const emoji = resultType === 'green' ? '✅' : '❌';
  const label = resultType === 'green' ? 'GREEN' : 'RED';
  const marketLabel = market === 'goal_ht' ? 'Gol no 1T' : 'Over 1.5';

  const msg = `${emoji} <b>ROBÔ: ${label}!</b>\n\n⚽ <b>${homeTeam} vs ${awayTeam}</b>\n🏆 ${leagueName}\n📊 Mercado: <b>${marketLabel}</b>\n🎯 Filtro: ${variationName}\n🏁 Placar: <b>${finalScore}</b>`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 500;
        console.log(`[Resolver] Telegram retry ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }

      // Get user settings for this specific owner
      const { data: settings } = await supabase
        .from('settings')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('owner_id', userId)
        .not('telegram_bot_token', 'is', null)
        .not('telegram_chat_id', 'is', null)
        .single();

      if (!settings?.telegram_bot_token || !settings?.telegram_chat_id) {
        console.log(`[Resolver] Skipping Telegram for owner ${userId} (Not configured)`);
        return true;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY
        },
        body: JSON.stringify({
          userId,
          message: msg,
          title: 'Resultado',
          type: 'alert'
        }),
      });

      if (response.ok) return true;

      const errorText = await response.text();
      console.error(`[Resolver] Telegram attempt ${attempt} failed:`, errorText);

      if (response.status === 401) return false;

    } catch (err) {
      console.error(`[Resolver] Telegram attempt ${attempt} catch error:`, err);
    }
  }
  return false;
}
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get('Authorization');
  const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  const isAnon = authHeader === `Bearer ${SUPABASE_ANON_KEY}`;

  if (!isServiceRole && !isAnon) {
    const hasServiceRole = authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY);
    const hasAnon = authHeader?.includes(SUPABASE_ANON_KEY);
    // Also allow the legacy JWT anon key token that was hardcoded in pg_cron 
    const legacyAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E';
    const hasLegacyAnon = authHeader?.includes(legacyAnonKey);

    if (!hasServiceRole && !hasAnon && !hasLegacyAnon) {
      console.error('[Auth] Unauthorized request to live-alerts-resolver');
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        authReceived: authHeader ? 'present' : 'missing'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    console.log('Starting Live Alerts Resolver...');

    const { data: pendingAlerts, error: fetchErr } = await supabase
      .from('live_alerts')
      .select('*, robot_variations(send_telegram)')
      .or([
        'goal_ht_result.eq.pending',
        'over15_result.eq.pending',
        'final_score.is.null',
        'goal_events.is.null'
      ].join(','))
      .limit(200);

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
        const isMatchFinished = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(statusStr);

        const alertsToUpdate = pendingAlerts.filter((a: any) => a.fixture_id === fixtureId);
        const notifiedGroups = new Set<string>();
        const groupKey = (market: string, res: string) => `${market}_${res}`;

        for (const alert of alertsToUpdate) {
          const updates: any = { updated_at: new Date().toISOString() };
          let hasUpdate = false;

          // Resolve Goal HT
          if (alert.goal_ht_result === 'pending') {
            const hasHtGoal = htGoals > 0;
            const shouldResolveHt = hasHtGoal || isHtFinished;

            if (shouldResolveHt) {
              const result = hasHtGoal ? 'green' : 'red';
              const htScore = `${fixtureObj.score.halftime.home ?? 0}x${fixtureObj.score.halftime.away ?? 0} (HT)`;
              const sendTelegramEnabled = alert.robot_variations?.send_telegram !== false;
              const gKey = groupKey('ht', result);

              if (sendTelegramEnabled && !notifiedGroups.has(gKey)) {
                // ATOMIC LOCK
                const alertKey = `alert_ht_${alert.id}_${result}`;
                const { data: isNewAlert } = await supabase.rpc('mark_alert_resolved_atomically', {
                  p_alert_id: alert.id, p_market_key: alertKey, p_fixture_id: String(fixtureId), p_owner_id: alert.owner_id
                });

                if (isNewAlert) {
                  // Find other alerts for same fixture/result to group names
                  const sameResultAlerts = alertsToUpdate.filter(a =>
                    a.id !== alert.id &&
                    a.goal_ht_result === 'pending' &&
                    a.robot_variations?.send_telegram !== false
                  );
                  const names = [alert.variation_name || 'Padrão', ...sameResultAlerts.map(a => a.variation_name || 'Padrão')].join(', ');

                  const sent = await sendTelegramResult(
                    supabase,
                    alert.home_team, alert.away_team,
                    alert.league_name || '', names,
                    result as 'green' | 'red', 'goal_ht', htScore,
                    alert.owner_id
                  );

                  if (!sent) {
                    await supabase.from('sent_notifications').delete().match({ owner_id: alert.owner_id, fixture_id: String(fixtureId), event_key: alertKey });
                  } else {
                    updates.goal_ht_result = result;
                    hasUpdate = true;
                    notifiedGroups.add(gKey);
                  }
                }
              } else {
                updates.goal_ht_result = result;
                hasUpdate = true;
              }
            }
          }

          // Resolve Over 1.5
          if (alert.over15_result === 'pending') {
            const hasTwoGoals = totalGoals >= 2;
            const shouldResolveO15 = hasTwoGoals || isMatchFinished;

            if (shouldResolveO15) {
              const result = hasTwoGoals ? 'green' : 'red';
              const fs = `${fixtureObj.goals.home ?? 0}x${fixtureObj.goals.away ?? 0}`;
              const sendTelegramEnabled = alert.robot_variations?.send_telegram !== false;
              const gKey = groupKey('o15', result);

              if (sendTelegramEnabled && !notifiedGroups.has(gKey)) {
                // ATOMIC LOCK
                const alertKey = `alert_o15_${alert.id}_${result}`;
                const { data: isNewAlert } = await supabase.rpc('mark_alert_resolved_atomically', {
                  p_alert_id: alert.id, p_market_key: alertKey, p_fixture_id: String(fixtureId), p_owner_id: alert.owner_id
                });

                if (isNewAlert) {
                  const sameResultAlerts = alertsToUpdate.filter(a =>
                    a.id !== alert.id &&
                    a.over15_result === 'pending' &&
                    a.robot_variations?.send_telegram !== false
                  );
                  const names = [alert.variation_name || 'Padrão', ...sameResultAlerts.map(a => a.variation_name || 'Padrão')].join(', ');

                  const sent = await sendTelegramResult(
                    supabase,
                    alert.home_team, alert.away_team,
                    alert.league_name || '', names,
                    result as 'green' | 'red', 'over15', fs,
                    alert.owner_id
                  );

                  if (!sent) {
                    await supabase.from('sent_notifications').delete().match({ owner_id: alert.owner_id, fixture_id: String(fixtureId), event_key: alertKey });
                  } else {
                    updates.over15_result = result;
                    updates.final_score = fs;
                    hasUpdate = true;
                    notifiedGroups.add(gKey);
                  }
                }
              } else {
                updates.over15_result = result;
                updates.final_score = fs;
                hasUpdate = true;
              }
            }
          }

          // Always sync current score so the UI reflects live/final score
          const currentScore = `${fixtureObj.goals.home ?? 0}x${fixtureObj.goals.away ?? 0}`;
          if (alert.final_score !== currentScore) {
            updates.final_score = currentScore;
            hasUpdate = true;
          }

          // Sync Goal Events when match is finished
          if (isMatchFinished && (!alert.goal_events || (Array.isArray(alert.goal_events) && alert.goal_events.length === 0))) {
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

          // Auto-discard if everything is resolved to keep the radar clean
          const finalHt = updates.goal_ht_result || alert.goal_ht_result;
          const finalO15 = updates.over15_result || alert.over15_result;
          if (finalHt !== 'pending' && finalO15 !== 'pending' && !alert.is_discarded) {
            updates.is_discarded = true;
            hasUpdate = true;
            console.log(`[Resolver] Auto-discarding resolved alert ${alert.id}`);
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
