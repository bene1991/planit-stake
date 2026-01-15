import { useCallback, useRef, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Game } from '@/types';

interface ScoreSnapshot {
  homeScore: number;
  awayScore: number;
}

// Interval for background goal checking (60 seconds)
const CHECK_INTERVAL = 60 * 1000;

export function useGoalNotifications() {
  const { user } = useAuth();
  const scoreSnapshotsRef = useRef<Map<string, ScoreSnapshot>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveGamesRef = useRef<Game[]>([]);

  // Check if goal notifications are enabled in localStorage
  const isGoalNotificationsEnabled = useCallback(() => {
    const saved = localStorage.getItem('goalNotificationsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  }, []);

  // Update score snapshot for a game
  const updateScoreSnapshot = useCallback((gameId: string, homeScore: number, awayScore: number) => {
    scoreSnapshotsRef.current.set(gameId, { homeScore, awayScore });
  }, []);

  // Check for goals in background via edge function
  const checkGoalsInBackground = useCallback(async () => {
    if (!user || liveGamesRef.current.length === 0) return;
    
    // Check if goal notifications are enabled
    if (!isGoalNotificationsEnabled()) {
      console.log('[GoalNotifications] Goal notifications disabled, skipping check');
      return;
    }

    const gamesToCheck = liveGamesRef.current
      .filter(g => g.api_fixture_id)
      .map(g => {
        const snapshot = scoreSnapshotsRef.current.get(g.id) || { homeScore: 0, awayScore: 0 };
        return {
          id: g.id,
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          api_fixture_id: g.api_fixture_id!,
          lastKnownHomeScore: snapshot.homeScore,
          lastKnownAwayScore: snapshot.awayScore,
        };
      });

    if (gamesToCheck.length === 0) return;

    try {
      const { data, error } = await supabase.functions.invoke('check-goals-and-notify', {
        body: {
          userId: user.id,
          games: gamesToCheck,
        },
      });

      if (error) {
        console.error('[GoalNotifications] Error checking goals:', error);
        return;
      }

      // Update snapshots with new scores
      if (data?.goals) {
        for (const goal of data.goals) {
          updateScoreSnapshot(goal.gameId, goal.newHomeScore, goal.newAwayScore);
        }
      }

      console.log(`[GoalNotifications] Checked ${gamesToCheck.length} games, found ${data?.goals?.length || 0} new goals`);
    } catch (error) {
      console.error('[GoalNotifications] Exception:', error);
    }
  }, [user, updateScoreSnapshot, isGoalNotificationsEnabled]);

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

    console.log('[GoalNotifications] Starting background monitoring');
    
    // Check immediately
    checkGoalsInBackground();

    // Then check every minute
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