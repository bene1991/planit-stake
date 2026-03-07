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

    if (!res.ok) {
        const error = await res.text();
        console.error(`[API-Football Call Error] ${endpoint}:`, error);
        throw new Error(`API error: ${res.status}`);
    }

    return res.json();
}

// ─── Shared helpers ───

function normalize(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function classify(score: number): string {
    if (score >= 85) return 'Muito Forte';
    if (score >= 75) return 'Forte';
    if (score >= 65) return 'Moderado';
    return 'Não recomendado';
}

function extractOdds(bookmakers: any[]): { homeOdd: number; drawOdd: number; awayOdd: number } {
    let homeOdd = 0, drawOdd = 0, awayOdd = 0;
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

// ─── Odds cache (reuses same table as lay0x1) ───

async function getOddsWithCache(date: string): Promise<Map<number, { homeOdd: number; drawOdd: number; awayOdd: number }>> {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: cached, error: cacheError } = await serviceClient
        .from('lay0x1_odds_cache')
        .select('fixture_id, home_odd, draw_odd, away_odd')
        .eq('date', date);

    if (!cacheError && cached && cached.length > 0) {
        console.log(`[LAY1x0-ODDS-CACHE] HIT — ${cached.length} fixtures`);
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

    // Cache miss — fetch from API
    console.log(`[LAY1x0-ODDS-CACHE] MISS — fetching from API for ${date}`);
    const oddsMap = new Map<number, { homeOdd: number; drawOdd: number; awayOdd: number }>();

    const firstPage = await callApiFootball('odds', { date, page: 1 });
    const firstResponse = firstPage?.response || [];
    const totalPages = firstPage?.paging?.total || 1;

    for (const entry of firstResponse) {
        const fId = entry.fixture?.id;
        if (!fId) continue;
        oddsMap.set(fId, extractOdds(entry.bookmakers || []));
    }

    if (totalPages > 1) {
        for (let p = 2; p <= totalPages; p++) {
            const result = await callApiFootball('odds', { date, page: p });
            const entries = result?.response || [];
            for (const entry of entries) {
                const fId = entry.fixture?.id;
                if (!fId) continue;
                oddsMap.set(fId, extractOdds(entry.bookmakers || []));
            }
        }
    }

    // Persist to cache
    if (oddsMap.size > 0) {
        const rows = Array.from(oddsMap.entries()).map(([fixtureId, odds]) => ({
            date, fixture_id: fixtureId,
            home_odd: odds.homeOdd, draw_odd: odds.drawOdd, away_odd: odds.awayOdd,
        }));
        const BATCH = 100;
        for (let i = 0; i < rows.length; i += BATCH) {
            await serviceClient.from('lay0x1_odds_cache').upsert(rows.slice(i, i + BATCH), { onConflict: 'date,fixture_id' });
        }
    }

    return oddsMap;
}

// ─── Stats cache (reuses lay0x1_stats_cache with new columns) ───

interface CachedStats1x0 {
    away_goals_avg: number;
    home_conceded_avg: number;
    over15_combined: number;
    league_goals_avg: number;
    h2h_1x0_count: number;
    btts_pct: number;
    over25_pct: number;
}

async function getStatsFromCache1x0(date: string, fixtureId: number): Promise<CachedStats1x0 | null> {
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
        const awayGoalsAvg = parseFloat(data.away_goals_avg || '0');
        const homeConcededAvg = parseFloat(data.home_conceded_avg || '0');
        // If these new columns have data, use them
        if (awayGoalsAvg > 0 && homeConcededAvg > 0) {
            return {
                away_goals_avg: awayGoalsAvg,
                home_conceded_avg: homeConcededAvg,
                over15_combined: parseFloat(data.over15_combined || '0'),
                league_goals_avg: parseFloat(data.league_goals_avg || '0'),
                h2h_1x0_count: data.h2h_0x1_count || 0, // reuse field
                btts_pct: parseFloat(data.btts_pct || '0'),
                over25_pct: parseFloat(data.over25_pct || '0'),
            };
        }
    }
    return null;
}

async function saveStats1x0ToCache(date: string, fixtureId: number, stats: {
    away_goals_avg: number; home_conceded_avg: number;
    over15_combined: number; league_goals_avg: number; h2h_1x0_count: number;
    btts_pct: number; over25_pct: number;
}): Promise<void> {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const serviceClient = createClient(supabaseUrl, serviceKey);

    await serviceClient.from('lay0x1_stats_cache').upsert({
        date, fixture_id: fixtureId,
        away_goals_avg: stats.away_goals_avg,
        home_conceded_avg: stats.home_conceded_avg,
        over15_combined: stats.over15_combined,
        league_goals_avg: stats.league_goals_avg,
        h2h_0x1_count: stats.h2h_1x0_count,
        btts_pct: stats.btts_pct,
        over25_pct: stats.over25_pct,
        // Keep existing 0x1 fields as-is by not overwriting them here
        // The upsert with onConflict will merge
    }, { onConflict: 'date,fixture_id' });
}

// ─── Lay 1x0 Analysis Result ───

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
        away_goals_avg: number;
        home_conceded_avg: number;
        home_odd: number;
        draw_odd: number;
        away_odd: number;
        over15_combined: number;
        h2h_1x0_count: number;
        league_goals_avg: number;
        criteria_met: Record<string, boolean>;
    };
    reasons: string[];
    final_score_home?: number;
    final_score_away?: number;
    fixture_status?: string;
    is_backtest: boolean;
}

const MAX_DETAILED_ANALYSES = 50;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

        // Manual Auth Validation
        const isServiceKey = authHeader === `Bearer ${serviceKey}`;
        const isAnonKey = authHeader === `Bearer ${anonKey}` || req.headers.get('apikey') === anonKey;

        if (!authHeader?.startsWith('Bearer ') && !req.headers.get('apikey')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            { global: { headers: { Authorization: authHeader! } } }
        );

        let user;
        // If it's a service key call, we bypass getUser (internal loop)
        if (isServiceKey) {
            console.log('[analyze-lay1x0] Authorized via Service Key');
            // Mock a "system" user if needed, or handle null user carefully below
            // For this function, user.id is used for blocked leagues.
            // If service key is used (e.g. by a cron), we might need a default user ID or skip the check.
        } else {
            const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
            if (userError || !authUser) {
                console.error('[analyze-lay1x0] User Auth Error:', userError);
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
            }
            user = authUser;
        }

        const body = await req.json();
        const { date, is_backtest = false } = body;

        if (!date) {
            return new Response(JSON.stringify({ error: 'date is required' }), { status: 400, headers: corsHeaders });
        }

        // Fetch blocked leagues
        const { data: blockedData } = await supabase
            .from('lay0x1_blocked_leagues')
            .select('league_name')
            .eq('owner_id', user.id);
        const blockedLeagues = new Set((blockedData || []).map((b: any) => b.league_name));

        // 1. Fetch all fixtures for the date
        const fixturesData = await callApiFootball('fixtures', { date });
        const allFixtures = fixturesData?.response || [];
        const totalFixtures = allFixtures.length;
        console.log(`[LAY1x0] Total fixtures for ${date}: ${totalFixtures}`);

        const fixtureMap = new Map<number, any>();
        for (const f of allFixtures) {
            const fId = f.fixture?.id;
            if (fId) fixtureMap.set(fId, f);
        }

        // 2. Fetch odds
        const oddsMap = await getOddsWithCache(date);

        // 3. Pre-filter for Lay 1x0:
        //    - home_odd <= 5.0 (home team not huge underdog)
        //    - away_odd < home_odd (visitor is the FAVORITE — they're the ones expected to score)
        //    - league not blocked
        let fixtureIdsToAnalyze: number[] = [];
        for (const [fId, fixture] of fixtureMap.entries()) {
            const odds = oddsMap.get(fId);
            if (!odds || odds.homeOdd <= 0 || odds.awayOdd <= 0) continue;
            const leagueName = fixture.league?.name || '';
            if (blockedLeagues.has(leagueName)) continue;
            // For Lay 1x0, the VISITOR is the favorite (lower odd)
            // so we expect them to score, making 1x0 (home winning) unlikely
            if (odds.homeOdd <= 5.0 && odds.awayOdd < odds.homeOdd) {
                fixtureIdsToAnalyze.push(fId);
            }
        }

        const preFilteredCount = fixtureIdsToAnalyze.length;
        console.log(`[LAY1x0] Pre-filtered (odds): ${preFilteredCount}`);

        if (fixtureIdsToAnalyze.length > MAX_DETAILED_ANALYSES) {
            // Sort by away odd ascending (most favorite visitor first)
            fixtureIdsToAnalyze.sort((a, b) => {
                const oddsA = oddsMap.get(a)!;
                const oddsB = oddsMap.get(b)!;
                return oddsA.awayOdd - oddsB.awayOdd;
            });
            fixtureIdsToAnalyze = fixtureIdsToAnalyze.slice(0, MAX_DETAILED_ANALYSES);
        }

        // ─── Analyze a single fixture for Lay 1x0 ───
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

                let homeOdd = 0, drawOdd = 0, awayOdd = 0;
                const cachedOdds = oddsMap.get(fixtureId);
                if (cachedOdds) {
                    homeOdd = cachedOdds.homeOdd;
                    drawOdd = cachedOdds.drawOdd;
                    awayOdd = cachedOdds.awayOdd;
                }

                // ─── Stats ───
                const fixtureDateForCache = fixture.fixture?.date?.split('T')[0] || date || '';
                const cachedStats = await getStatsFromCache1x0(fixtureDateForCache, fixtureId);

                let awayGoalsAvg: number;    // Away team goals scored away
                let homeConcededAvg: number; // Home team goals conceded at home
                let over15Combined: number;
                let leagueGoalsAvg: number;
                let h2h1x0Count: number;
                let bttsPct = 0;
                let over25Pct = 0;

                if (cachedStats) {
                    awayGoalsAvg = cachedStats.away_goals_avg;
                    homeConcededAvg = cachedStats.home_conceded_avg;
                    over15Combined = cachedStats.over15_combined;
                    leagueGoalsAvg = cachedStats.league_goals_avg;
                    h2h1x0Count = cachedStats.h2h_1x0_count;
                    bttsPct = cachedStats.btts_pct;
                    over25Pct = cachedStats.over25_pct;
                    console.log(`[LAY1x0-CACHE] HIT for fixture ${fixtureId}`);
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
                    parallelCalls.push(callApiFootball('fixtures', { team: homeTeamId, last: 10, season }));
                    parallelCalls.push(callApiFootball('fixtures', { team: awayTeamId, last: 10, season }));

                    const allResults = await Promise.all(parallelCalls);
                    const h2hData = allResults[0];
                    const homeStatsData = allResults[1];
                    const awayStatsData = allResults[2];
                    const oddsDataSingle = (homeOdd === 0 || awayOdd === 0) ? allResults[3] : null;
                    const homeLast10Data = (homeOdd === 0 || awayOdd === 0) ? allResults[4] : allResults[3];
                    const awayLast10Data = (homeOdd === 0 || awayOdd === 0) ? allResults[5] : allResults[4];

                    if ((homeOdd === 0 || awayOdd === 0) && oddsDataSingle) {
                        const oddsResp = oddsDataSingle?.response || [];
                        if (oddsResp.length > 0) {
                            const extracted = extractOdds(oddsResp[0]?.bookmakers || []);
                            homeOdd = extracted.homeOdd;
                            drawOdd = extracted.drawOdd;
                            awayOdd = extracted.awayOdd;
                        }
                    }

                    // H2H: count 1x0 results (home=1, away=0)
                    const h2hMatches = h2hData?.response || [];
                    h2h1x0Count = 0;
                    for (const match of h2hMatches) {
                        if (match.goals?.home === 1 && match.goals?.away === 0) h2h1x0Count++;
                    }

                    // INVERTED STATS for Lay 1x0:
                    // Away team's goals scored AWAY (offensive strength of visitor)
                    const awayGoalsFor = awayStatsData?.response?.goals?.for;
                    awayGoalsAvg = awayGoalsFor?.average?.away ? parseFloat(awayGoalsFor.average.away) : 0;

                    // Home team's goals CONCEDED at HOME (defensive weakness of home)
                    const homeGoalsAgainst = homeStatsData?.response?.goals?.against;
                    homeConcededAvg = homeGoalsAgainst?.average?.home ? parseFloat(homeGoalsAgainst.average.home) : 0;

                    const homeLast10 = homeLast10Data?.response || [];
                    const awayLast10 = awayLast10Data?.response || [];

                    // BTTS %
                    const allLast10 = [...homeLast10, ...awayLast10];
                    if (allLast10.length > 0) {
                        const bttsGames = allLast10.filter((m: any) => (m.goals?.home ?? 0) > 0 && (m.goals?.away ?? 0) > 0);
                        bttsPct = (bttsGames.length / allLast10.length) * 100;
                    }

                    // Over 2.5 %
                    if (allLast10.length > 0) {
                        const over25Games = allLast10.filter((m: any) => ((m.goals?.home ?? 0) + (m.goals?.away ?? 0)) > 2);
                        over25Pct = (over25Games.length / allLast10.length) * 100;
                    }

                    // Fallbacks
                    if (awayGoalsAvg === 0 && awayLast10.length > 0) {
                        const awayGames = awayLast10.filter((m: any) => m.teams?.away?.id === awayTeamId);
                        if (awayGames.length > 0) {
                            const totalGoals = awayGames.reduce((sum: number, m: any) => sum + (m.goals?.away ?? 0), 0);
                            awayGoalsAvg = totalGoals / awayGames.length;
                        } else {
                            const totalGoals = awayLast10.reduce((sum: number, m: any) => {
                                const isAway = m.teams?.away?.id === awayTeamId;
                                return sum + (isAway ? (m.goals?.away ?? 0) : (m.goals?.home ?? 0));
                            }, 0);
                            awayGoalsAvg = totalGoals / awayLast10.length;
                        }
                        console.log(`[LAY1x0-FALLBACK] Away goals avg: ${awayGoalsAvg.toFixed(2)}`);
                    }

                    if (homeConcededAvg === 0 && homeLast10.length > 0) {
                        const homeGames = homeLast10.filter((m: any) => m.teams?.home?.id === homeTeamId);
                        if (homeGames.length > 0) {
                            const totalConceded = homeGames.reduce((sum: number, m: any) => sum + (m.goals?.away ?? 0), 0);
                            homeConcededAvg = totalConceded / homeGames.length;
                        } else {
                            const totalConceded = homeLast10.reduce((sum: number, m: any) => {
                                const isHome = m.teams?.home?.id === homeTeamId;
                                return sum + (isHome ? (m.goals?.away ?? 0) : (m.goals?.home ?? 0));
                            }, 0);
                            homeConcededAvg = totalConceded / homeLast10.length;
                        }
                        console.log(`[LAY1x0-FALLBACK] Home conceded avg: ${homeConcededAvg.toFixed(2)}`);
                    }

                    // Combined over 1.5 for Lay 1x0: uses away goals + home conceded
                    const awayOver15Pct = Math.min(100, (awayGoalsAvg / 2.0) * 100);
                    const homeOver15Pct = Math.min(100, (homeConcededAvg / 2.0) * 100);
                    over15Combined = awayOver15Pct + homeOver15Pct;
                    leagueGoalsAvg = (awayGoalsAvg + homeConcededAvg) / 2;

                    // Save to cache
                    if (awayGoalsAvg > 0 && homeConcededAvg > 0) {
                        await saveStats1x0ToCache(fixtureDateForCache, fixtureId, {
                            away_goals_avg: awayGoalsAvg,
                            home_conceded_avg: homeConcededAvg,
                            over15_combined: over15Combined,
                            league_goals_avg: leagueGoalsAvg,
                            h2h_1x0_count: h2h1x0Count,
                            btts_pct: bttsPct,
                            over25_pct: over25Pct,
                        });
                        console.log(`[LAY1x0-CACHE] SAVED for fixture ${fixtureId}`);
                    }
                }

                // ─── Lay 1x0 Criteria ───
                const criteriaMet: Record<string, boolean> = {
                    away_goals_avg: awayGoalsAvg >= 1.2,
                    home_conceded_avg: homeConcededAvg >= 1.0,
                    home_odd: homeOdd > 0 && homeOdd <= 5.0,
                    over15_combined: over15Combined >= 65,
                    offensive_diff: awayGoalsAvg > homeConcededAvg * 0.7, // visitor offensive impacting
                    h2h_no_1x0: h2h1x0Count <= 1,
                };

                const allCriteriaMet = Object.values(criteriaMet).every(v => v);
                const reasons: string[] = [];
                if (!criteriaMet.away_goals_avg) reasons.push(`Gols visitante fora: ${awayGoalsAvg.toFixed(2)} (mín: 1.20)`);
                if (!criteriaMet.home_conceded_avg) reasons.push(`Gols sofridos casa: ${homeConcededAvg.toFixed(2)} (mín: 1.00)`);
                if (!criteriaMet.home_odd) reasons.push(`Odd casa: ${homeOdd.toFixed(2)} (máx: 5.00)`);
                if (!criteriaMet.over15_combined) reasons.push(`Over 1.5 combinado: ${over15Combined.toFixed(0)}% (mín: 65%)`);
                if (!criteriaMet.offensive_diff) reasons.push(`Diferença ofensiva não favorece visitante`);
                if (!criteriaMet.h2h_no_1x0) reasons.push(`H2H tem ${h2h1x0Count} resultado(s) 1x0 nos últimos 5 jogos`);

                // ─── Score calculation ───
                const offensiveScore = normalize(awayGoalsAvg, 0.5, 3.0) * 0.25;
                const defensiveScore = normalize(homeConcededAvg, 0.5, 3.0) * 0.25;
                const overScore = normalize(over15Combined, 40, 150) * 0.20;
                const leagueScore = normalize(leagueGoalsAvg, 1.0, 3.5) * 0.10;
                const h2hScore = normalize(2 - h2h1x0Count, 0, 2) * 0.10;
                const oddsScore = normalize(homeOdd, 1.0, 5.0) * 0.10;

                const rawScore = (offensiveScore + defensiveScore + overScore + leagueScore + h2hScore + oddsScore) * 100;
                const scoreValue = Math.round(Math.max(0, Math.min(100, rawScore)));

                return {
                    fixture_id: String(fixtureId),
                    home_team: homeTeam,
                    away_team: awayTeam,
                    home_team_logo: homeTeamLogo,
                    away_team_logo: awayTeamLogo,
                    league,
                    date: fixtureDate,
                    time: fixtureTime,
                    approved: allCriteriaMet,
                    score_value: scoreValue,
                    classification: classify(scoreValue),
                    criteria: {
                        away_goals_avg: awayGoalsAvg,
                        home_conceded_avg: homeConcededAvg,
                        home_odd: homeOdd,
                        draw_odd: drawOdd,
                        away_odd: awayOdd,
                        over15_combined: over15Combined,
                        h2h_1x0_count: h2h1x0Count,
                        league_goals_avg: leagueGoalsAvg,
                        criteria_met: criteriaMet,
                    },
                    reasons,
                    final_score_home: finalScoreHome,
                    final_score_away: finalScoreAway,
                    fixture_status: fixtureStatus,
                    is_backtest,
                };
            } catch (err) {
                console.error(`[LAY1x0] Error analyzing fixture ${fixtureId}:`, err);
                return null;
            }
        }

        // Process in parallel batches of 5 to avoid timeouts and maximize throughput
        const results: AnalysisResult[] = [];
        const BATCH_SIZE = 5;
        for (let i = 0; i < fixtureIdsToAnalyze.length; i += BATCH_SIZE) {
            const batch = fixtureIdsToAnalyze.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(batch.map(fId => analyzeFixture(fId)));
            for (const r of batchResults) {
                if (r) results.push(r);
            }
            console.log(`[LAY1x0] Progress: ${Math.min(i + BATCH_SIZE, fixtureIdsToAnalyze.length)}/${fixtureIdsToAnalyze.length}`);
        }

        console.log(`[LAY1x0] Analysis complete: ${results.length} results (${results.filter(r => r.approved).length} approved)`);

        // Sort: approved first, then by score descending
        results.sort((a, b) => {
            if (a.approved !== b.approved) return a.approved ? -1 : 1;
            return b.score_value - a.score_value;
        });

        return new Response(
            JSON.stringify({
                results,
                total_fixtures: totalFixtures,
                fixtures_with_odds: oddsMap.size,
                pre_filtered: preFilteredCount,
                analyzed: results.length,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Error in analyze-lay1x0:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
