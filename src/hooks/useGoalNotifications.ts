import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Game } from '@/types';

interface ScoreSnapshot {
  homeScore: number;
  awayScore: number;
}

// Interval for background goal checking (20 seconds - uses live=all endpoint)
const CHECK_INTERVAL = 20 * 1000;

export function useGoalNotifications() {
  const { user } = useAuth();
  const scoreSnapshotsRef = useRef<Map<string, ScoreSnapshot>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveGamesRef = useRef<Game[]>([]);
  const isFetchingRef = useRef(false);

  // Check if goal notifications are enabled in localStorage
  const isGoalNotificationsEnabled = useCallback(() => {
    const saved = localStorage.getItem('goalNotificationsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  }, []);

  // Update score snapshot for a game
  const updateScoreSnapshot = useCallback((gameId: string, homeScore: number, awayScore: number) => {
    scoreSnapshotsRef.current.set(gameId, { homeScore, awayScore });
  }, []);

  // Send push notification for a goal
  const sendGoalNotification = useCallback(async (
    homeTeam: string, 
    awayTeam: string, 
    newHomeScore: number, 
    newAwayScore: number,
    scoringTeam: 'home' | 'away'
  ) => {
    if (!user) return;
    
    try {
      const title = '⚽ GOL!';
      const body = scoringTeam === 'home' 
        ? `${homeTeam} ${newHomeScore} x ${newAwayScore} ${awayTeam}`
        : `${homeTeam} ${newHomeScore} x ${newAwayScore} ${awayTeam}`;
      
      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          title,
          body,
          data: { type: 'goal' }
        }
      });
      
      console.log(`[GoalNotifications] Sent notification: ${body}`);
    } catch (error) {
      console.error('[GoalNotifications] Failed to send notification:', error);
    }
  }, [user]);

  // Check for goals using live=all endpoint (single API call for all games)
  const checkGoalsInBackground = useCallback(async () => {
    if (!user || liveGamesRef.current.length === 0 || isFetchingRef.current) return;
    
    // Check if goal notifications are enabled
    if (!isGoalNotificationsEnabled()) {
      console.log('[GoalNotifications] Goal notifications disabled, skipping check');
      return;
    }

    const gamesToCheck = liveGamesRef.current.filter(g => g.api_fixture_id);
    if (gamesToCheck.length === 0) return;

    isFetchingRef.current = true;

    try {
      console.log('[GoalNotifications] Checking goals via live=all...');
      
      // Use live=all endpoint - 1 API call for all live games
      const { data, error } = await supabase.functions.invoke('api-football', {
        body: {
          endpoint: 'fixtures',
          params: { live: 'all' }
        }
      });

      if (error) {
        console.error('[GoalNotifications] Error fetching live fixtures:', error);
        return;
      }

      const fixtures = data?.response || [];
      const fixtureMap = new Map<string, any>();
      
      for (const fixture of fixtures) {
        const id = fixture.fixture?.id?.toString();
        if (id) fixtureMap.set(id, fixture);
      }

      // Check each monitored game for goals
      let goalsDetected = 0;
      
      for (const game of gamesToCheck) {
        const fixture = fixtureMap.get(game.api_fixture_id!);
        if (!fixture) continue;
        
        const currentHomeScore = fixture.goals?.home ?? 0;
        const currentAwayScore = fixture.goals?.away ?? 0;
        
        const snapshot = scoreSnapshotsRef.current.get(game.id);
        const lastHomeScore = snapshot?.homeScore ?? 0;
        const lastAwayScore = snapshot?.awayScore ?? 0;
        
        // Detect home goal
        if (currentHomeScore > lastHomeScore) {
          goalsDetected++;
          await sendGoalNotification(
            game.homeTeam,
            game.awayTeam,
            currentHomeScore,
            currentAwayScore,
            'home'
          );
        }
        
        // Detect away goal
        if (currentAwayScore > lastAwayScore) {
          goalsDetected++;
          await sendGoalNotification(
            game.homeTeam,
            game.awayTeam,
            currentHomeScore,
            currentAwayScore,
            'away'
          );
        }
        
        // Update snapshot
        updateScoreSnapshot(game.id, currentHomeScore, currentAwayScore);
      }

      console.log(`[GoalNotifications] Checked ${gamesToCheck.length} games, found ${goalsDetected} new goals`);
    } catch (error) {
      console.error('[GoalNotifications] Exception:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [user, updateScoreSnapshot, isGoalNotificationsEnabled, sendGoalNotification]);

  // Set live games to monitor
  const setLiveGames = useCallback((games: Game[]) => {
    const liveGames = games.filter(g => 
      g.status === 'Live' || 
      ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(g.status || '')
    );
    
    liveGamesRef.current = liveGames;

    // Initialize score snapshots for new games
    for (const game of liveGames) {
      if (!scoreSnapshotsRef.current.has(game.id)) {
        scoreSnapshotsRef.current.set(game.id, {
          homeScore: game.finalScoreHome || 0,
          awayScore: game.finalScoreAway || 0,
        });
      }
    }

    // Clean up snapshots for games no longer live
    const liveGameIds = new Set(liveGames.map(g => g.id));
    for (const gameId of scoreSnapshotsRef.current.keys()) {
      if (!liveGameIds.has(gameId)) {
        scoreSnapshotsRef.current.delete(gameId);
      }
    }
  }, []);

  // Start background monitoring
  const startMonitoring = useCallback(() => {
    if (intervalRef.current) return;

    console.log('[GoalNotifications] Starting background monitoring (20s interval)');
    
    // Check immediately
    checkGoalsInBackground();

    // Then check every 20 seconds
    intervalRef.current = setInterval(checkGoalsInBackground, CHECK_INTERVAL);
  }, [checkGoalsInBackground]);

  // Stop background monitoring
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      console.log('[GoalNotifications] Stopping background monitoring');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Handle visibility change - check when app comes back to foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // App came back to foreground, check for goals
        checkGoalsInBackground();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkGoalsInBackground]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    setLiveGames,
    updateScoreSnapshot,
    startMonitoring,
    stopMonitoring,
    checkGoalsInBackground,
  };
}