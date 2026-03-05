import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TeamStats {
  games: { played: { total: number; home: number; away: number } };
  goals: {
    for: { total: { total: number; home: number; away: number }; average: { total: string; home: string; away: string }; minute: Record<string, { total: number | null; percentage: string | null }> };
    against: { total: { total: number; home: number; away: number }; average: { total: string; home: string; away: string }; minute: Record<string, { total: number | null; percentage: string | null }> };
  };
  clean_sheet: { total: number };
  failed_to_score: { total: number };
  biggest: { wins: { home: string; away: string }; loses: { home: string; away: string }; streak: { wins: number; draws: number; loses: number } };
  form: string;
}

interface StandingEntry {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string;
  form: string;
  status: string;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}

interface H2HFixture {
  fixture: { id: number; date: string };
  league: { name: string; logo: string };
  teams: { home: { id: number; name: string; logo: string; winner: boolean | null }; away: { id: number; name: string; logo: string; winner: boolean | null } };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}

interface Prediction {
  predictions: { winner: { id: number; name: string; comment: string } | null; win_or_draw: boolean; under_over: string | null; goals: { home: string; away: string }; advice: string | null; percent: { home: string; draw: string; away: string } };
  teams: { home: { id: number; name: string; logo: string; last_5: { form: string; att: string; def: string; goals: { for: { total: number; average: string }; against: { total: number; average: string } } } }; away: { id: number; name: string; logo: string; last_5: { form: string; att: string; def: string; goals: { for: { total: number; average: string }; against: { total: number; average: string } } } } };
  comparison: Record<string, { home: string; away: string }>;
  h2h: H2HFixture[];
}

export interface PreMatchData {
  standings: StandingEntry[] | null;
  homeStats: TeamStats | null;
  awayStats: TeamStats | null;
  h2h: H2HFixture[] | null;
  homeLastMatches: H2HFixture[] | null;
  awayLastMatches: H2HFixture[] | null;
  prediction: Prediction | null;
  fixtureInfo: { leagueId: number; season: number; homeTeamId: number; awayTeamId: number } | null;
}

async function apiCall(endpoint: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('api-football', {
    body: { endpoint, params }
  });
  if (error) throw error;
  return data;
}

export function usePreMatchAnalysis(fixtureId: string | undefined) {
  const [data, setData] = useState<PreMatchData>({
    standings: null, homeStats: null, awayStats: null,
    h2h: null, homeLastMatches: null, awayLastMatches: null,
    prediction: null, fixtureInfo: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!fixtureId) return;
    setLoading(true);
    setError(null);

    try {
      // Step 1: Get fixture info to extract league/season/teams
      const fixtureRes = await apiCall('fixtures', { id: fixtureId });
      const fixture = fixtureRes?.response?.[0];
      if (!fixture) throw new Error('Fixture não encontrada');

      const leagueId = fixture.league.id;
      const season = fixture.league.season;
      const homeTeamId = fixture.teams.home.id;
      const awayTeamId = fixture.teams.away.id;
      const info = { leagueId, season, homeTeamId, awayTeamId };

      // Step 2: Fetch all data in parallel
      const [standingsRes, homeStatsRes, awayStatsRes, h2hRes, homeLastRes, awayLastRes, predRes] = await Promise.allSettled([
        apiCall('standings', { league: leagueId, season }),
        apiCall('teams/statistics', { team: homeTeamId, season, league: leagueId }),
        apiCall('teams/statistics', { team: awayTeamId, season, league: leagueId }),
        apiCall('fixtures/headtohead', { h2h: `${homeTeamId}-${awayTeamId}`, last: 10 }),
        apiCall('fixtures', { team: homeTeamId, last: 20 }),
        apiCall('fixtures', { team: awayTeamId, last: 20 }),
        apiCall('predictions', { fixture: fixtureId }),
      ]);

      const getValue = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value : null;

      const standingsData = getValue(standingsRes);
      // standings response has nested array structure (e.g. groups in cups or divided leagues)
      let allStandings = null;
      if (standingsData?.response?.[0]?.league?.standings) {
        const groups = standingsData.response[0].league.standings;
        allStandings = groups.flat();
      }

      setData({
        standings: allStandings,
        homeStats: getValue(homeStatsRes)?.response || null,
        awayStats: getValue(awayStatsRes)?.response || null,
        h2h: getValue(h2hRes)?.response?.length ? getValue(h2hRes).response : (getValue(predRes)?.response?.[0]?.h2h || null),
        homeLastMatches: getValue(homeLastRes)?.response || null,
        awayLastMatches: getValue(awayLastRes)?.response || null,
        prediction: getValue(predRes)?.response?.[0] || null,
        fixtureInfo: info,
      });
    } catch (err) {
      console.error('[PreMatch] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar análise');
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}
