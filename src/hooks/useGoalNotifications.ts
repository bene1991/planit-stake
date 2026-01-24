import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Game } from '@/types';
import { playGoalSound } from '@/utils/soundManager';

interface ScoreSnapshot {
  homeScore: number;
  awayScore: number;
}

// Interval for background goal checking (20 seconds - uses live=all endpoint)
const CHECK_INTERVAL = 20 * 1000;

interface GoalNotificationsOptions {
  onGoalScored?: (gameId: string) => void;
}

export function useGoalNotifications(options?: GoalNotificationsOptions) {
  const { user } = useAuth();
  const scoreSnapshotsRef = useRef<Map<string, ScoreSnapshot>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveGamesRef = useRef<Game[]>();
  const onGoalScoredRef = useRef(options?.onGoalScored);
  const isFetchingRef = useRef(false);
  
  // Keep callback ref updated
  useEffect(() => {
    onGoalScoredRef.current = options?.onGoalScored;
  }, [options?.onGoalScored]);

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
    // 🔊 TOCAR SOM DE TORCIDA IMEDIATAMENTE!
    console.log('[GoalNotifications] 🎉 GOOOOOL! Playing crowd celebration sound!');
    playGoalSound();
    
    if (!user) return;
    
    try {
      const title = '⚽ GOL!';
      const scoringTeamName = scoringTeam === 'home' ? homeTeam : awayTeam;
      const body = `${scoringTeamName} marca! ${homeTeam} ${newHomeScore} x ${newAwayScore} ${awayTeam}`;
      
      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          payload: {
            title,
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: { 
              type: 'goal',
              homeTeam,
              awayTeam,
              homeScore: newHomeScore,
              awayScore: newAwayScore
            }
          }
        }
      });
      
      console.log(`[GoalNotifications] Sent push notification: ${body}`);
    } catch (error) {
      console.error('[GoalNotifications] Failed to send push notification:', error);
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
          // Notify callback with gameId
          onGoalScoredRef.current?.(game.id);
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
          // Notify callback with gameId
          onGoalScoredRef.current?.(game.id);
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

  // Helper to check if a game should be monitored
  const isGameLiveOrStartingSoon = useCallback((game: Game): boolean => {
    // Games with explicit live status
    if (game.status === 'Live' || 
        ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(game.status || '')) {
      return true;
    }
    
    // Pending games that may have already started (within last 2 hours)
    if ((game.status === 'Pending' || !game.status) && game.date && game.time) {
      try {
        const gameDateTime = new Date(`${game.date}T${game.time}`);
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
        
        // Monitor if game started up to 2h ago OR starts within 15 min
        return gameDateTime >= twoHoursAgo && gameDateTime <= fifteenMinutesFromNow;
      } catch {
        return false;
      }
    }
    
    return false;
  }, []);

  // Set live games to monitor
  const setLiveGames = useCallback((games: Game[]) => {
    const monitoredGames = games.filter(g => 
      g.api_fixture_id && isGameLiveOrStartingSoon(g)
    );
    
    console.log(`[GoalNotifications] Monitoring ${monitoredGames.length} games:`, 
      monitoredGames.map(g => `${g.homeTeam} vs ${g.awayTeam} (status: ${g.status}, time: ${g.time})`));
    
    liveGamesRef.current = monitoredGames;

    // Initialize score snapshots for new games
    for (const game of monitoredGames) {
      if (!scoreSnapshotsRef.current.has(game.id)) {
        const initialHome = game.finalScoreHome || 0;
        const initialAway = game.finalScoreAway || 0;
        console.log(`[GoalNotifications] Init snapshot: ${game.homeTeam} vs ${game.awayTeam} = ${initialHome}-${initialAway}`);
        scoreSnapshotsRef.current.set(game.id, {
          homeScore: initialHome,
          awayScore: initialAway,
        });
      }
    }

    // Clean up snapshots for games no longer monitored
    const monitoredIds = new Set(monitoredGames.map(g => g.id));
    for (const gameId of scoreSnapshotsRef.current.keys()) {
      if (!monitoredIds.has(gameId)) {
        scoreSnapshotsRef.current.delete(gameId);
      }
    }
  }, [isGameLiveOrStartingSoon]);

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