import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Game } from '@/types';

interface LiveScore {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  status: string;
  statusLong: string;
}

interface UseLiveScoresResult {
  scores: Map<string, LiveScore>;
  loading: boolean;
  error: string | null;
  lastRefresh: number | null;
  refresh: () => Promise<void>;
  getScoreForGame: (game: Game) => LiveScore | null;
}

// Refresh interval: 20 seconds
const REFRESH_INTERVAL = 20 * 1000;

// Status codes that indicate a finished game
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO'];

export function useLiveScores(
  games: Game[], 
  onScorePersisted?: (gameId: string, homeScore: number, awayScore: number) => void
): UseLiveScoresResult {
  const [scores, setScores] = useState<Map<string, LiveScore>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const persistedScoresRef = useRef<Set<string>>(new Set());
  
  // Get list of fixture IDs to monitor
  const fixtureIds = useMemo(() => {
    return games
      .filter(g => g.api_fixture_id && (g.status === 'Live' || g.status === 'Pending'))
      .map(g => g.api_fixture_id!);
  }, [games]);
  
  // Check if there are any games to monitor
  const hasGamesToMonitor = fixtureIds.length > 0;
  
  // Fetch all live fixtures in a single API call
  const fetchLiveScores = useCallback(async () => {
    if (isFetchingRef.current || !hasGamesToMonitor) return;
    
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
      
      for (const fixture of fixtures) {
        const fixtureId = fixture.fixture?.id?.toString();
        const status = fixture.fixture?.status?.short ?? 'NS';
        const homeGoals = fixture.goals?.home ?? 0;
        const awayGoals = fixture.goals?.away ?? 0;
        
        if (fixtureId && fixtureIds.includes(fixtureId)) {
          newScores.set(fixtureId, {
            fixtureId: parseInt(fixtureId),
            homeScore: homeGoals,
            awayScore: awayGoals,
            elapsed: fixture.fixture?.status?.elapsed ?? null,
            status: status,
            statusLong: fixture.fixture?.status?.long ?? 'Not Started',
          });
          
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
      
      // For games not in live=all response, fetch individually if they might be starting soon
      const pendingGames = games.filter(g => 
        g.api_fixture_id && 
        g.status === 'Pending' && 
        !newScores.has(g.api_fixture_id)
      );
      
      // Check if any pending game is about to start (within 5 minutes)
      const now = new Date();
      const gamesStartingSoon = pendingGames.filter(g => {
        const gameTime = new Date(`${g.date}T${g.time}`);
        const diffMs = gameTime.getTime() - now.getTime();
        return diffMs > -60000 && diffMs < 5 * 60 * 1000; // -1 to +5 min window
      });
      
      // Fetch individual fixture data for games starting soon (max 3 to save credits)
      for (const game of gamesStartingSoon.slice(0, 3)) {
        try {
          const { data: fixtureData } = await supabase.functions.invoke('api-football', {
            body: {
              endpoint: 'fixtures',
              params: { id: game.api_fixture_id }
            }
          });
          
          const fixture = fixtureData?.response?.[0];
          if (fixture) {
            newScores.set(game.api_fixture_id!, {
              fixtureId: parseInt(game.api_fixture_id!),
              homeScore: fixture.goals?.home ?? 0,
              awayScore: fixture.goals?.away ?? 0,
              elapsed: fixture.fixture?.status?.elapsed ?? null,
              status: fixture.fixture?.status?.short ?? 'NS',
              statusLong: fixture.fixture?.status?.long ?? 'Not Started',
            });
          }
        } catch (err) {
          console.warn(`[useLiveScores] Failed to fetch fixture ${game.api_fixture_id}:`, err);
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
  }, [hasGamesToMonitor, fixtureIds, games]);
  
  // Get score for a specific game
  const getScoreForGame = useCallback((game: Game): LiveScore | null => {
    if (!game.api_fixture_id) return null;
    return scores.get(game.api_fixture_id) || null;
  }, [scores]);
  
  // Start/stop interval based on whether there are games to monitor
  useEffect(() => {
    if (hasGamesToMonitor) {
      console.log('[useLiveScores] Starting 20s interval for', fixtureIds.length, 'games');
      
      // Fetch immediately
      fetchLiveScores();
      
      // Then every 20 seconds
      intervalRef.current = setInterval(fetchLiveScores, REFRESH_INTERVAL);
      
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
  }, [hasGamesToMonitor, fixtureIds.length, fetchLiveScores]);
  
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
