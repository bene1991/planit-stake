import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DominanceResult, MomentumTrend } from './useDominanceAnalysis';
import { FixtureCacheData } from './useFixtureCache';
import { LdiSnapshot } from './useLdiHistory';

// Only call AI every 3 minutes per game
const AI_REFRESH_INTERVAL = 3 * 60 * 1000;

interface UseLiveMomentAIResult {
  text: string | null;
  loading: boolean;
}

function calcTrendLabel(history: LdiSnapshot[]): { home: string; away: string } {
  if (history.length < 3) return { home: 'estável', away: 'estável' };
  const recent = history.slice(-5);
  const diff = recent[recent.length - 1].ldi - recent[0].ldi;
  const homeTrend = diff > 5 ? 'crescente' : diff < -5 ? 'em queda' : 'estável';
  const awayTrend = diff < -5 ? 'crescente' : diff > 5 ? 'em queda' : 'estável';
  return { home: homeTrend, away: awayTrend };
}

export function useLiveMomentAI(
  isLive: boolean,
  homeTeam: string,
  awayTeam: string,
  homeScore: number | null,
  awayScore: number | null,
  dominance: DominanceResult,
  fixtureCache: FixtureCacheData | null,
  ldiHistory: LdiSnapshot[]
): UseLiveMomentAIResult {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef<number>(0);
  const lastMinuteRef = useRef<number>(0);

  const fetchAnalysis = useCallback(async () => {
    if (!isLive || !fixtureCache?.normalized_stats || dominance.dataStatus === 'unavailable' || dominance.dataStatus === 'no_coverage') {
      return;
    }

    const now = Date.now();
    if (now - lastFetchRef.current < AI_REFRESH_INTERVAL) return;
    
    // Only fetch if minute advanced by at least 3
    const currentMinute = fixtureCache.minute_now || 0;
    if (lastMinuteRef.current > 0 && currentMinute - lastMinuteRef.current < 3) return;

    lastFetchRef.current = now;
    lastMinuteRef.current = currentMinute;
    setLoading(true);

    try {
      const trends = calcTrendLabel(ldiHistory);
      const stats = fixtureCache.normalized_stats;

      const { data, error } = await supabase.functions.invoke('analyze-live-moment', {
        body: {
          homeTeam,
          awayTeam,
          minute: currentMinute,
          homeScore: homeScore ?? 0,
          awayScore: awayScore ?? 0,
          homeLdi: dominance.homeLdi ?? 50,
          awayLdi: dominance.awayLdi ?? 50,
          homeTrend: trends.home,
          awayTrend: trends.away,
          possession: stats.home.possession,
          shotsOnHome: stats.home.shots_on,
          shotsOnAway: stats.away.shots_on,
          corners: (stats.home.corners + stats.away.corners),
        }
      });

      if (data?.text) {
        setText(data.text);
      }
    } catch (err) {
      console.warn('[useLiveMomentAI] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [isLive, homeTeam, awayTeam, homeScore, awayScore, dominance, fixtureCache, ldiHistory]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // Clear text when game is not live
  useEffect(() => {
    if (!isLive) setText(null);
  }, [isLive]);

  return { text, loading };
}
