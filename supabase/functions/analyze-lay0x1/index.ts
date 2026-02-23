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

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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
  league: string;
  date: string;
  approved: boolean;
  score_value: number;
  classification: string;
  criteria: {
    home_goals_avg: number;
    away_conceded_avg: number;
    away_odd: number;
    over15_combined: number;
    h2h_0x1_count: number;
    league_goals_avg: number;
    criteria_met: Record<string, boolean>;
  };
  reasons: string[];
}

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

function calculateOddsScore(odd: number): number {
  // Ideal range: 2.5-4.0 = max score, outside = penalty
  if (odd >= 2.5 && odd <= 4.0) return 1.0;
  if (odd < 2.5) return normalize(odd, 1.0, 2.5);
  // 4.0 to 4.5 = diminishing
  return normalize(4.5 - odd, 0, 0.5);
}

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
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const { fixture_ids, weights_override } = await req.json();
    if (!fixture_ids || !Array.isArray(fixture_ids) || fixture_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'fixture_ids array required' }), { status: 400, headers: corsHeaders });
    }

    // Get user weights
    let weights: Weights;
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
    }

    const results: AnalysisResult[] = [];

    for (const fixtureId of fixture_ids) {
      try {
        // 1. Get fixture details
        const fixtureData = await callApiFootball('fixtures', { id: fixtureId });
        const fixture = fixtureData?.response?.[0];
        if (!fixture) continue;

        const homeTeamId = fixture.teams?.home?.id;
        const awayTeamId = fixture.teams?.away?.id;
        const leagueId = fixture.league?.id;
        const season = fixture.league?.season;
        const homeTeam = fixture.teams?.home?.name || 'Home';
        const awayTeam = fixture.teams?.away?.name || 'Away';
        const league = fixture.league?.name || 'League';
        const date = fixture.fixture?.date?.split('T')[0] || '';

        if (!homeTeamId || !awayTeamId) continue;

        // 2. Fetch data in parallel
        const [h2hData, homeStatsData, awayStatsData, oddsData] = await Promise.all([
          callApiFootball('fixtures/headtohead', { h2h: `${homeTeamId}-${awayTeamId}`, last: 5 }),
          callApiFootball('teams/statistics', { team: homeTeamId, league: leagueId, season }),
          callApiFootball('teams/statistics', { team: awayTeamId, league: leagueId, season }),
          callApiFootball('odds', { fixture: fixtureId }),
        ]);

        // 3. Extract stats
        // H2H: count 0x1 results
        const h2hMatches = h2hData?.response || [];
        let h2h0x1Count = 0;
        for (const match of h2hMatches) {
          const hg = match.goals?.home;
          const ag = match.goals?.away;
          if (hg === 0 && ag === 1) h2h0x1Count++;
        }

        // Home goals avg (at home)
        const homeGoalsFor = homeStatsData?.response?.goals?.for;
        const homeGoalsAvg = homeGoalsFor?.average?.home
          ? parseFloat(homeGoalsFor.average.home)
          : 0;

        // Away conceded avg (away)
        const awayGoalsAgainst = awayStatsData?.response?.goals?.against;
        const awayConcededAvg = awayGoalsAgainst?.average?.away
          ? parseFloat(awayGoalsAgainst.average.away)
          : 0;

        // Away odd
        let awayOdd = 0;
        const oddsResponse = oddsData?.response || [];
        if (oddsResponse.length > 0) {
          const bookmakers = oddsResponse[0]?.bookmakers || [];
          for (const bk of bookmakers) {
            const matchWinner = bk.bets?.find((b: any) => b.id === 1);
            if (matchWinner) {
              const awayValue = matchWinner.values?.find((v: any) => v.value === 'Away');
              if (awayValue) {
                awayOdd = parseFloat(awayValue.odd);
                break;
              }
            }
          }
        }

        // Over 1.5 combined
        // Home: goals scored at home >= 1.5 in % of matches
        const homeFixturesPlayed = homeStatsData?.response?.fixtures?.played?.home || 1;
        const homeGoalsTotal = homeGoalsFor?.total?.home || 0;
        // Simplified: use goals avg to estimate over 1.5 tendency
        const homeOver15Pct = Math.min(100, (homeGoalsAvg / 2.0) * 100);

        const awayFixturesPlayed = awayStatsData?.response?.fixtures?.played?.away || 1;
        const awayGoalsForAvg = awayStatsData?.response?.goals?.for?.average?.away
          ? parseFloat(awayStatsData.response.goals.for.average.away)
          : 0;
        const awayOver15Pct = Math.min(100, (awayConcededAvg / 2.0) * 100);

        const over15Combined = homeOver15Pct + awayOver15Pct;

        // League goals avg
        const leagueGoalsAvg = ((homeGoalsAvg + awayConcededAvg) / 2);

        // 4. Check criteria
        const criteriaMet: Record<string, boolean> = {
          h2h_no_0x1: h2h0x1Count <= weights.max_h2h_0x1,
          home_goals_avg: homeGoalsAvg >= weights.min_home_goals_avg,
          away_conceded_avg: awayConcededAvg >= weights.min_away_conceded_avg,
          away_odd: awayOdd > 0 && awayOdd <= weights.max_away_odd,
          over15_combined: over15Combined >= weights.min_over15_combined,
        };

        const allCriteriaMet = Object.values(criteriaMet).every(v => v);
        const reasons: string[] = [];
        if (!criteriaMet.h2h_no_0x1) reasons.push(`H2H tem ${h2h0x1Count} resultado(s) 0x1 nos últimos 5 jogos`);
        if (!criteriaMet.home_goals_avg) reasons.push(`Média gols mandante em casa: ${homeGoalsAvg.toFixed(2)} (mín: ${weights.min_home_goals_avg})`);
        if (!criteriaMet.away_conceded_avg) reasons.push(`Média gols sofridos visitante fora: ${awayConcededAvg.toFixed(2)} (mín: ${weights.min_away_conceded_avg})`);
        if (!criteriaMet.away_odd) reasons.push(`Odd visitante: ${awayOdd.toFixed(2)} (máx: ${weights.max_away_odd})`);
        if (!criteriaMet.over15_combined) reasons.push(`Over 1.5 combinado: ${over15Combined.toFixed(0)}% (mín: ${weights.min_over15_combined}%)`);

        // 5. Calculate score
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

        results.push({
          fixture_id: String(fixtureId),
          home_team: homeTeam,
          away_team: awayTeam,
          league,
          date,
          approved: allCriteriaMet,
          score_value: scoreValue,
          classification: classify(scoreValue),
          criteria: {
            home_goals_avg: homeGoalsAvg,
            away_conceded_avg: awayConcededAvg,
            away_odd: awayOdd,
            over15_combined: over15Combined,
            h2h_0x1_count: h2h0x1Count,
            league_goals_avg: leagueGoalsAvg,
            criteria_met: criteriaMet,
          },
          reasons,
        });
      } catch (err) {
        console.error(`Error analyzing fixture ${fixtureId}:`, err);
      }
    }

    // Sort: approved first, then by score descending
    results.sort((a, b) => {
      if (a.approved !== b.approved) return a.approved ? -1 : 1;
      return b.score_value - a.score_value;
    });

    return new Response(
      JSON.stringify({ results, weights_used: weights }),
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
