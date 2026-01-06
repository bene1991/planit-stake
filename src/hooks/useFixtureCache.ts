import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

// Status codes that indicate a live game
const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'LIVE'];

// Refresh interval for live games (1 minute)
const LIVE_REFRESH_INTERVAL = 60000;

export function useFixtureCache(fixtureId: number | string | null | undefined): UseFixtureCacheResult {
  const [data, setData] = useState<FixtureCacheData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!fixtureId) return;

    const fixtureIdNum = parseInt(String(fixtureId), 10);
    if (isNaN(fixtureIdNum)) return;

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('get-fixture-details', {
        body: { fixture_id: fixtureIdNum },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to fetch fixture details');
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      setData(result as FixtureCacheData);
    } catch (err) {
      console.error('useFixtureCache error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  const refetch = useCallback(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Initial fetch
  useEffect(() => {
    if (fixtureId) {
      fetchDetails();
    }
  }, [fixtureId, fetchDetails]);

  // Auto-refresh for live games
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (data && LIVE_STATUSES.includes(data.status)) {
      intervalRef.current = setInterval(() => {
        fetchDetails();
      }, LIVE_REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [data?.status, fetchDetails]);

  return { data, loading, error, refetch };
}