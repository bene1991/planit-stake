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
  const legacyAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E';
  
  const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  const isAnon = authHeader === `Bearer ${SUPABASE_ANON_KEY}`;
  const isLegacyAnon = authHeader === `Bearer ${legacyAnonKey}`;

  if (!isServiceRole && !isAnon && !isLegacyAnon) {
    console.error('[Auth Error] Unauthorized request. Header:', authHeader?.substring(0, 20) + '...');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('[Resolver] Starting...');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: pendingAlerts, error: fetchErr } = await supabase
      .from('live_alerts')
      .select('id, fixture_id, home_team, away_team, league_name, variation_name, win_30_70, final_score, ht_score, goal_events, goal_events_captured, minute_at_alert, created_at, stats_snapshot')
      .or('win_30_70.is.null,final_score.is.null,goal_events_captured.is.false,ht_score.is.null')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(200);

    const { data: activeGames, error: gamesErr } = await supabase
      .from('games')
      .select('api_fixture_id')
      .in('status', ['Live', 'Pending']);

    if (fetchErr) throw fetchErr;
    if (gamesErr) throw gamesErr;

    const alertFixtureIds = (pendingAlerts || []).map((a: any) => a.fixture_id);
    const gameFixtureIds = (activeGames || []).map((g: any) => g.api_fixture_id);
    const uniqueFixtureIds = [...new Set([...alertFixtureIds, ...gameFixtureIds])];

    if (uniqueFixtureIds.length === 0) {
      return new Response(JSON.stringify({ status: 'ok', resolved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let resolvedCount = 0;

    for (const fixtureId of uniqueFixtureIds) {
      try {
        const data = await callApiFootball(`fixtures?id=${fixtureId}`);
        const fixtureObj = data?.response?.[0];

        if (!fixtureObj) continue;

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

        // Sync with `games` table (Dashboard/Planejamento)
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

          // 1. Resolve results based on 30-70 window
          if (goalInWindow && alert.win_30_70 === null) {
            updates.win_30_70 = true;
            hasUpdate = true;
          } else if (!goalInWindow && (currentMinute > 70 || isMatchFinished) && alert.win_30_70 === null) {
            updates.win_30_70 = false;
            hasUpdate = true;
          }

          // 2. Halftime Score
          if (isHtFinished && !alert.ht_score) {
            updates.ht_score = `${fixtureObj.score.halftime.home || 0}x${fixtureObj.score.halftime.away || 0}`;
            hasUpdate = true;
          }

          // 3. Score and Goal Events (Progressive Sync)
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

          // Simple length check for goals update
          const existingGoalsCount = Array.isArray(alert.goal_events) ? alert.goal_events.length : 0;
          if (currentGoalsData.length !== existingGoalsCount) {
            updates.goal_events = currentGoalsData;
            hasUpdate = true;
          }

          // 4. Cleanup/Completion flags - STAY LIVE until Match actually Finished!
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
              
              // Sync to Google Sheets if result decided
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
    }

    return new Response(JSON.stringify({ status: 'ok', resolved: resolvedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[Resolver] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
