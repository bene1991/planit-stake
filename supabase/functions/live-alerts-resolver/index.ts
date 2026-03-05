import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting Live Alerts Resolver...');

    const { data: pendingAlerts, error: fetchErr } = await supabase
      .from('live_alerts')
      .select('id, fixture_id, goal_ht_result, over15_result')
      .or('goal_ht_result.eq.pending,over15_result.eq.pending')
      .limit(50); // limit to avoid timeout

    if (fetchErr) throw fetchErr;
    if (!pendingAlerts || pendingAlerts.length === 0) {
      console.log('No pending alerts to resolve.');
      return new Response(JSON.stringify({ status: 'ok', resolved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const uniqueFixtureIds = [...new Set(pendingAlerts.map(a => a.fixture_id))];
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

        const alertsToUpdate = pendingAlerts.filter(a => a.fixture_id === fixtureId);

        for (const alert of alertsToUpdate) {
          const updates: any = { updated_at: new Date().toISOString() };
          let hasUpdate = false;

          if (alert.goal_ht_result === 'pending' && isHtFinished) {
            updates.goal_ht_result = htGoals > 0 ? 'green' : 'red';
            hasUpdate = true;
          }

          if (alert.over15_result === 'pending' && isMatchFinished) {
            const finalScore = `${fixtureObj.goals.home}x${fixtureObj.goals.away}`;
            if (totalGoals >= 2) {
              updates.over15_result = 'green';
              updates.final_score = finalScore;
              hasUpdate = true;
            } else {
              updates.over15_result = 'red';
              updates.final_score = finalScore;
              hasUpdate = true;
            }
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
  } catch (error) {
    console.error('Resolver Execution Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
