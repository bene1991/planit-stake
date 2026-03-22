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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const { data: pendingAlerts, error: fetchErr } = await supabase
      .from('live_alerts')
      .select('id, fixture_id, home_team, away_team, league_name, variation_name, variation_id, owner_id, goal_ht_result, over15_result, under25_result, final_score, goal_events')
      .or('goal_ht_result.eq.pending,over15_result.eq.pending,under25_result.eq.pending,final_score.is.null')
      .limit(50);

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

        const isHtFinished = ['HT', '2H', 'FT', 'AET', 'PEN'].includes(statusStr);
        const isMatchFinished = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(statusStr);

        const alertsToUpdate = pendingAlerts.filter((a: any) => a.fixture_id === fixtureId);
        for (const alert of alertsToUpdate) {
          const updates: any = { updated_at: new Date().toISOString() };
          let hasUpdate = false;

          // Always sync current score so the UI reflects live/final score
          const currentScore = `${fixtureObj.goals.home ?? 0}x${fixtureObj.goals.away ?? 0}`;
          if (alert.final_score !== currentScore) {
            updates.final_score = currentScore;
            hasUpdate = true;
          }

          // Helper to evaluate results for sub-columns (HT and Over 1.5)
          const resultHT = htGoals > 0 ? 'green' : 'red';
          const resultO15 = totalGoals >= 2 ? 'green' : 'red';

          if (alert.goal_ht_result === 'pending' && isHtFinished) {
            updates.goal_ht_result = resultHT;
            hasUpdate = true;
          }

          if (alert.over15_result === 'pending' && (totalGoals >= 2 || isMatchFinished)) {
            updates.over15_result = resultO15;
            hasUpdate = true;
          }

          // Also set the main 'status' column for general dashboard usage
          if (isMatchFinished && (!alert.status || alert.status === 'pending')) {
            // For HT bot, result is resultHT. For Over 1.5 bot, result is resultO15.
            // Simplified: if any green, or if match finished and not green, it's red.
            if (updates.goal_ht_result === 'green' || updates.over15_result === 'green') {
              updates.status = 'GREEN';
            } else if (isMatchFinished) {
              updates.status = 'RED';
            }
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

          // Auto-discard when match is finished
          if (isMatchFinished && !alert.is_discarded) {
            updates.is_discarded = true;
            if (!updates.status) updates.status = 'COMPLETED';
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
