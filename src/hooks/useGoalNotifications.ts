import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Game } from '@/types';
import { playGoalSound } from '@/utils/soundManager';
import { LiveScore } from './useLiveScores';

interface ScoreSnapshot {
  homeScore: number;
  awayScore: number;
}

interface GoalNotificationsOptions {
  onGoalScored?: (gameId: string) => void;
}

/**
 * Goal notifications hook - OPTIMIZED VERSION
 * 
 * This hook NO LONGER makes its own API calls.
 * Instead, it receives live score data from useLiveScores via the checkForGoals method.
 * This eliminates duplicate API consumption.
 * 
 * Usage:
 * 1. Call setLiveGames() when your games list changes
 * 2. Call checkForGoals(liveScores) whenever useLiveScores updates
 */
export function useGoalNotifications(options?: GoalNotificationsOptions) {
  const { user } = useAuth();
  const scoreSnapshotsRef = useRef<Map<string, ScoreSnapshot>>(new Map());
  const liveGamesRef = useRef<Game[]>([]);
  const onGoalScoredRef = useRef(options?.onGoalScored);
  
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
    // 🔊 Play celebration sound immediately!
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

  /**
   * Check for goals using data from useLiveScores
   * NO API CALLS - uses data passed in from the centralized hook
   */
  const checkForGoals = useCallback((liveScores: Map<string, LiveScore>) => {
    if (!isGoalNotificationsEnabled()) {
      return;
    }

    const gamesToCheck = liveGamesRef.current.filter(g => g.api_fixture_id);
    if (gamesToCheck.length === 0) return;

    let goalsDetected = 0;
    
    for (const game of gamesToCheck) {
      const liveScore = liveScores.get(game.api_fixture_id!);
      if (!liveScore) continue;
      
      const currentHomeScore = liveScore.homeScore ?? 0;
      const currentAwayScore = liveScore.awayScore ?? 0;
      
      const snapshot = scoreSnapshotsRef.current.get(game.id);
      const lastHomeScore = snapshot?.homeScore ?? 0;
      const lastAwayScore = snapshot?.awayScore ?? 0;
      
      // Detect home goal
      if (currentHomeScore > lastHomeScore) {
        goalsDetected++;
        onGoalScoredRef.current?.(game.id);
        sendGoalNotification(
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
        onGoalScoredRef.current?.(game.id);
        sendGoalNotification(
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

    if (goalsDetected > 0) {
      console.log(`[GoalNotifications] Detected ${goalsDetected} new goals`);
    }
  }, [isGoalNotificationsEnabled, sendGoalNotification, updateScoreSnapshot]);

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

  // Handle visibility change - no longer needs to check for goals
  // since useLiveScores handles the refresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[GoalNotifications] App visible - useLiveScores will handle refresh');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    setLiveGames,
    updateScoreSnapshot,
    checkForGoals,
    // Legacy methods removed - no longer needed:
    // startMonitoring, stopMonitoring, checkGoalsInBackground
  };
}
