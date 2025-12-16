import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Game } from '@/types';
import { ApiFootballFixture, ApiFootballStatistic, ApiFootballEvent, parseStatistics } from './useApiFootball';

interface LiveGameStats {
  fixture: ApiFootballFixture | null;
  statistics: ReturnType<typeof parseStatistics> | null;
  events: ApiFootballEvent[];
  loading: boolean;
  error: string | null;
}

export function usePlanningLiveStats(games: Game[]) {
  const [statsMap, setStatsMap] = useState<Map<string, LiveGameStats>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Filter games that have api_fixture_id and are live or recent
  const linkedGames = games.filter(g => g.api_fixture_id);

  const fetchStatsForGame = useCallback(async (game: Game): Promise<LiveGameStats> => {
    if (!game.api_fixture_id) {
      return { fixture: null, statistics: null, events: [], loading: false, error: 'No fixture ID' };
    }

    try {
      // Fetch fixture details
      const { data: fixtureData } = await supabase.functions.invoke('api-football', {
        body: { endpoint: 'fixtures', params: { id: game.api_fixture_id } }
      });

      const fixture = fixtureData?.response?.[0] as ApiFootballFixture | undefined;
      
      if (!fixture) {
        return { fixture: null, statistics: null, events: [], loading: false, error: 'Fixture not found' };
      }

      // Check if game is live
      const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(fixture.fixture.status.short);

      // Only fetch detailed stats for live games
      if (isLive) {
        const [statsResponse, eventsResponse] = await Promise.all([
          supabase.functions.invoke('api-football', {
            body: { endpoint: 'fixtures/statistics', params: { fixture: game.api_fixture_id } }
          }),
          supabase.functions.invoke('api-football', {
            body: { endpoint: 'fixtures/events', params: { fixture: game.api_fixture_id } }
          })
        ]);

        const statistics = parseStatistics(statsResponse.data?.response || null);
        const events = (eventsResponse.data?.response || []) as ApiFootballEvent[];

        return { fixture, statistics, events, loading: false, error: null };
      }

      return { fixture, statistics: null, events: [], loading: false, error: null };
    } catch (error) {
      console.error('Error fetching stats for game:', game.id, error);
      return { fixture: null, statistics: null, events: [], loading: false, error: 'Failed to fetch' };
    }
  }, []);

  const fetchAllStats = useCallback(async () => {
    if (linkedGames.length === 0) return;

    const newStatsMap = new Map<string, LiveGameStats>();

    // Set loading state
    linkedGames.forEach(game => {
      const existing = statsMap.get(game.id);
      newStatsMap.set(game.id, { 
        ...existing,
        fixture: existing?.fixture || null,
        statistics: existing?.statistics || null,
        events: existing?.events || [],
        loading: true, 
        error: null 
      });
    });
    setStatsMap(new Map(newStatsMap));

    // Fetch stats for each game
    const results = await Promise.all(
      linkedGames.map(async (game) => {
        const stats = await fetchStatsForGame(game);
        return { gameId: game.id, stats };
      })
    );

    // Update with results
    results.forEach(({ gameId, stats }) => {
      newStatsMap.set(gameId, stats);
    });
    setStatsMap(new Map(newStatsMap));
  }, [linkedGames, fetchStatsForGame, statsMap]);

  // Initial fetch and interval setup
  useEffect(() => {
    fetchAllStats();

    // Determine refresh interval based on whether any games are live
    const hasLiveGames = linkedGames.some(g => g.status === 'Live');
    const refreshInterval = hasLiveGames ? 30000 : 300000; // 30s for live, 5min for others

    intervalRef.current = setInterval(fetchAllStats, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [linkedGames.map(g => g.id).join(','), linkedGames.some(g => g.status === 'Live')]);

  const getStatsForGame = (gameId: string): LiveGameStats | undefined => {
    return statsMap.get(gameId);
  };

  const refreshGame = async (gameId: string) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    const stats = await fetchStatsForGame(game);
    setStatsMap(prev => {
      const newMap = new Map(prev);
      newMap.set(gameId, stats);
      return newMap;
    });
  };

  return {
    getStatsForGame,
    refreshGame,
    refresh: fetchAllStats,
  };
}
