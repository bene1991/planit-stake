import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Game, GoalEvent } from '@/types';
import { ApiFootballFixture, ApiFootballEvent, parseStatistics, fixturesCache, FIXTURES_CACHE_TTL } from './useApiFootball';
import { useApiRequestTracker } from './useApiRequestTracker';
import { format } from 'date-fns';

interface FixtureData {
  fixture: ApiFootballFixture;
  statistics: ReturnType<typeof parseStatistics> | null;
  events: ApiFootballEvent[];
}

interface CachedDetails {
  statistics: ReturnType<typeof parseStatistics> | null;
  events: ApiFootballEvent[];
  timestamp: number;
  goalsSnapshot: { home: number; away: number };
}

interface LiveStatsState {
  fixtures: Map<number, FixtureData>;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

// Refresh interval in milliseconds (10 minutes)
const REFRESH_INTERVAL = 10 * 60 * 1000;
// Cache TTL for detailed stats (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;
// Live game statuses that need event fetching
const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'LIVE', 'BT', 'P'];
// Finished game statuses that don't need refresh
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST'];
// Statuses where we should persist goals
const PERSIST_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO'];

// Convert API events to GoalEvent format for storage
const convertToGoalEvents = (events: ApiFootballEvent[]): GoalEvent[] => {
  return events
    .filter(e => e.type === 'Goal')
    .map(e => ({
      teamId: e.team?.id || 0,
      playerName: e.player?.name || 'Unknown',
      minute: e.time?.elapsed || 0,
      detail: e.detail,
    }));
};

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
  // Cache for detailed stats with TTL
  const detailsCache = useRef<Map<number, CachedDetails>>(new Map());
  // Track pending requests to avoid duplicates
  const pendingRequests = useRef<Set<number>>(new Set());
  // Track pending date fetches to avoid duplicate calls
  const isFetchingDates = useRef(false);
  // Track auto-fetched fixtures to avoid duplicate fetches
  const autoFetchedRef = useRef<Set<number>>(new Set());
  // Track games where we've already persisted goals
  const persistedGoalsRef = useRef<Set<string>>(new Set());
  // Track pending persistence operations
  const pendingPersistenceRef = useRef<Set<string>>(new Set());

  // Priorizar datas de jogos pendentes (com operações sem resultado)
  const today = format(new Date(), 'yyyy-MM-dd');
  const pendingGames = games.filter(g => g.methodOperations.some(op => !op.result));
  const pendingDates = [...new Set(pendingGames.map(g => g.date))].sort().reverse(); // Mais recentes primeiro
  
  // Garantir que a data de hoje está incluída se houver jogos, e priorizar jogos pendentes
  const uniqueDates = [...new Set([today, ...pendingDates])].filter(d => 
    games.some(g => g.date === d)
  ).slice(0, 3);
  
  console.log('[OptimizedLiveStats] Datas priorizadas:', uniqueDates, 'Jogos pendentes:', pendingGames.length);

  // Check if cache is still valid
  const isCacheValid = useCallback((fixtureId: number): boolean => {
    const cached = detailsCache.current.get(fixtureId);
    if (!cached) return false;
    return Date.now() - cached.timestamp < CACHE_TTL;
  }, []);

  // Get cached details
  const getCachedDetails = useCallback((fixtureId: number): CachedDetails | null => {
    if (isCacheValid(fixtureId)) {
      return detailsCache.current.get(fixtureId) || null;
    }
    return null;
  }, [isCacheValid]);

  // Check if a fixture is finished
  const isFinished = useCallback((fixture: ApiFootballFixture): boolean => {
    return FINISHED_STATUSES.includes(fixture.fixture.status.short);
  }, []);

  // Fetch fixtures for multiple dates with single calls per date
  const fetchFixturesForDates = useCallback(async (forceNoCache = false) => {
    // Evitar chamadas duplicadas
    if (isFetchingDates.current) {
      console.log('[OptimizedLiveStats] Fetch já em andamento, ignorando');
      return;
    }

    if (uniqueDates.length === 0) {
      return;
    }

    // Se forceNoCache, limpar cache das datas que vamos buscar e também o autoFetchedRef
    if (forceNoCache) {
      console.log('[OptimizedLiveStats] Forçando refresh sem cache - limpando cache e autoFetchedRef');
      autoFetchedRef.current.clear(); // Permite re-buscar detalhes
      detailsCache.current.clear(); // Limpa cache de detalhes
      uniqueDates.forEach(date => {
        const cacheKey = `fixtures-${date}`;
        fixturesCache.delete(cacheKey);
      });
    }

    isFetchingDates.current = true;
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const allFixtures = new Map<number, FixtureData>();
      
      // Fetch fixtures for each unique date (1 request per date)
      for (const date of uniqueDates) {
        const cacheKey = `fixtures-${date}`;
        const cachedEntry = fixturesCache.get(cacheKey);
        
        // Verificar cache compartilhado ANTES de fazer request (skip se forceNoCache)
        if (!forceNoCache && cachedEntry && Date.now() - cachedEntry.timestamp < FIXTURES_CACHE_TTL) {
          console.log(`[OptimizedLiveStats] Cache HIT para ${date} - usando dados existentes`);
          
          // Usar dados do cache
          cachedEntry.data.forEach(fixture => {
            const cached = getCachedDetails(fixture.fixture.id);
            allFixtures.set(fixture.fixture.id, {
              fixture,
              statistics: cached?.statistics || null,
              events: cached?.events || [],
            });
          });
          continue; // Pula para próxima data
        }
        
        // Cache miss ou forceNoCache - fazer request
        // Não bloqueia mais - a própria API retorna erro se limite for atingido
        
        console.log(`[OptimizedLiveStats] ${forceNoCache ? 'Force refresh' : 'Cache MISS'} para ${date} - fazendo request`);
        
        const { data, error } = await supabase.functions.invoke('api-football', {
          body: { endpoint: 'fixtures', params: { date } }
        });

        if (error) {
          console.error(`[OptimizedLiveStats] Erro ao buscar ${date}:`, error);
          continue;
        }

        // Track this single request
        trackRequest(1);
        console.log(`[OptimizedLiveStats] Request feito para ${date}! Créditos restantes: ${remaining - 1}`);

        const fixturesArray = (data?.response || []) as ApiFootballFixture[];

        // Salvar no cache compartilhado
        fixturesCache.set(cacheKey, {
          data: fixturesArray,
          timestamp: Date.now()
        });

        // Map fixtures by ID
        fixturesArray.forEach(fixture => {
          const cached = getCachedDetails(fixture.fixture.id);
          
          allFixtures.set(fixture.fixture.id, {
            fixture,
            statistics: cached?.statistics || null,
            events: cached?.events || [],
          });
        });
      }

      setState({
        fixtures: allFixtures,
        loading: false,
        error: null,
        lastRefresh: new Date(),
      });

    } catch (error) {
      console.error('[OptimizedLiveStats] Erro ao buscar fixtures:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao buscar jogos',
      }));
    } finally {
      isFetchingDates.current = false;
    }
  }, [uniqueDates, canMakeRequest, trackRequest, getCachedDetails, remaining]);

  // Fetch detailed stats for a specific game (on-demand) with caching
  const fetchGameDetails = useCallback(async (fixtureId: number) => {
    // Get current goals from state to compare with cache
    const currentFixture = state.fixtures.get(fixtureId);
    const currentGoals = {
      home: currentFixture?.fixture.goals?.home ?? 0,
      away: currentFixture?.fixture.goals?.away ?? 0,
    };
    const currentTotalGoals = currentGoals.home + currentGoals.away;

    // Check cache first
    const cached = detailsCache.current.get(fixtureId);
    const cacheValid = cached && Date.now() - cached.timestamp < CACHE_TTL;

    if (cacheValid && cached) {
      // Invalidate cache if goals changed
      const cachedTotalGoals = cached.goalsSnapshot.home + cached.goalsSnapshot.away;
      const goalsChanged = currentTotalGoals !== cachedTotalGoals;
      
      // Also invalidate if there are goals but no goal events in cache
      const hasGoalEvents = cached.events.some(e => e.type === 'Goal');
      const needsGoalEvents = currentTotalGoals > 0 && !hasGoalEvents;

      if (goalsChanged || needsGoalEvents) {
        console.log(`[fetchGameDetails] Cache invalidado para ${fixtureId}: goalsChanged=${goalsChanged}, needsGoalEvents=${needsGoalEvents}`);
        detailsCache.current.delete(fixtureId);
        autoFetchedRef.current.delete(fixtureId);
      } else {
        console.log(`Using cached stats for fixture ${fixtureId}`);
        // Update state with cached data
        setState(prev => {
          const newFixtures = new Map(prev.fixtures);
          const existing = newFixtures.get(fixtureId);
          if (existing) {
            newFixtures.set(fixtureId, {
              ...existing,
              statistics: cached.statistics,
              events: cached.events,
            });
          }
          return { ...prev, fixtures: newFixtures };
        });
        return { success: true, statistics: cached.statistics, events: cached.events };
      }
    }

    // Prevent duplicate requests
    if (pendingRequests.current.has(fixtureId)) {
      console.log(`Request already pending for fixture ${fixtureId}`);
      return { success: false, error: 'Requisição em andamento' };
    }

    pendingRequests.current.add(fixtureId);

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

      // Cache the results with goals snapshot
      detailsCache.current.set(fixtureId, {
        statistics,
        events,
        timestamp: Date.now(),
        goalsSnapshot: currentGoals,
      });

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
    } finally {
      pendingRequests.current.delete(fixtureId);
    }
  }, [state.fixtures, trackRequest]);

  // Get stats for a specific game by matching fixture ID or team names
  const getStatsForGame = useCallback((game: Game): FixtureData | null => {
    // Try to find by api_fixture_id first
    if (game.api_fixture_id) {
      const fixtureId = parseInt(game.api_fixture_id);
      const fixture = state.fixtures.get(fixtureId);
      console.log(`[getStatsForGame] ${game.homeTeam} vs ${game.awayTeam} - api_fixture_id: ${fixtureId}, found: ${!!fixture}`);
      if (fixture) return fixture;
    }

    // Otherwise, try to match by team names
    for (const [id, fixtureData] of state.fixtures) {
      const homeMatch = fixtureData.fixture.teams.home.name.toLowerCase().includes(game.homeTeam.toLowerCase()) ||
                       game.homeTeam.toLowerCase().includes(fixtureData.fixture.teams.home.name.toLowerCase());
      const awayMatch = fixtureData.fixture.teams.away.name.toLowerCase().includes(game.awayTeam.toLowerCase()) ||
                       game.awayTeam.toLowerCase().includes(fixtureData.fixture.teams.away.name.toLowerCase());
      
      if (homeMatch && awayMatch) {
        console.log(`[getStatsForGame] ${game.homeTeam} vs ${game.awayTeam} - matched by name, fixtureId: ${id}`);
        return fixtureData;
      }
    }

    console.log(`[getStatsForGame] ${game.homeTeam} vs ${game.awayTeam} - NOT FOUND, fixtures count: ${state.fixtures.size}`);
    return null;
  }, [state.fixtures]);

  // Refresh only live games (exclude finished ones)
  const refreshLiveGames = useCallback(async () => {
    // Filter games that are not finished
    const liveGames = games.filter(game => {
      if (!game.api_fixture_id) return true; // Include games without fixture ID
      const fixtureId = parseInt(game.api_fixture_id);
      const fixture = state.fixtures.get(fixtureId);
      if (!fixture) return true;
      return !isFinished(fixture.fixture);
    });

    // If all games are finished, skip refresh
    if (liveGames.length === 0) {
      console.log('All games finished, skipping refresh');
      return;
    }

    await fetchFixturesForDates();
  }, [games, state.fixtures, isFinished, fetchFixturesForDates]);

  // Initial fetch
  useEffect(() => {
    if (isFirstLoad.current && games.length > 0) {
      isFirstLoad.current = false;
      fetchFixturesForDates();
    }
  }, [games.length, fetchFixturesForDates]);

  // Auto-refresh every 10 minutes (only for live games)
  useEffect(() => {
    if (games.length === 0) return;

    intervalRef.current = setInterval(() => {
      refreshLiveGames();
    }, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [games.length, refreshLiveGames]);

  // Buscar eventos automaticamente APENAS para jogos do PLANEJAMENTO (pendentes) que estejam AO VIVO e com gols
  useEffect(() => {
    if (state.fixtures.size === 0) return;

    const planningLiveFixtureIds = new Set(
      pendingGames
        .map(g => (g.api_fixture_id ? parseInt(g.api_fixture_id) : null))
        .filter((id): id is number => typeof id === 'number' && !Number.isNaN(id))
    );

    const fixturesNeedingData: number[] = [];

    state.fixtures.forEach((data, fixtureId) => {
      if (!planningLiveFixtureIds.has(fixtureId)) return;

      const status = data.fixture.fixture.status.short;
      const isLive = LIVE_STATUSES.includes(status);
      if (!isLive) return;

      const hasEvents = data.events && data.events.length > 0;
      const alreadyFetched = autoFetchedRef.current.has(fixtureId);

      const homeGoals = data.fixture.goals?.home ?? 0;
      const awayGoals = data.fixture.goals?.away ?? 0;
      const hasGoals = homeGoals > 0 || awayGoals > 0;

      if (hasGoals && !hasEvents && !alreadyFetched) {
        fixturesNeedingData.push(fixtureId);
      }
    });

    if (fixturesNeedingData.length > 0) {
      console.log('[OptimizedLiveStats] Buscando eventos (planejamento+ao vivo):', fixturesNeedingData);

      fixturesNeedingData.slice(0, 5).forEach(id => {
        autoFetchedRef.current.add(id);
      });

      fixturesNeedingData.slice(0, 5).forEach(id => {
        fetchGameDetails(id);
      });
    }
  }, [state.lastRefresh, pendingGames.length, fetchGameDetails]);

  // Persist goals for finished games that have goals but no persisted goalEvents
  const persistGoalsForGame = useCallback(async (game: Game, fixtureData: FixtureData) => {
    // Skip if no fixture ID
    if (!game.api_fixture_id) return;
    
    // Skip if already has persisted goals
    if (game.goalEvents && game.goalEvents.length > 0) {
      persistedGoalsRef.current.add(game.id);
      return;
    }
    
    // Skip if already persisted or pending
    if (persistedGoalsRef.current.has(game.id) || pendingPersistenceRef.current.has(game.id)) {
      return;
    }

    const status = fixtureData.fixture.fixture.status.short;
    const isFinished = PERSIST_STATUSES.includes(status);
    if (!isFinished) return;

    const homeGoals = fixtureData.fixture.goals?.home ?? 0;
    const awayGoals = fixtureData.fixture.goals?.away ?? 0;
    const hasGoals = homeGoals > 0 || awayGoals > 0;
    
    // Only persist if there are goals or we have events
    const hasEventsInMemory = fixtureData.events && fixtureData.events.some(e => e.type === 'Goal');
    if (!hasGoals && !hasEventsInMemory) {
      // Mark as persisted even without goals to avoid re-checking
      persistedGoalsRef.current.add(game.id);
      return;
    }

    pendingPersistenceRef.current.add(game.id);

    try {
      let goalEvents: GoalEvent[] = [];
      
      // If we already have events in memory, use those
      if (fixtureData.events && fixtureData.events.length > 0) {
        goalEvents = convertToGoalEvents(fixtureData.events);
      } else {
        // Otherwise fetch events from API
        console.log(`[GoalPersistence] Fetching events for game ${game.id}, fixture ${game.api_fixture_id}`);
        
        const { data, error } = await supabase.functions.invoke('api-football', {
          body: { endpoint: 'fixtures/events', params: { fixture: parseInt(game.api_fixture_id) } }
        });

        if (error) {
          console.error(`[GoalPersistence] Error fetching events:`, error);
          return;
        }

        trackRequest(1);
        const events = (data?.response || []) as ApiFootballEvent[];
        goalEvents = convertToGoalEvents(events);
      }

      // Persist to database
      const updates: Record<string, unknown> = {
        goal_events: goalEvents,
        final_score_home: homeGoals,
        final_score_away: awayGoals,
      };

      const { error: updateError } = await supabase
        .from('games')
        .update(updates)
        .eq('id', game.id);

      if (updateError) {
        console.error(`[GoalPersistence] Error persisting goals for ${game.id}:`, updateError);
        return;
      }

      persistedGoalsRef.current.add(game.id);
      console.log(`[GoalPersistence] Successfully persisted ${goalEvents.length} goals for game ${game.id} (${game.homeTeam} vs ${game.awayTeam})`);
    } catch (err) {
      console.error(`[GoalPersistence] Exception:`, err);
    } finally {
      pendingPersistenceRef.current.delete(game.id);
    }
  }, [trackRequest]);

  // Auto-persist goals for finished games in planning
  useEffect(() => {
    if (state.fixtures.size === 0 || pendingGames.length === 0) return;

    // Check each pending game for goal persistence
    pendingGames.forEach(game => {
      if (!game.api_fixture_id) return;
      
      const fixtureId = parseInt(game.api_fixture_id);
      const fixtureData = state.fixtures.get(fixtureId);
      
      if (fixtureData) {
        persistGoalsForGame(game, fixtureData);
      }
    });
  }, [state.fixtures, pendingGames, persistGoalsForGame]);

  // Force refresh a specific fixture by ID (for manual refresh button)
  const forceRefreshFixture = useCallback(async (fixtureId: number): Promise<ApiFootballFixture | null> => {
    console.log(`[forceRefreshFixture] Buscando fixture ${fixtureId}`);
    
    // Não bloqueia - a API retorna erro se limite for atingido

    try {
      const { data, error } = await supabase.functions.invoke('api-football', {
        body: { endpoint: 'fixtures', params: { id: fixtureId } }
      });

      if (error) {
        console.error('[forceRefreshFixture] Erro:', error);
        return null;
      }

      trackRequest(1);
      console.log(`[forceRefreshFixture] Request feito! Créditos restantes: ${remaining - 1}`);

      const fixture = data?.response?.[0] as ApiFootballFixture;
      if (!fixture) {
        console.log('[forceRefreshFixture] Fixture não encontrada na resposta');
        return null;
      }

      // Update state with the fetched fixture
      const cached = getCachedDetails(fixtureId);
      setState(prev => {
        const newFixtures = new Map(prev.fixtures);
        newFixtures.set(fixtureId, {
          fixture,
          statistics: cached?.statistics || null,
          events: cached?.events || [],
        });
        return { ...prev, fixtures: newFixtures, lastRefresh: new Date() };
      });

      return fixture;
    } catch (err) {
      console.error('[forceRefreshFixture] Exception:', err);
      return null;
    }
  }, [canMakeRequest, trackRequest, remaining, getCachedDetails]);

  return {
    getStatsForGame,
    fetchGameDetails,
    forceRefreshFixture,
    refresh: fetchFixturesForDates,
    loading: state.loading,
    error: state.error,
    lastRefresh: state.lastRefresh,
    apiRemaining: remaining,
  };
}
