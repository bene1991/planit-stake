import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getSupabaseClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

async function callApiFootball(endpoint: string, params: Record<string, unknown>) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const res = await fetch(`${url}/functions/v1/api-football`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ endpoint, params }),
  });
  return res.json();
}

interface Weights {
  offensive_weight: number;
  defensive_weight: number;
  over_weight: number;
  league_avg_weight: number;
  h2h_weight: number;
  odds_weight: number;
  min_home_goals_avg: number;
  min_away_conceded_avg: number;
  max_away_odd: number;
  min_over15_combined: number;
  max_h2h_0x1: number;
}

interface AnalysisResult {
  fixture_id: string;
  home_team: string;
  away_team: string;
  home_team_logo?: string;
  away_team_logo?: string;
  league: string;
  date: string;
  time: string;
  approved: boolean;
  score_value: number;
  classification: string;
  criteria: {
    home_goals_avg: number;
    away_conceded_avg: number;
    home_odd: number;
    draw_odd: number;
    away_odd: number;
    over15_combined: number;
    h2h_0x1_count: number;
    league_goals_avg: number;
    criteria_met: Record<string, boolean>;
  };
  reasons: string[];
  final_score_home?: number;
  final_score_away?: number;
  fixture_status?: string;
  is_backtest: boolean;
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function classify(score: number, minScore: number = 65): string {
  if (score >= 85) return 'Muito Forte';
  if (score >= 75) return 'Forte';
  if (score >= minScore) return 'Moderado';
  return 'Não recomendado';
}

function calculateOddsScore(odd: number): number {
  if (odd >= 2.5 && odd <= 4.0) return 1.0;
  if (odd < 2.5) return normalize(odd, 1.0, 2.5);
  return normalize(4.5 - odd, 0, 0.5);
}

// Extract odds from bookmakers data for a fixture
function extractOdds(bookmakers: any[]): { homeOdd: number; drawOdd: number; awayOdd: number } {
  let homeOdd = 0;
  let drawOdd = 0;
  let awayOdd = 0;
  for (const bk of bookmakers) {
    const matchWinner = bk.bets?.find((b: any) => b.id === 1);
    if (matchWinner) {
      const homeValue = matchWinner.values?.find((v: any) => v.value === 'Home');
      const drawValue = matchWinner.values?.find((v: any) => v.value === 'Draw');
      const awayValue = matchWinner.values?.find((v: any) => v.value === 'Away');
      if (homeValue) homeOdd = parseFloat(homeValue.odd);
      if (drawValue) drawOdd = parseFloat(drawValue.odd);
      if (awayValue) awayOdd = parseFloat(awayValue.odd);
      if (homeOdd > 0 && awayOdd > 0) break;
    }
  }
  return { homeOdd, drawOdd, awayOdd };
}

// Fetch ALL pages of odds for a given date
async function fetchAllOddsPages(date: string): Promise<Map<number, { homeOdd: number; drawOdd: number; awayOdd: number }>> {
  const oddsMap = new Map<number, { homeOdd: number; drawOdd: number; awayOdd: number }>();

  // Page 1
  const firstPage = await callApiFootball('odds', { date, page: 1 });
  const firstResponse = firstPage?.response || [];
  const totalPages = firstPage?.paging?.total || 1;

  console.log(`[ODDS] Page 1/${totalPages} returned ${firstResponse.length} entries`);

  for (const entry of firstResponse) {
    const fId = entry.fixture?.id;
    if (!fId) continue;
    oddsMap.set(fId, extractOdds(entry.bookmakers || []));
  }

  // Fetch remaining pages in batches of 3
  if (totalPages > 1) {
    const remainingPages: number[] = [];
    for (let p = 2; p <= totalPages; p++) remainingPages.push(p);

    const BATCH_SIZE = 3;
    for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
      const batch = remainingPages.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(page => callApiFootball('odds', { date, page }))
      );
      for (const result of results) {
        const entries = result?.response || [];
        for (const entry of entries) {
          const fId = entry.fixture?.id;
          if (!fId) continue;
          oddsMap.set(fId, extractOdds(entry.bookmakers || []));
        }
      }
      console.log(`[ODDS] Fetched pages ${batch.join(',')} — oddsMap size: ${oddsMap.size}`);
    }
  }

  console.log(`[ODDS] Total: ${totalPages} pages, ${oddsMap.size} fixtures with odds`);
  return oddsMap;
}

// ─── CACHE LAYER ──────────────────────────────────────────────
// Check Supabase for cached odds; if found, use them.
// Otherwise, fetch from API and persist to cache for the day.
async function getOddsWithCache(date: string): Promise<Map<number, { homeOdd: number; drawOdd: number; awayOdd: number }>> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  // Use service role client for cache operations (no RLS restrictions)
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const serviceClient = createClient(supabaseUrl, serviceKey);

  // 1. Try to load from cache
  const { data: cached, error: cacheError } = await serviceClient
    .from('lay0x1_odds_cache')
    .select('fixture_id, home_odd, draw_odd, away_odd')
    .eq('date', date);

  if (!cacheError && cached && cached.length > 0) {
    console.log(`[ODDS-CACHE] HIT — ${cached.length} fixtures loaded from cache for ${date}`);
    const oddsMap = new Map<number, { homeOdd: number; drawOdd: number; awayOdd: number }>();
    for (const row of cached) {
      oddsMap.set(row.fixture_id, {
        homeOdd: parseFloat(row.home_odd),
        drawOdd: parseFloat(row.draw_odd),
        awayOdd: parseFloat(row.away_odd),
      });
    }
    return oddsMap;
  }

  // 2. Cache miss — fetch from API
  console.log(`[ODDS-CACHE] MISS — fetching from API for ${date}`);
  const oddsMap = await fetchAllOddsPages(date);

  // 3. Persist to cache (batch insert)
  if (oddsMap.size > 0) {
    const rows = Array.from(oddsMap.entries()).map(([fixtureId, odds]) => ({
      date,
      fixture_id: fixtureId,
      home_odd: odds.homeOdd,
      draw_odd: odds.drawOdd,
      away_odd: odds.awayOdd,
    }));

    // Insert in batches of 100
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error: insertError } = await serviceClient
        .from('lay0x1_odds_cache')
        .upsert(batch, { onConflict: 'date,fixture_id' });
      if (insertError) {
        console.error(`[ODDS-CACHE] Error persisting batch ${i}:`, insertError.message);
      }
    }
    console.log(`[ODDS-CACHE] Persisted ${rows.length} fixtures to cache for ${date}`);
  }

  return oddsMap;
}

// Cache for team statistics (per fixture per date)
async function getStatsFromCache(date: string, fixtureId: number): Promise<{
  home_goals_avg: number; away_conceded_avg: number;
  over15_combined: number; league_goals_avg: number; h2h_0x1_count: number;
} | null> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data, error } = await serviceClient
    .from('lay0x1_stats_cache')
    .select('*')
    .eq('date', date)
    .eq('fixture_id', fixtureId)
    .maybeSingle();

  if (!error && data) {
    const homeAvg = parseFloat(data.home_goals_avg);
    const awayAvg = parseFloat(data.away_conceded_avg);

    // Reject cached entries where either key stat is 0 — force re-fetch with fallback
    if (homeAvg === 0 || awayAvg === 0) {
      console.log(`[STATS-CACHE] Rejecting bad cache for fixture ${fixtureId}: homeGoalsAvg=${homeAvg}, awayConcededAvg=${awayAvg}`);
      // Delete the bad entry so it doesn't keep being checked
      await serviceClient
        .from('lay0x1_stats_cache')
        .delete()
        .eq('date', date)
        .eq('fixture_id', fixtureId);
      return null;
    }

    return {
      home_goals_avg: homeAvg,
      away_conceded_avg: awayAvg,
      over15_combined: parseFloat(data.over15_combined),
      league_goals_avg: parseFloat(data.league_goals_avg),
      h2h_0x1_count: data.h2h_0x1_count,
    };
  }
  return null;
}


async function saveStatsToCache(date: string, fixtureId: number, stats: {
  home_goals_avg: number; away_conceded_avg: number;
  over15_combined: number; league_goals_avg: number; h2h_0x1_count: number;
}): Promise<void> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const serviceClient = createClient(supabaseUrl, serviceKey);

  await serviceClient
    .from('lay0x1_stats_cache')
    .upsert({
      date,
      fixture_id: fixtureId,
      ...stats,
    }, { onConflict: 'date,fixture_id' });
}


const MAX_DETAILED_ANALYSES = 50;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = getSupabaseClient(authHeader);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    const body = await req.json();
    const { date, fixture_ids, weights_override, is_backtest = false } = body;

    // Get user weights
    let weights: Weights;
    let dynamicMinScore = 65;
    if (weights_override) {
      weights = weights_override;
    } else {
      const { data: wData } = await supabase
        .from('lay0x1_weights')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle();

      weights = wData || {
        offensive_weight: 20, defensive_weight: 20, over_weight: 20,
        league_avg_weight: 15, h2h_weight: 15, odds_weight: 10,
        min_home_goals_avg: 1.5, min_away_conceded_avg: 1.5,
        max_away_odd: 4.5, min_over15_combined: 70, max_h2h_0x1: 0,
      };
      dynamicMinScore = (wData as any)?.min_score ?? 65;
    }
    console.log(`[SCANNER] Dynamic min_score: ${dynamicMinScore}`);

    // Fetch blocked leagues
    const { data: blockedData } = await supabase
      .from('lay0x1_blocked_leagues')
      .select('league_name')
      .eq('owner_id', userId);
    const blockedLeagues = new Set((blockedData || []).map((b: any) => b.league_name));
    console.log(`[SCANNER] Blocked leagues: ${blockedLeagues.size}`);

    let fixtureIdsToAnalyze: number[] = [];
    let fixtureMap: Map<number, any> = new Map();
    let oddsMap: Map<number, { homeOdd: number; drawOdd: number; awayOdd: number }> = new Map();
    let totalFixtures = 0;
    let preFilteredCount = 0;
    let totalOddsPages = 0;

    if (date) {
      // 1. Fetch all fixtures for the date
      const fixturesData = await callApiFootball('fixtures', { date });
      const allFixtures = fixturesData?.response || [];
      totalFixtures = allFixtures.length;
      console.log(`[SCANNER] Total fixtures for ${date}: ${totalFixtures}`);

      for (const f of allFixtures) {
        const fId = f.fixture?.id;
        if (fId) fixtureMap.set(fId, f);
      }

      // 2. Fetch odds (with cache for determinism)
      oddsMap = await getOddsWithCache(date);

      // Historical dates (>30 days) won't have odds — skip without fallback
      if (oddsMap.size === 0 && totalFixtures > 0) {
        console.log(`[SCANNER] No odds available for ${date} (historical date) — skipping`);
      }

      // 3. Pre-filter: home_odd < away_odd AND away_odd within range AND league not blocked
      for (const [fId, fixture] of fixtureMap.entries()) {
        const odds = oddsMap.get(fId);
        if (!odds || odds.homeOdd <= 0 || odds.awayOdd <= 0) continue;
        const leagueName = fixture.league?.name || '';
        if (blockedLeagues.has(leagueName)) continue;
        if (odds.homeOdd < odds.awayOdd && odds.awayOdd <= weights.max_away_odd) {
          fixtureIdsToAnalyze.push(fId);
        }
      }
      preFilteredCount = fixtureIdsToAnalyze.length;
      console.log(`[SCANNER] Pre-filtered (odds criteria): ${preFilteredCount}`);

      // 4. Safety limit: if too many, pick top 50 by best home/away odd ratio
      if (fixtureIdsToAnalyze.length > MAX_DETAILED_ANALYSES) {
        fixtureIdsToAnalyze.sort((a, b) => {
          const oddsA = oddsMap.get(a)!;
          const oddsB = oddsMap.get(b)!;
          return (oddsA.homeOdd / oddsA.awayOdd) - (oddsB.homeOdd / oddsB.awayOdd);
        });
        fixtureIdsToAnalyze = fixtureIdsToAnalyze.slice(0, MAX_DETAILED_ANALYSES);
        console.log(`[SCANNER] Limited to top ${MAX_DETAILED_ANALYSES} by home/away ratio`);
      }

    } else if (fixture_ids && Array.isArray(fixture_ids) && fixture_ids.length > 0) {
      // Legacy flow: fixture_ids provided directly
      fixtureIdsToAnalyze = fixture_ids;
    } else {
      return new Response(JSON.stringify({ error: 'date or fixture_ids required' }), { status: 400, headers: corsHeaders });
    }

    // --- Analyze a single fixture (extracted for parallel batching) ---
    async function analyzeFixture(fixtureId: number): Promise<AnalysisResult | null> {
      try {
        let fixture = fixtureMap.get(fixtureId);
        if (!fixture) {
          const fixtureData = await callApiFootball('fixtures', { id: fixtureId });
          fixture = fixtureData?.response?.[0];
          if (!fixture) return null;
        }

        const homeTeamId = fixture.teams?.home?.id;
        const awayTeamId = fixture.teams?.away?.id;
        const leagueId = fixture.league?.id;
        const season = fixture.league?.season;
        const homeTeam = fixture.teams?.home?.name || 'Home';
        const awayTeam = fixture.teams?.away?.name || 'Away';
        const homeTeamLogo = fixture.teams?.home?.logo || undefined;
        const awayTeamLogo = fixture.teams?.away?.logo || undefined;
        const league = fixture.league?.name || 'League';
        const fixtureDate = fixture.fixture?.date?.split('T')[0] || '';

        const fixtureDateTimeStr = fixture.fixture?.date || '';
        const brasiliaDate = new Date(fixtureDateTimeStr);
        const utcMs = brasiliaDate.getTime() + (brasiliaDate.getTimezoneOffset() * 60000);
        const brasiliaMs = utcMs + (-3 * 3600000);
        const bDate = new Date(brasiliaMs);
        const fixtureTime = `${bDate.getHours().toString().padStart(2, '0')}:${bDate.getMinutes().toString().padStart(2, '0')}`;

        const fixtureStatus = fixture.fixture?.status?.short || 'NS';
        const isFinished = ['FT', 'AET', 'PEN'].includes(fixtureStatus);
        const finalScoreHome = isFinished ? fixture.goals?.home : undefined;
        const finalScoreAway = isFinished ? fixture.goals?.away : undefined;

        if (!homeTeamId || !awayTeamId) return null;

        let homeOdd = 0;
        let drawOdd = 0;
        let awayOdd = 0;
        const cachedOdds = oddsMap.get(fixtureId);
        if (cachedOdds) {
          homeOdd = cachedOdds.homeOdd;
          drawOdd = cachedOdds.drawOdd;
          awayOdd = cachedOdds.awayOdd;
        }

        // ─── STATS: Cache-first approach ───
        const fixtureDateForCache = fixture.fixture?.date?.split('T')[0] || date || '';
        const cachedStats = await getStatsFromCache(fixtureDateForCache, fixtureId);

        let homeGoalsAvg: number;
        let awayConcededAvg: number;
        let over15Combined: number;
        let leagueGoalsAvg: number;
        let h2h0x1Count: number;

        if (cachedStats) {
          // Use cached values for determinism
          homeGoalsAvg = cachedStats.home_goals_avg;
          awayConcededAvg = cachedStats.away_conceded_avg;
          over15Combined = cachedStats.over15_combined;
          leagueGoalsAvg = cachedStats.league_goals_avg;
          h2h0x1Count = cachedStats.h2h_0x1_count;
          console.log(`[STATS-CACHE] HIT for fixture ${fixtureId}`);
        } else {
          // Fetch from API
          const parallelCalls: Promise<any>[] = [
            callApiFootball('fixtures/headtohead', { h2h: `${homeTeamId}-${awayTeamId}`, last: 5 }),
            callApiFootball('teams/statistics', { team: homeTeamId, league: leagueId, season }),
            callApiFootball('teams/statistics', { team: awayTeamId, league: leagueId, season }),
          ];
          if (homeOdd === 0 || awayOdd === 0) {
            parallelCalls.push(callApiFootball('odds', { fixture: fixtureId }));
          }

          const [h2hData, homeStatsData, awayStatsData, oddsDataSingle] = await Promise.all(parallelCalls);

          if ((homeOdd === 0 || awayOdd === 0) && oddsDataSingle) {
            const oddsResp = oddsDataSingle?.response || [];
            if (oddsResp.length > 0) {
              const extracted = extractOdds(oddsResp[0]?.bookmakers || []);
              homeOdd = extracted.homeOdd;
              drawOdd = extracted.drawOdd;
              awayOdd = extracted.awayOdd;
            }
          }

          const h2hMatches = h2hData?.response || [];
          h2h0x1Count = 0;
          for (const match of h2hMatches) {
            if (match.goals?.home === 0 && match.goals?.away === 1) h2h0x1Count++;
          }

          const homeGoalsFor = homeStatsData?.response?.goals?.for;
          homeGoalsAvg = homeGoalsFor?.average?.home ? parseFloat(homeGoalsFor.average.home) : 0;

          const awayGoalsAgainst = awayStatsData?.response?.goals?.against;
          awayConcededAvg = awayGoalsAgainst?.average?.away ? parseFloat(awayGoalsAgainst.average.away) : 0;

          // ─── FALLBACK: If stats returned 0, compute from recent fixtures ───
          if (homeGoalsAvg === 0 || awayConcededAvg === 0) {
            console.log(`[STATS] Incomplete for fixture ${fixtureId}: homeGoalsAvg=${homeGoalsAvg}, awayConcededAvg=${awayConcededAvg}. Running fallback...`);

            const fallbackCalls: Promise<any>[] = [];
            if (homeGoalsAvg === 0) {
              fallbackCalls.push(callApiFootball('fixtures', { team: homeTeamId, last: 15, season }));
            } else {
              fallbackCalls.push(Promise.resolve(null));
            }
            if (awayConcededAvg === 0) {
              fallbackCalls.push(callApiFootball('fixtures', { team: awayTeamId, last: 15, season }));
            } else {
              fallbackCalls.push(Promise.resolve(null));
            }

            const [homeFallback, awayFallback] = await Promise.all(fallbackCalls);

            // Home team: avg goals scored at HOME
            if (homeGoalsAvg === 0 && homeFallback) {
              const allMatches = homeFallback?.response || [];
              const homeGames = allMatches.filter((m: any) => m.teams?.home?.id === homeTeamId);
              if (homeGames.length > 0) {
                const totalGoals = homeGames.reduce((sum: number, m: any) => sum + (m.goals?.home ?? 0), 0);
                homeGoalsAvg = totalGoals / homeGames.length;
                console.log(`[STATS-FALLBACK] Home goals avg from ${homeGames.length} home fixtures: ${homeGoalsAvg.toFixed(2)}`);
              } else if (allMatches.length > 0) {
                const totalGoals = allMatches.reduce((sum: number, m: any) => {
                  const isHome = m.teams?.home?.id === homeTeamId;
                  return sum + (isHome ? (m.goals?.home ?? 0) : (m.goals?.away ?? 0));
                }, 0);
                homeGoalsAvg = totalGoals / allMatches.length;
                console.log(`[STATS-FALLBACK] Home goals avg (all venues) from ${allMatches.length} fixtures: ${homeGoalsAvg.toFixed(2)}`);
              }
            }

            // Away team: avg goals conceded when AWAY
            if (awayConcededAvg === 0 && awayFallback) {
              const allMatches = awayFallback?.response || [];
              const awayGames = allMatches.filter((m: any) => m.teams?.away?.id === awayTeamId);
              if (awayGames.length > 0) {
                const totalConceded = awayGames.reduce((sum: number, m: any) => sum + (m.goals?.home ?? 0), 0);
                awayConcededAvg = totalConceded / awayGames.length;
                console.log(`[STATS-FALLBACK] Away conceded avg from ${awayGames.length} away fixtures: ${awayConcededAvg.toFixed(2)}`);
              } else if (allMatches.length > 0) {
                const totalConceded = allMatches.reduce((sum: number, m: any) => {
                  const isAway = m.teams?.away?.id === awayTeamId;
                  return sum + (isAway ? (m.goals?.home ?? 0) : (m.goals?.away ?? 0));
                }, 0);
                awayConcededAvg = totalConceded / allMatches.length;
                console.log(`[STATS-FALLBACK] Away conceded avg (all venues) from ${allMatches.length} fixtures: ${awayConcededAvg.toFixed(2)}`);
              }
            }
          }


          const homeOver15Pct = Math.min(100, (homeGoalsAvg / 2.0) * 100);
          const awayOver15Pct = Math.min(100, (awayConcededAvg / 2.0) * 100);
          over15Combined = homeOver15Pct + awayOver15Pct;
          leagueGoalsAvg = (homeGoalsAvg + awayConcededAvg) / 2;

          // Only cache if BOTH key metrics are valid (non-zero)
          if (homeGoalsAvg > 0 && awayConcededAvg > 0) {
            await saveStatsToCache(fixtureDateForCache, fixtureId, {
              home_goals_avg: homeGoalsAvg,
              away_conceded_avg: awayConcededAvg,
              over15_combined: over15Combined,
              league_goals_avg: leagueGoalsAvg,
              h2h_0x1_count: h2h0x1Count,
            });
            console.log(`[STATS-CACHE] SAVED for fixture ${fixtureId}`);
          } else {
            console.log(`[STATS-CACHE] SKIPPED caching for fixture ${fixtureId} — data looks incomplete`);
          }
        }

        const criteriaMet: Record<string, boolean> = {
          home_odd_lower: homeOdd > 0 && awayOdd > 0 && homeOdd < awayOdd,
          h2h_no_0x1: h2h0x1Count <= weights.max_h2h_0x1,
          home_goals_avg: homeGoalsAvg >= weights.min_home_goals_avg,
          away_conceded_avg: awayConcededAvg >= weights.min_away_conceded_avg,
          away_odd: awayOdd > 0 && awayOdd <= weights.max_away_odd,
          over15_combined: over15Combined >= weights.min_over15_combined,
        };

        const allCriteriaMet = Object.values(criteriaMet).every(v => v);
        const reasons: string[] = [];
        if (!criteriaMet.home_odd_lower) reasons.push(`Odd casa (${homeOdd.toFixed(2)}) >= Odd visitante (${awayOdd.toFixed(2)})`);
        if (!criteriaMet.h2h_no_0x1) reasons.push(`H2H tem ${h2h0x1Count} resultado(s) 0x1 nos últimos 5 jogos`);
        if (!criteriaMet.home_goals_avg) reasons.push(`Média gols mandante em casa: ${homeGoalsAvg.toFixed(2)} (mín: ${weights.min_home_goals_avg})`);
        if (!criteriaMet.away_conceded_avg) reasons.push(`Média gols sofridos visitante fora: ${awayConcededAvg.toFixed(2)} (mín: ${weights.min_away_conceded_avg})`);
        if (!criteriaMet.away_odd) reasons.push(`Odd visitante: ${awayOdd.toFixed(2)} (máx: ${weights.max_away_odd})`);
        if (!criteriaMet.over15_combined) reasons.push(`Over 1.5 combinado: ${over15Combined.toFixed(0)}% (mín: ${weights.min_over15_combined}%)`);

        const totalWeight = weights.offensive_weight + weights.defensive_weight + weights.over_weight +
          weights.league_avg_weight + weights.h2h_weight + weights.odds_weight;

        const offensiveScore = normalize(homeGoalsAvg, 0.5, 3.0) * (weights.offensive_weight / totalWeight);
        const defensiveScore = normalize(awayConcededAvg, 0.5, 3.0) * (weights.defensive_weight / totalWeight);
        const overScore = normalize(over15Combined, 40, 150) * (weights.over_weight / totalWeight);
        const leagueScore = normalize(leagueGoalsAvg, 1.0, 3.5) * (weights.league_avg_weight / totalWeight);
        const h2hScore = normalize(5 - h2h0x1Count, 0, 5) * (weights.h2h_weight / totalWeight);
        const oddsScore = calculateOddsScore(awayOdd) * (weights.odds_weight / totalWeight);

        const rawScore = (offensiveScore + defensiveScore + overScore + leagueScore + h2hScore + oddsScore) * 100;
        const scoreValue = Math.round(Math.max(0, Math.min(100, rawScore)));

        const isApproved = allCriteriaMet;

        return {
          fixture_id: String(fixtureId),
          home_team: homeTeam,
          away_team: awayTeam,
          home_team_logo: homeTeamLogo,
          away_team_logo: awayTeamLogo,
          league,
          date: fixtureDate,
          time: fixtureTime,
          approved: isApproved,
          score_value: scoreValue,
          classification: classify(scoreValue, dynamicMinScore),
          criteria: {
            home_goals_avg: homeGoalsAvg,
            away_conceded_avg: awayConcededAvg,
            home_odd: homeOdd,
            draw_odd: drawOdd,
            away_odd: awayOdd,
            over15_combined: over15Combined,
            h2h_0x1_count: h2h0x1Count,
            league_goals_avg: leagueGoalsAvg,
            criteria_met: criteriaMet,
          },
          reasons,
          final_score_home: finalScoreHome,
          final_score_away: finalScoreAway,
          fixture_status: fixtureStatus,
          is_backtest: is_backtest,
        };
      } catch (err) {
        console.error(`Error analyzing fixture ${fixtureId}:`, err);
        return null;
      }
    }

    // --- Process in parallel batches of 5 ---
    const BATCH_SIZE = 5;
    const results: AnalysisResult[] = [];
    const totalBatches = Math.ceil(fixtureIdsToAnalyze.length / BATCH_SIZE);

    for (let i = 0; i < fixtureIdsToAnalyze.length; i += BATCH_SIZE) {
      const batch = fixtureIdsToAnalyze.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`[SCANNER] Batch ${batchNum}/${totalBatches} — analyzing ${batch.length} fixtures...`);

      const batchResults = await Promise.all(batch.map(id => analyzeFixture(id)));
      for (const r of batchResults) {
        if (r) results.push(r);
      }
    }

    console.log(`[SCANNER] Detailed analysis complete: ${results.length} results (${results.filter(r => r.approved).length} approved)`);

    // Sort: approved first, then by time ascending
    results.sort((a, b) => {
      if (a.approved !== b.approved) return a.approved ? -1 : 1;
      return a.time.localeCompare(b.time);
    });

    return new Response(
      JSON.stringify({
        results,
        weights_used: weights,
        total_fixtures: totalFixtures || fixtureIdsToAnalyze.length,
        fixtures_with_odds: oddsMap.size,
        pre_filtered: preFilteredCount || fixtureIdsToAnalyze.length,
        analyzed: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-lay0x1:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
