import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Cache global para fixtures por data (evita requests duplicados)
interface CacheEntry<T> {
  data: T[];
  timestamp: number;
}
const fixturesCache = new Map<string, CacheEntry<unknown>>();
const FIXTURES_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// API-Football Response Types
export interface ApiFootballFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string | null;
      city: string | null;
    };
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
  events?: ApiFootballEvent[];
}

export interface ApiFootballEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number;
    name: string;
  };
  assist: {
    id: number | null;
    name: string | null;
  };
  type: string;
  detail: string;
  comments: string | null;
}

export interface ApiFootballStatistic {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  statistics: Array<{
    type: string;
    value: number | string | null;
  }>;
}

export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string>;
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
  _cached?: boolean;
}

// Generic hook for API-Football requests
export function useApiFootball<T>(
  endpoint: string,
  params: Record<string, unknown> = {},
  options: {
    enabled?: boolean;
    refetchInterval?: number;
  } = {}
) {
  const { enabled = true, refetchInterval } = options;
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data: response, error: invokeError } = await supabase.functions.invoke('api-football', {
        body: { endpoint, params }
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      const apiResponse = response as ApiFootballResponse<T>;
      
      if (apiResponse.errors && Object.keys(apiResponse.errors).length > 0) {
        const errorMsg = Object.values(apiResponse.errors).join(', ');
        console.warn('API-Football errors:', errorMsg);
      }

      setData(apiResponse.response);
      setCached(apiResponse._cached || false);
    } catch (err) {
      console.error('Error fetching from API-Football:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [endpoint, JSON.stringify(params), enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;
    
    const interval = setInterval(fetchData, refetchInterval);
    return () => clearInterval(interval);
  }, [fetchData, refetchInterval, enabled]);

  return { data, loading, error, refetch: fetchData, cached };
}

// Specialized hooks

export function useLiveFixtures(refetchInterval = 30000) {
  return useApiFootball<ApiFootballFixture>('fixtures', { live: 'all' }, { refetchInterval });
}

export function useFixturesByDate(date: string, enabled = true) {
  const [data, setData] = useState<ApiFootballFixture[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const pendingRequest = useRef<Promise<void> | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled || !date) return;

    const cacheKey = `fixtures-${date}`;
    const cachedEntry = fixturesCache.get(cacheKey) as CacheEntry<ApiFootballFixture> | undefined;
    
    // Verificar cache válido
    if (cachedEntry && Date.now() - cachedEntry.timestamp < FIXTURES_CACHE_TTL) {
      setData(cachedEntry.data);
      setCached(true);
      setLoading(false);
      return;
    }

    // Evitar requests duplicados para mesma data
    if (pendingRequest.current) {
      await pendingRequest.current;
      return;
    }

    setLoading(true);
    setError(null);
    setCached(false);

    const requestPromise = (async () => {
      try {
        const { data: response, error: invokeError } = await supabase.functions.invoke('api-football', {
          body: { endpoint: 'fixtures', params: { date } }
        });

        if (invokeError) {
          throw new Error(invokeError.message);
        }

        const apiResponse = response as { response: ApiFootballFixture[]; errors?: Record<string, string> };
        
        if (apiResponse.errors && Object.keys(apiResponse.errors).length > 0) {
          console.warn('API-Football errors:', Object.values(apiResponse.errors).join(', '));
        }

        // Salvar no cache
        fixturesCache.set(cacheKey, {
          data: apiResponse.response,
          timestamp: Date.now()
        });

        setData(apiResponse.response);
      } catch (err) {
        console.error('Error fetching fixtures:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
        pendingRequest.current = null;
      }
    })();

    pendingRequest.current = requestPromise;
    await requestPromise;
  }, [date, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, cached };
}

export function useFixture(fixtureId: number | string | undefined, refetchInterval?: number) {
  return useApiFootball<ApiFootballFixture>(
    'fixtures',
    { id: fixtureId },
    { enabled: !!fixtureId, refetchInterval }
  );
}

export function useFixtureStatistics(fixtureId: number | string | undefined, refetchInterval?: number) {
  return useApiFootball<ApiFootballStatistic>(
    'fixtures/statistics',
    { fixture: fixtureId },
    { enabled: !!fixtureId, refetchInterval }
  );
}

export function useFixtureEvents(fixtureId: number | string | undefined, refetchInterval?: number) {
  return useApiFootball<ApiFootballEvent>(
    'fixtures/events',
    { fixture: fixtureId },
    { enabled: !!fixtureId, refetchInterval }
  );
}

// Helper to parse statistics
export function parseStatistics(stats: ApiFootballStatistic[] | null) {
  if (!stats || stats.length < 2) return null;

  const home = stats[0];
  const away = stats[1];

  const getStat = (team: ApiFootballStatistic, type: string): number => {
    const stat = team.statistics.find(s => s.type === type);
    if (!stat?.value) return 0;
    if (typeof stat.value === 'string') {
      return parseInt(stat.value.replace('%', ''), 10) || 0;
    }
    return stat.value;
  };

  return {
    homePossession: getStat(home, 'Ball Possession'),
    awayPossession: getStat(away, 'Ball Possession'),
    homeShots: getStat(home, 'Total Shots'),
    awayShots: getStat(away, 'Total Shots'),
    homeShotsOnTarget: getStat(home, 'Shots on Goal'),
    awayShotsOnTarget: getStat(away, 'Shots on Goal'),
    homeCorners: getStat(home, 'Corner Kicks'),
    awayCorners: getStat(away, 'Corner Kicks'),
    homeFouls: getStat(home, 'Fouls'),
    awayFouls: getStat(away, 'Fouls'),
    homeYellowCards: getStat(home, 'Yellow Cards'),
    awayYellowCards: getStat(away, 'Yellow Cards'),
    homeRedCards: getStat(home, 'Red Cards'),
    awayRedCards: getStat(away, 'Red Cards'),
    homeOffsides: getStat(home, 'Offsides'),
    awayOffsides: getStat(away, 'Offsides'),
  };
}

// Helper to get status display info
export function getStatusDisplay(status: ApiFootballFixture['fixture']['status']) {
  const statusMap: Record<string, { label: string; color: string; isLive: boolean }> = {
    'TBD': { label: 'A definir', color: 'gray', isLive: false },
    'NS': { label: 'Não iniciado', color: 'gray', isLive: false },
    '1H': { label: '1º Tempo', color: 'green', isLive: true },
    'HT': { label: 'Intervalo', color: 'yellow', isLive: true },
    '2H': { label: '2º Tempo', color: 'green', isLive: true },
    'ET': { label: 'Prorrogação', color: 'orange', isLive: true },
    'BT': { label: 'Intervalo Prorr.', color: 'yellow', isLive: true },
    'P': { label: 'Pênaltis', color: 'red', isLive: true },
    'SUSP': { label: 'Suspenso', color: 'red', isLive: false },
    'INT': { label: 'Interrompido', color: 'red', isLive: true },
    'FT': { label: 'Encerrado', color: 'gray', isLive: false },
    'AET': { label: 'Enc. Prorrogação', color: 'gray', isLive: false },
    'PEN': { label: 'Enc. Pênaltis', color: 'gray', isLive: false },
    'PST': { label: 'Adiado', color: 'orange', isLive: false },
    'CANC': { label: 'Cancelado', color: 'red', isLive: false },
    'ABD': { label: 'Abandonado', color: 'red', isLive: false },
    'AWD': { label: 'W.O.', color: 'gray', isLive: false },
    'WO': { label: 'W.O.', color: 'gray', isLive: false },
    'LIVE': { label: 'Ao Vivo', color: 'green', isLive: true },
  };

  return statusMap[status.short] || { label: status.long, color: 'gray', isLive: false };
}
