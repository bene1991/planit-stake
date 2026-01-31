import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Game } from '@/types';

export interface LiveScoreEvent {
  minute: number;
  team: 'home' | 'away';
  type: string;
  player?: string;
  detail?: string;
}

export interface LiveScore {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  status: string;
  statusLong: string;
  homeTeamId?: number;
  awayTeamId?: number;
  events?: LiveScoreEvent[];
}

interface UseLiveScoresResult {
  scores: Map<string, LiveScore>;
  loading: boolean;
  error: string | null;
  lastRefresh: number | null;
  refresh: () => Promise<void>;
  getScoreForGame: (game: Game) => LiveScore | null;
}

// Callback for goal detection
export interface GoalDetectedCallback {
  (gameId: string, team: 'home' | 'away', homeScore: number, awayScore: number, game: Game): void;
}

// Refresh interval: 20 seconds when live games, 120 seconds when idle
const REFRESH_INTERVAL_ACTIVE = 20 * 1000;
const REFRESH_INTERVAL_IDLE = 120 * 1000;

// Minimum interval between calls (throttle protection)
const MIN_CALL_INTERVAL = 10 * 1000;

// Status codes that indicate a finished game
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO'];

export function useLiveScores(
  games: Game[], 
  onScorePersisted?: (gameId: string, homeScore: number, awayScore: number) => void,
  onGoalDetected?: GoalDetectedCallback
): UseLiveScoresResult {
  const [scores, setScores] = useState<Map<string, LiveScore>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const persistedScoresRef = useRef<Set<string>>(new Set());
  const lastCallTimeRef = useRef<number>(0);
  
  // Internal snapshot for goal detection - stores previous scores before update
  const previousScoresRef = useRef<Map<string, { homeScore: number; awayScore: number }>>(new Map());
  
  // Stable ref for fetchLiveScores to avoid useEffect dependency issues
  const fetchLiveScoresRef = useRef<(() => Promise<void>) | null>(null);
  
  // Get list of fixture IDs to monitor (live + pending)
  const fixtureIds = useMemo(() => {
    return games
      .filter(g => g.api_fixture_id && (g.status === 'Live' || g.status === 'Pending'))
      .map(g => g.api_fixture_id!);
  }, [games]);
  
  // Get games that are marked Finished but have no score in DB (need backfill)
  const gamesNeedingBackfill = useMemo(() => {
    return games.filter(g => 
      g.api_fixture_id && 
      g.status === 'Finished' && 
      (g.finalScoreHome === null || g.finalScoreHome === undefined ||
       g.finalScoreAway === null || g.finalScoreAway === undefined)
    );
  }, [games]);
  
  // Check if there are any games to monitor
  const hasGamesToMonitor = fixtureIds.length > 0 || gamesNeedingBackfill.length > 0;
  
  // Fetch all live fixtures in a single API call
  const fetchLiveScores = useCallback(async () => {
    // Throttle protection - prevent calls more frequent than MIN_CALL_INTERVAL
    const now = Date.now();
    if (now - lastCallTimeRef.current < MIN_CALL_INTERVAL) {
      console.warn('[useLiveScores] Throttled - called too soon, skipping');
      return;
    }
    
    if (isFetchingRef.current || !hasGamesToMonitor) return;
    
    lastCallTimeRef.current = now;
    isFetchingRef.current = true;
    setLoading(true);
    
    try {
      console.log('[useLiveScores] Fetching live=all...');
      
      const { data, error: fnError } = await supabase.functions.invoke('api-football', {
        body: {
          endpoint: 'fixtures',
          params: { live: 'all' }
        }
      });
      
      if (fnError) {
        console.error('[useLiveScores] Edge function error:', fnError);
        setError(fnError.message);
        return;
      }
      
      if (data?.errors && Object.keys(data.errors).length > 0) {
        console.error('[useLiveScores] API errors:', data.errors);
        setError(Object.values(data.errors).join(', '));
        return;
      }
      
      const fixtures = data?.response || [];
      console.log(`[useLiveScores] Got ${fixtures.length} live fixtures`);
      
      // Create a map of fixture ID -> live score data
      const newScores = new Map<string, LiveScore>();
      
      // Collect fixture IDs that need events fetched
      const fixturesWithGoals: { id: string; homeTeamId: number; awayTeamId: number }[] = [];
      
      for (const fixture of fixtures) {
        const fixtureId = fixture.fixture?.id?.toString();
        const status = fixture.fixture?.status?.short ?? 'NS';
        const homeGoals = fixture.goals?.home ?? 0;
        const awayGoals = fixture.goals?.away ?? 0;
        const homeTeamId = fixture.teams?.home?.id;
        const awayTeamId = fixture.teams?.away?.id;
        
        if (fixtureId && fixtureIds.includes(fixtureId)) {
          // Find the game for this fixture
          const game = games.find(g => g.api_fixture_id === fixtureId);
          
          // GOAL DETECTION: Compare with previous snapshot BEFORE updating
          if (game && onGoalDetected) {
            const previousScore = previousScoresRef.current.get(fixtureId);
            if (previousScore) {
              // Detect home goal
              if (homeGoals > previousScore.homeScore) {
                console.log(`[useLiveScores] 🎉 HOME GOAL DETECTED! ${game.homeTeam} scores! ${homeGoals}-${awayGoals}`);
                onGoalDetected(game.id, 'home', homeGoals, awayGoals, game);
              }
              // Detect away goal
              if (awayGoals > previousScore.awayScore) {
                console.log(`[useLiveScores] 🎉 AWAY GOAL DETECTED! ${game.awayTeam} scores! ${homeGoals}-${awayGoals}`);
                onGoalDetected(game.id, 'away', homeGoals, awayGoals, game);
              }
            }
            // Update previous snapshot for next comparison
            previousScoresRef.current.set(fixtureId, { homeScore: homeGoals, awayScore: awayGoals });
          }
          
          newScores.set(fixtureId, {
            fixtureId: parseInt(fixtureId),
            homeScore: homeGoals,
            awayScore: awayGoals,
            elapsed: fixture.fixture?.status?.elapsed ?? null,
            status: status,
            statusLong: fixture.fixture?.status?.long ?? 'Not Started',
            homeTeamId,
            awayTeamId,
          });
          
          // Track fixtures with goals for event fetching
          if ((homeGoals > 0 || awayGoals > 0) && homeTeamId && awayTeamId) {
            fixturesWithGoals.push({ id: fixtureId, homeTeamId, awayTeamId });
          }
          
          // Check if game just finished - persist final score
          if (FINISHED_STATUSES.includes(status)) {
            const game = games.find(g => g.api_fixture_id === fixtureId);
            if (game && !persistedScoresRef.current.has(game.id)) {
              // Mark as persisted immediately to avoid duplicates
              persistedScoresRef.current.add(game.id);
              
              console.log(`[useLiveScores] Persisting final score for ${game.homeTeam} vs ${game.awayTeam}: ${homeGoals}-${awayGoals}`);
              
              // Persist to database (fire and forget)
              supabase
                .from('games')
                .update({
                  final_score_home: homeGoals,
                  final_score_away: awayGoals,
                  status: 'Finished'
                })
                .eq('id', game.id)
                .then(({ error }) => {
                  if (error) {
                    console.error('[useLiveScores] Failed to persist score:', error);
                    // Remove from set to allow retry
                    persistedScoresRef.current.delete(game.id);
                  } else {
                    console.log(`[useLiveScores] Score persisted for game ${game.id}`);
                    // Notify parent to update local state
                    onScorePersisted?.(game.id, homeGoals, awayGoals);
                  }
                });
            }
          }
        }
      }
      
      // DISABLED: Fetching events for games with goals - saves ~540 credits/hour
      // The placar (score) is already shown from live=all response
      // Goal scorers are nice-to-have but not essential
      console.log(`[useLiveScores] Skipping event fetch for ${fixturesWithGoals.length} games with goals (API optimization)`);
      
      /* DISABLED TO SAVE API CREDITS
      for (const fixtureInfo of fixturesWithGoals.slice(0, 1)) {
        // ... event fetching code removed
      }
      */
      
      // DISABLED: Individual fetch for games that left live=all - saves credits
      // These games likely just finished but live=all should catch them on next cycle
      const liveGamesNotInResponse = games.filter(g => 
        g.api_fixture_id && 
        g.status === 'Live' && 
        !newScores.has(g.api_fixture_id) &&
        !persistedScoresRef.current.has(g.id)
      );
      
      if (liveGamesNotInResponse.length > 0) {
        console.log(`[useLiveScores] ${liveGamesNotInResponse.length} live games not in response - will retry next cycle (API optimization)`);
      }
      
      /* DISABLED TO SAVE API CREDITS - games will be caught on next live=all cycle or backfill
      for (const game of liveGamesNotInResponse.slice(0, 1)) {
        // ... individual fetch code removed
      }
      */
      
      // DISABLED: Fetching games starting soon - saves credits
      // These will appear in live=all once they actually start
      const pendingGames = games.filter(g => 
        g.api_fixture_id && 
        g.status === 'Pending' && 
        !newScores.has(g.api_fixture_id)
      );
      
      const now = new Date();
      const gamesStartingSoon = pendingGames.filter(g => {
        const gameTime = new Date(`${g.date}T${g.time}`);
        const diffMs = gameTime.getTime() - now.getTime();
        return diffMs > -60000 && diffMs < 5 * 60 * 1000;
      });
      
      if (gamesStartingSoon.length > 0) {
        console.log(`[useLiveScores] ${gamesStartingSoon.length} games starting soon - waiting for live=all (API optimization)`);
      }
      
      /* DISABLED TO SAVE API CREDITS - games will appear in live=all when they start
      for (const game of gamesStartingSoon.slice(0, 1)) {
        // ... fetch code removed
      }
      */
      
      // BACKFILL: Fetch scores for finished games that have no score in DB
      if (gamesNeedingBackfill.length > 0) {
        console.log(`[useLiveScores] Backfilling ${gamesNeedingBackfill.length} finished games without scores...`);
        
        for (const game of gamesNeedingBackfill.slice(0, 1)) {
          // Skip if already persisted this session
          if (persistedScoresRef.current.has(game.id)) continue;
          
          try {
            console.log(`[useLiveScores] Backfill: Fetching score for ${game.homeTeam} vs ${game.awayTeam}...`);
            
            const { data: fixtureData } = await supabase.functions.invoke('api-football', {
              body: {
                endpoint: 'fixtures',
                params: { id: game.api_fixture_id }
              }
            });
            
            const fixture = fixtureData?.response?.[0];
            if (fixture) {
              const homeGoals = fixture.goals?.home ?? 0;
              const awayGoals = fixture.goals?.away ?? 0;
              
              // Mark as persisted
              persistedScoresRef.current.add(game.id);
              
              console.log(`[useLiveScores] Backfill: Persisting ${game.homeTeam} ${homeGoals}-${awayGoals} ${game.awayTeam}`);
              
              // Persist to database
              const { error } = await supabase
                .from('games')
                .update({
                  final_score_home: homeGoals,
                  final_score_away: awayGoals,
                })
                .eq('id', game.id);
              
              if (error) {
                console.error('[useLiveScores] Backfill persist error:', error);
                persistedScoresRef.current.delete(game.id);
              } else {
                console.log(`[useLiveScores] Backfill: Score persisted for ${game.id}`);
                onScorePersisted?.(game.id, homeGoals, awayGoals);
              }
            }
          } catch (err) {
            console.warn(`[useLiveScores] Backfill failed for ${game.api_fixture_id}:`, err);
          }
        }
      }
      
      setScores(newScores);
      setLastRefresh(Date.now());
      setError(null);
      
      console.log(`[useLiveScores] Updated ${newScores.size} scores from ${fixtureIds.length} monitored games`);
      
    } catch (err) {
      console.error('[useLiveScores] Exception:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [hasGamesToMonitor, fixtureIds, games, gamesNeedingBackfill, onGoalDetected, onScorePersisted]);
  
  // Get score for a specific game
  const getScoreForGame = useCallback((game: Game): LiveScore | null => {
    if (!game.api_fixture_id) return null;
    return scores.get(game.api_fixture_id) || null;
  }, [scores]);
  
  // Keep fetchLiveScores ref updated (without triggering useEffect)
  useEffect(() => {
    fetchLiveScoresRef.current = fetchLiveScores;
  }, [fetchLiveScores]);
  
  // Start/stop interval based on whether there are games to monitor
  // CRITICAL: fetchLiveScores removed from deps to prevent infinite loop!
  useEffect(() => {
    // Determine refresh interval based on active live games
    const hasLiveGames = games.some(g => g.status === 'Live');
    const refreshInterval = hasLiveGames ? REFRESH_INTERVAL_ACTIVE : REFRESH_INTERVAL_IDLE;
    
    if (hasGamesToMonitor) {
      console.log(`[useLiveScores] Starting ${refreshInterval/1000}s interval for ${fixtureIds.length} games (${hasLiveGames ? 'ACTIVE' : 'IDLE'} mode)`);
      
      // Fetch immediately using ref
      fetchLiveScoresRef.current?.();
      
      // Dynamic interval based on live games
      intervalRef.current = setInterval(() => {
        fetchLiveScoresRef.current?.();
      }, refreshInterval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // No games to monitor, clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    // REMOVED: fetchLiveScores from dependencies to prevent race condition!
  }, [hasGamesToMonitor, fixtureIds.length, games]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  return {
    scores,
    loading,
    error,
    lastRefresh,
    refresh: fetchLiveScores,
    getScoreForGame,
  };
}
