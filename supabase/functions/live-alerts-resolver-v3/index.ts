import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const GS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbw9s_3Y5-qXTo_8p7S-F6lH-t1-h8p-q-P-s-s-R-r-T-E-L/exec';

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

async function syncToGoogleSheets(data: any) {
  try {
    await fetch(GS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error('[GS Sync Error]', err);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get('Authorization');
  console.log('[Resolver] DEBUG: Auth check bypassed');
  
  /*
  const legacyAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E';
  const publishableKey = 'sb_publishable_GCQsP9TJfcm19AIIDSlObw_OIrfwP7T';
  
  const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  const isAnon = authHeader === `Bearer ${SUPABASE_ANON_KEY}`;
  const isLegacyAnon = authHeader === `Bearer ${legacyAnonKey}`;
  const isPublishable = authHeader === `Bearer ${publishableKey}`;

  if (!isServiceRole && !isAnon && !isLegacyAnon && !isPublishable) {
    return new Response(JSON.stringify({ error: 'Unauthorized', details: 'Invalid auth header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  */

  try {
    const body = await req.json().catch(() => ({}));
    const manualFixtureIds = body.manual_fixture_ids ? body.manual_fixture_ids.map(String) : null;

    console.log('[Resolver] Starting. Manual IDs:', manualFixtureIds);
    if (body.fixture_ids && !manualFixtureIds) {
      console.warn('[Resolver] Received fixture_ids instead of manual_fixture_ids');
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // 1. Fetch Alerts - Use updated_at to ensure fair processing of the entire pool
    let alertsQuery = supabase
      .from('live_alerts')
      .select('id, fixture_id, home_team, away_team, league_name, variation_name, win_30_70, goal_ht_result, over15_result, under25_result, corners_at_alert, final_score, ht_score, goal_events, goal_events_captured, minute_at_alert, created_at, stats_snapshot')
      .gte('created_at', sevenDaysAgo);

    if (manualFixtureIds) {
      alertsQuery = alertsQuery.in('fixture_id', manualFixtureIds);
    } else {
      alertsQuery = alertsQuery.or('win_30_70.is.null,final_score.is.null,goal_events_captured.is.false,ht_score.is.null,goal_ht_result.eq.pending,over15_result.eq.pending,under25_result.eq.pending');
    }

    const { data: pendingAlerts, error: fetchErr } = await alertsQuery
      .order('updated_at', { ascending: true, nullsFirst: true })
      .limit(100);

    // 2. Fetch Active Games
    let gamesQuery = supabase
      .from('games')
      .select('api_fixture_id');
    
    if (manualFixtureIds) {
      gamesQuery = gamesQuery.in('api_fixture_id', manualFixtureIds);
    } else {
      gamesQuery = gamesQuery.in('status', ['Live', 'Pending']);
    }

    const { data: activeGames, error: gamesErr } = await gamesQuery;

    if (fetchErr) throw fetchErr;
    if (gamesErr) throw gamesErr;

    const alertFixtureIds = (pendingAlerts || []).map((a: any) => a.fixture_id);
    const gameFixtureIds = (activeGames || []).map((g: any) => g.api_fixture_id);
    const uniqueFixtureIds = [...new Set([...alertFixtureIds, ...gameFixtureIds])];

    if (uniqueFixtureIds.length === 0) {
      return new Response(JSON.stringify({ status: 'ok', resolved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let resolvedCount = 0;

    // Batch process API calls to prevent timeouts
    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueFixtureIds.length; i += BATCH_SIZE) {
      const batchIds = uniqueFixtureIds.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batchIds.map(async (fixtureId) => {
        try {
          const data = await callApiFootball(`fixtures?id=${fixtureId}`);
          const fixtureObj = data?.response?.[0];

          if (!fixtureObj) {
            // Eject fixtures that no longer exist in API after 24 hours
            const now = new Date();
            const alertsForThisFixture = pendingAlerts?.filter((a: any) => a.fixture_id === fixtureId) || [];
            
            for (const alert of alertsForThisFixture) {
              const alertDate = new Date(alert.created_at);
              const diffHours = (now.getTime() - alertDate.getTime()) / (1000 * 60 * 60);
              
              if (diffHours > 24) {
                console.log(`[Resolver] Ejecting orphaned fixture ${fixtureId} for alert ${alert.id} (>24h)`);
                await supabase.from('live_alerts').update({ 
                  goal_events_captured: true,
                  updated_at: new Date().toISOString() 
                }).eq('id', alert.id);
                resolvedCount++;
              }
            }
            return;
          }

          const statusStr = fixtureObj.fixture.status.short;
          const currentMinute = fixtureObj.fixture.status.elapsed || 0;
          const isHtFinished = ['HT', '2H', 'FT', 'AET', 'PEN'].includes(statusStr) || currentMinute > 45;
          const isMatchFinished = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(statusStr);

          const events = fixtureObj.events || [];
          const goals = events.filter((e: any) => e.type === 'Goal' && e.detail !== 'Missed Penalty');
          
          const goalInWindow = goals.some((g: any) => {
            const goalMin = g.time.elapsed + (g.time.extra || 0);
            return goalMin >= 30 && goalMin <= 70;
          });

          // Corner Extraction
          const stats = fixtureObj.statistics || [];
          let totalCorners = 0;
          stats.forEach((teamStats: any) => {
            const cornerStat = teamStats.statistics.find((s: any) => s.type === 'Corner Kicks');
            if (cornerStat && cornerStat.value !== null) {
              totalCorners += parseInt(cornerStat.value);
            }
          });

          // Sync with `games` table
          const currentHome = fixtureObj.goals.home ?? 0;
          const currentAway = fixtureObj.goals.away ?? 0;
          
          await supabase
            .from('games')
            .update({
              final_score_home: currentHome,
              final_score_away: currentAway,
              current_minute: currentMinute,
              status: isMatchFinished ? 'Finished' : 'Live',
              last_sync_at: new Date().toISOString()
            })
            .eq('api_fixture_id', fixtureId);

          const alertsToUpdate = pendingAlerts.filter((a: any) => a.fixture_id === fixtureId);

          for (const alert of alertsToUpdate) {
            const updates: any = { updated_at: new Date().toISOString() };
            let hasUpdate = false;

            if (goalInWindow && alert.win_30_70 === null) {
              updates.win_30_70 = true;
              hasUpdate = true;
            } else if (!goalInWindow && (currentMinute > 70 || isMatchFinished) && alert.win_30_70 === null) {
              updates.win_30_70 = false;
              hasUpdate = true;
            }

            // Resolution for HT, Over 1.5 and Under 2.5
            const htGoals = (fixtureObj.score.halftime.home || 0) + (fixtureObj.score.halftime.away || 0);
            const totalGoals = (fixtureObj.goals.home || 0) + (fixtureObj.goals.away || 0);

            // HT Goal Resolution: Green if goal in 1st half, Red if 1st half ends 0-0
            if (alert.goal_ht_result === 'pending') {
              if (htGoals > 0) {
                updates.goal_ht_result = 'green';
                hasUpdate = true;
              } else if (isHtFinished) {
                updates.goal_ht_result = 'red';
                hasUpdate = true;
              }
            }

            // Over 1.5 Resolution: Green if 2+ goals, Red if match ends with < 2 goals
            if (alert.over15_result === 'pending') {
              if (totalGoals >= 2) {
                updates.over15_result = 'green';
                hasUpdate = true;
              } else if (isMatchFinished) {
                updates.over15_result = 'red';
                hasUpdate = true;
              }
            }

            // Under 2.5 Resolution: Red if 3+ goals, Green if match ends with <= 2 goals
            if (alert.under25_result === 'pending') {
              if (totalGoals > 2) {
                updates.under25_result = 'red';
                hasUpdate = true;
              } else if (isMatchFinished) {
                updates.under25_result = 'green';
                hasUpdate = true;
              }
            }

            if (isHtFinished && !alert.ht_score) {
              updates.ht_score = `${fixtureObj.score.halftime.home || 0}x${fixtureObj.score.halftime.away || 0}`;
              hasUpdate = true;
            }

            const currentScore = `${fixtureObj.goals.home}x${fixtureObj.goals.away}`;
            if (alert.final_score !== currentScore) {
              updates.final_score = currentScore;
              hasUpdate = true;
            }

            const currentGoalsData = goals.map((g: any) => ({
              minute: g.time.elapsed,
              extra: g.time.extra,
              team: g.team?.name,
              player: g.player?.name,
              detail: g.detail
            }));

            const existingGoals = Array.isArray(alert.goal_events) ? alert.goal_events : [];
            if (JSON.stringify(currentGoalsData) !== JSON.stringify(existingGoals)) {
              updates.goal_events = currentGoalsData;
              hasUpdate = true;
            }

            if (isMatchFinished) {
              updates.goal_events_captured = true;
              hasUpdate = true;
            }

            if (hasUpdate) {
              const { error: updateErr } = await supabase
                .from('live_alerts')
                .update(updates)
                .eq('id', alert.id);

              if (!updateErr) {
                resolvedCount++;
                
                if (updates.win_30_70 !== undefined && updates.win_30_70 !== null) {
                  const goalList = goals.map((g: any) => `${g.time.elapsed}${g.time.extra ? '+' + g.time.extra : ''}'`).join(', ');
                  
                  await syncToGoogleSheets({
                    action: 'UPDATE_ALERT',
                    id: alert.id,
                    fixtureId: alert.fixture_id,
                    home: alert.home_team,
                    away: alert.away_team,
                    league: alert.league_name,
                    minute: alert.minute_at_alert,
                    variation: alert.variation_name || 'Geral',
                    result: updates.win_30_70 ? 'GREEN' : 'RED',
                    finalScore: updates.final_score || alert.final_score || `${fixtureObj.goals.home}x${fixtureObj.goals.away}`,
                    goalMinutes: goalList || '-',
                    attacksHome: alert.stats_snapshot?.fullMatch?.h?.attacks || 0,
                    attacksAway: alert.stats_snapshot?.fullMatch?.a?.attacks || 0,
                    timestamp: new Date().toISOString()
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error(`[Resolver] Fixture error ${fixtureId}:`, e);
        }
      }));
    }

    return new Response(JSON.stringify({ status: 'ok', resolved: resolvedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Resolver] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
