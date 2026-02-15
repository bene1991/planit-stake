import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Global deduplication map - shared across all hook instances
const pendingFixtureRequests = new Map<number, Promise<any>>();

export interface NormalizedStats {
  home: StatValues;
  away: StatValues;
}

export interface StatValues {
  possession: number;
  shots_total: number;
  shots_on: number;
  shots_off: number;
  shots_blocked: number;
  corners: number;
  fouls: number;
  yellow: number;
  red: number;
  offsides: number;
}

export interface MomentumPoint {
  m: number;
  home: number;
  away: number;
}

export interface KeyEvent {
  minute: number;
  team: 'home' | 'away';
  type: 'goal' | 'shot_on' | 'red_card';
  player?: string;
  detail?: string;
}

export interface FixtureCacheData {
  fixture_id: number;
  status: string;
  minute_now: number;
  normalized_stats: NormalizedStats;
  momentum_series: MomentumPoint[];
  key_events: KeyEvent[];
  cached: boolean;
}

interface UseFixtureCacheResult {
  data: FixtureCacheData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'INT'];

export function useFixtureCache(fixtureId: number | string | null | undefined, autoFetch: boolean = true, globalPaused: boolean = false, invalidateSignal?: number): UseFixtureCacheResult {
  const [data, setData] = useState<FixtureCacheData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<string | undefined>(undefined);

  const fetchDetails = useCallback(async (skipCache = false) => {
    if (!fixtureId) return;

    const fixtureIdNum = parseInt(String(fixtureId), 10);
    if (isNaN(fixtureIdNum)) return;

    setLoading(true);
    setError(null);

    try {
      // Global deduplication: reuse in-flight request for the same fixture
      let resultPromise = pendingFixtureRequests.get(fixtureIdNum);
      
      if (!resultPromise || skipCache) {
        resultPromise = supabase.functions.invoke('get-fixture-details', {
          body: { fixture_id: fixtureIdNum, skip_cache: skipCache },
        }).then(({ data: result, error: fnError }) => {
          if (fnError) throw new Error(fnError.message || 'Failed to fetch fixture details');
          if (result?.error && result.error !== 'Fixture not found in API') throw new Error(result.error);
          return result;
        }).finally(() => {
          pendingFixtureRequests.delete(fixtureIdNum);
        });
        
        pendingFixtureRequests.set(fixtureIdNum, resultPromise);
      }
      
      const result = await resultPromise;
      setData(result as FixtureCacheData);
      statusRef.current = (result as FixtureCacheData)?.status;
      setLoading(false);
    } catch (err) {
      console.error(`[useFixtureCache] Erro:`, err);
      // NO RETRY - wait for next natural 120s cycle instead of tripling consumption
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, [fixtureId]);

  const refetch = useCallback(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Initial fetch (only if autoFetch is enabled and not globally paused)
  useEffect(() => {
    if (fixtureId && autoFetch && !globalPaused) {
      fetchDetails();
    }
  }, [fixtureId, fetchDetails, autoFetch, globalPaused]);

  // Invalidate signal: when a goal is detected, force immediate refetch skipping cache
  useEffect(() => {
    if (invalidateSignal && fixtureId && autoFetch) {
      console.log(`[useFixtureCache] Goal signal received for fixture ${fixtureId}, forcing fresh fetch`);
      fetchDetails(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidateSignal]);

  // Auto-refresh every 120s for live games (backend has 90s cache)
  useEffect(() => {
    if (!fixtureId || !autoFetch || globalPaused) return;

    const REFRESH_INTERVAL = 120_000;
    const interval = setInterval(() => {
      const currentStatus = statusRef.current;
      if (!currentStatus || !FINISHED_STATUSES.includes(currentStatus)) {
        fetchDetails();
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fixtureId, autoFetch, globalPaused, fetchDetails]);

  return { data, loading, error, refetch };
}