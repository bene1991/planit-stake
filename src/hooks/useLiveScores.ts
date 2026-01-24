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

// Refresh interval: 20 seconds
const REFRESH_INTERVAL = 20 * 1000;

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
  
  // Internal snapshot for goal detection - stores previous scores before update
  const previousScoresRef = useRef<Map<string, { homeScore: number; awayScore: number }>>(new Map());
  
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
      
      // Fetch events for games with goals (max 5 to save credits)
      console.log(`[useLiveScores] Games with goals to fetch events: ${fixturesWithGoals.length}`, fixturesWithGoals);
      
      for (const fixtureInfo of fixturesWithGoals.slice(0, 5)) {
        try {
          console.log(`[useLiveScores] Fetching events for fixture ${fixtureInfo.id}...`);
          const { data: detailsData, error: detailsError } = await supabase.functions.invoke('get-fixture-details', {
            body: { fixture_id: parseInt(fixtureInfo.id) }
          });
          
          if (detailsError) {
            console.warn(`[useLiveScores] Error fetching events for fixture ${fixtureInfo.id}:`, detailsError);
            continue;
          }
          
          console.log(`[useLiveScores] Got key_events for fixture ${fixtureInfo.id}:`, detailsData?.key_events?.length || 0);
          
          if (detailsData?.key_events?.length) {
            const existingScore = newScores.get(fixtureInfo.id);
            if (existingScore) {
              const goalEvents = detailsData.key_events.filter((e: { type: string }) => e.type === 'goal');
              console.log(`[useLiveScores] Adding ${goalEvents.length} goal events to fixture ${fixtureInfo.id}`);
              newScores.set(fixtureInfo.id, {
                ...existingScore,
                events: goalEvents,
              });
            }
          }
        } catch (err) {
          console.warn(`[useLiveScores] Failed to fetch events for fixture ${fixtureInfo.id}:`, err);
        }
      }
      
      // Check for games marked as "Live" in DB but not in live=all response
      // These games likely just finished - fetch individually to get final score
      const liveGamesNotInResponse = games.filter(g => 
        g.api_fixture_id && 
        g.status === 'Live' && 
        !newScores.has(g.api_fixture_id) &&
        !persistedScoresRef.current.has(g.id)
      );
      
      // Fetch these games individually (max 3 per cycle to save credits)
      for (const game of liveGamesNotInResponse.slice(0, 3)) {
        try {
          console.log(`[useLiveScores] Game ${game.homeTeam} vs ${game.awayTeam} not in live=all, fetching individually...`);
          
          const { data: fixtureData } = await supabase.functions.invoke('api-football', {
            body: {
              endpoint: 'fixtures',
              params: { id: game.api_fixture_id }
            }
          });
          
          const fixture = fixtureData?.response?.[0];
          if (fixture) {
            const status = fixture.fixture?.status?.short ?? 'NS';
            const homeGoals = fixture.goals?.home ?? 0;
            const awayGoals = fixture.goals?.away ?? 0;
            
            newScores.set(game.api_fixture_id!, {
              fixtureId: parseInt(game.api_fixture_id!),
              homeScore: homeGoals,
              awayScore: awayGoals,
              elapsed: fixture.fixture?.status?.elapsed ?? null,
              status: status,
              statusLong: fixture.fixture?.status?.long ?? 'Not Started',
              homeTeamId: fixture.teams?.home?.id,
              awayTeamId: fixture.teams?.away?.id,
            });
            
            // If finished, persist the score
            if (FINISHED_STATUSES.includes(status)) {
              persistedScoresRef.current.add(game.id);
              
              console.log(`[useLiveScores] Persisting final score for ${game.homeTeam} vs ${game.awayTeam}: ${homeGoals}-${awayGoals}`);
              
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
                    persistedScoresRef.current.delete(game.id);
                  } else {
                    console.log(`[useLiveScores] Score persisted for game ${game.id}`);
                    onScorePersisted?.(game.id, homeGoals, awayGoals);
                  }
                });
            }
          }
        } catch (err) {
          console.warn(`[useLiveScores] Failed to fetch fixture ${game.api_fixture_id}:`, err);
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
  }, [hasGamesToMonitor, fixtureIds, games, onGoalDetected]);
  
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
