import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Game } from '@/types';
import { ApiFootballFixture, ApiFootballEvent, parseStatistics } from './useApiFootball';
import { useApiRequestTracker } from './useApiRequestTracker';
import { format } from 'date-fns';

interface FixtureData {
  fixture: ApiFootballFixture;
  statistics: ReturnType<typeof parseStatistics> | null;
  events: ApiFootballEvent[];
}

interface LiveStatsState {
  fixtures: Map<number, FixtureData>;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

// Refresh interval in milliseconds (10 minutes)
const REFRESH_INTERVAL = 10 * 60 * 1000;

export function useOptimizedLiveStats(games: Game[]) {
  const [state, setState] = useState<LiveStatsState>({
    fixtures: new Map(),
    loading: false,
    error: null,
    lastRefresh: null,
  });
  
  const { trackRequest, canMakeRequest, remaining } = useApiRequestTracker();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoad = useRef(true);

  // Get unique dates from planned games
  const uniqueDates = [...new Set(games.map(g => g.date))];
  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch all fixtures for today with a single API call
  const fetchTodayFixtures = useCallback(async () => {
    if (!canMakeRequest) {
      setState(prev => ({ ...prev, error: 'Limite diário de requisições atingido' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Single API call for all fixtures of today
      const { data, error } = await supabase.functions.invoke('api-football', {
        body: { endpoint: 'fixtures', params: { date: today } }
      });

      if (error) throw error;

      // Track this single request
      trackRequest(1);

      const fixturesArray = (data?.response || []) as ApiFootballFixture[];
      const fixturesMap = new Map<number, FixtureData>();

      // Map fixtures by ID for quick lookup
      fixturesArray.forEach(fixture => {
        fixturesMap.set(fixture.fixture.id, {
          fixture,
          statistics: null, // Stats fetched on-demand
          events: [], // Events fetched on-demand
        });
      });

      setState({
        fixtures: fixturesMap,
        loading: false,
        error: null,
        lastRefresh: new Date(),
      });

    } catch (error) {
      console.error('Error fetching fixtures:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao buscar jogos',
      }));
    }
  }, [today, canMakeRequest, trackRequest]);

  // Fetch detailed stats for a specific game (on-demand)
  const fetchGameDetails = useCallback(async (fixtureId: number) => {
    if (!canMakeRequest) {
      return { success: false, error: 'Limite diário atingido' };
    }

    try {
      // Fetch stats and events in parallel (2 requests)
      const [statsResponse, eventsResponse] = await Promise.all([
        supabase.functions.invoke('api-football', {
          body: { endpoint: 'fixtures/statistics', params: { fixture: fixtureId } }
        }),
        supabase.functions.invoke('api-football', {
          body: { endpoint: 'fixtures/events', params: { fixture: fixtureId } }
        })
      ]);

      // Track these 2 requests
      trackRequest(2);

      const statistics = parseStatistics(statsResponse.data?.response || null);
      const events = (eventsResponse.data?.response || []) as ApiFootballEvent[];

      setState(prev => {
        const newFixtures = new Map(prev.fixtures);
        const existing = newFixtures.get(fixtureId);
        if (existing) {
          newFixtures.set(fixtureId, {
            ...existing,
            statistics,
            events,
          });
        }
        return { ...prev, fixtures: newFixtures };
      });

      return { success: true, statistics, events };
    } catch (error) {
      console.error('Error fetching game details:', error);
      return { success: false, error: 'Erro ao buscar estatísticas' };
    }
  }, [canMakeRequest, trackRequest]);

  // Get stats for a specific game by matching fixture ID or team names
  const getStatsForGame = useCallback((game: Game): FixtureData | null => {
    // Try to find by api_fixture_id first
    if (game.api_fixture_id) {
      const fixtureId = parseInt(game.api_fixture_id);
      const fixture = state.fixtures.get(fixtureId);
      if (fixture) return fixture;
    }

    // Otherwise, try to match by team names
    for (const [, fixtureData] of state.fixtures) {
      const homeMatch = fixtureData.fixture.teams.home.name.toLowerCase().includes(game.homeTeam.toLowerCase()) ||
                       game.homeTeam.toLowerCase().includes(fixtureData.fixture.teams.home.name.toLowerCase());
      const awayMatch = fixtureData.fixture.teams.away.name.toLowerCase().includes(game.awayTeam.toLowerCase()) ||
                       game.awayTeam.toLowerCase().includes(fixtureData.fixture.teams.away.name.toLowerCase());
      
      if (homeMatch && awayMatch) {
        return fixtureData;
      }
    }

    return null;
  }, [state.fixtures]);

  // Initial fetch
  useEffect(() => {
    if (isFirstLoad.current && games.length > 0) {
      isFirstLoad.current = false;
      fetchTodayFixtures();
    }
  }, [games.length, fetchTodayFixtures]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    if (games.length === 0) return;

    intervalRef.current = setInterval(() => {
      fetchTodayFixtures();
    }, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [games.length, fetchTodayFixtures]);

  return {
    getStatsForGame,
    fetchGameDetails,
    refresh: fetchTodayFixtures,
    loading: state.loading,
    error: state.error,
    lastRefresh: state.lastRefresh,
    apiRemaining: remaining,
  };
}
