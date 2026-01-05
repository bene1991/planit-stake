import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Game, GoalEvent } from '@/types';
import { ApiFootballEvent } from './useApiFootball';
import { useApiRequestTracker } from './useApiRequestTracker';

// Finished game statuses
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO'];

interface FixtureData {
  fixture: {
    fixture: { id: number; status: { short: string } };
    goals: { home: number | null; away: number | null };
    teams: { home: { id: number }; away: { id: number } };
  };
  events: ApiFootballEvent[];
}

export function useGoalPersistence() {
  const { trackRequest } = useApiRequestTracker();
  // Track which games we've already persisted to avoid duplicates
  const persistedGamesRef = useRef<Set<string>>(new Set());
  // Track pending persistence operations
  const pendingPersistenceRef = useRef<Set<string>>(new Set());

  // Convert API events to GoalEvent format for storage
  const convertToGoalEvents = useCallback((events: ApiFootballEvent[]): GoalEvent[] => {
    return events
      .filter(e => e.type === 'Goal')
      .map(e => ({
        teamId: e.team?.id || 0,
        playerName: e.player?.name || 'Unknown',
        minute: e.time?.elapsed || 0,
        detail: e.detail,
      }));
  }, []);

  // Persist goal events to a game in the database
  const persistGoals = useCallback(async (
    gameId: string,
    goalEvents: GoalEvent[],
    finalScoreHome?: number,
    finalScoreAway?: number
  ): Promise<boolean> => {
    // Skip if already persisted or pending
    if (persistedGamesRef.current.has(gameId) || pendingPersistenceRef.current.has(gameId)) {
      console.log(`[GoalPersistence] Skipping ${gameId} - already persisted or pending`);
      return false;
    }

    pendingPersistenceRef.current.add(gameId);

    try {
      const updates: Record<string, unknown> = {
        goal_events: goalEvents,
      };

      if (finalScoreHome !== undefined) {
        updates.final_score_home = finalScoreHome;
      }
      if (finalScoreAway !== undefined) {
        updates.final_score_away = finalScoreAway;
      }

      const { error } = await supabase
        .from('games')
        .update(updates)
        .eq('id', gameId);

      if (error) {
        console.error(`[GoalPersistence] Error persisting goals for ${gameId}:`, error);
        return false;
      }

      persistedGamesRef.current.add(gameId);
      console.log(`[GoalPersistence] Successfully persisted ${goalEvents.length} goals for game ${gameId}`);
      return true;
    } catch (err) {
      console.error(`[GoalPersistence] Exception persisting goals for ${gameId}:`, err);
      return false;
    } finally {
      pendingPersistenceRef.current.delete(gameId);
    }
  }, []);

  // Fetch events for a finished game and persist them
  const fetchAndPersistGoals = useCallback(async (
    game: Game,
    fixtureId: number,
    homeScore?: number,
    awayScore?: number
  ): Promise<boolean> => {
    // Skip if already has persisted goals
    if (game.goalEvents && game.goalEvents.length > 0) {
      console.log(`[GoalPersistence] Game ${game.id} already has persisted goals`);
      persistedGamesRef.current.add(game.id);
      return false;
    }

    // Skip if already persisted or pending
    if (persistedGamesRef.current.has(game.id) || pendingPersistenceRef.current.has(game.id)) {
      return false;
    }

    pendingPersistenceRef.current.add(game.id);

    try {
      console.log(`[GoalPersistence] Fetching events for fixture ${fixtureId}`);
      
      const { data, error } = await supabase.functions.invoke('api-football', {
        body: { endpoint: 'fixtures/events', params: { fixture: fixtureId } }
      });

      if (error) {
        console.error(`[GoalPersistence] Error fetching events:`, error);
        return false;
      }

      trackRequest(1);

      const events = (data?.response || []) as ApiFootballEvent[];
      const goalEvents = convertToGoalEvents(events);

      if (goalEvents.length > 0 || homeScore !== undefined) {
        return await persistGoals(game.id, goalEvents, homeScore, awayScore);
      }

      // Mark as persisted even if no goals (to avoid re-fetching)
      persistedGamesRef.current.add(game.id);
      return false;
    } catch (err) {
      console.error(`[GoalPersistence] Exception:`, err);
      return false;
    } finally {
      pendingPersistenceRef.current.delete(game.id);
    }
  }, [trackRequest, convertToGoalEvents, persistGoals]);

  // Check if a game needs goal persistence (finished with goals but no persisted events)
  const needsPersistence = useCallback((
    game: Game,
    fixtureData: FixtureData | null
  ): boolean => {
    if (!fixtureData) return false;
    if (!game.api_fixture_id) return false;
    
    // Already has persisted goals
    if (game.goalEvents && game.goalEvents.length > 0) return false;
    
    // Already processed
    if (persistedGamesRef.current.has(game.id)) return false;

    const status = fixtureData.fixture.fixture.status.short;
    const isFinished = FINISHED_STATUSES.includes(status);
    
    if (!isFinished) return false;

    const homeGoals = fixtureData.fixture.goals?.home ?? 0;
    const awayGoals = fixtureData.fixture.goals?.away ?? 0;
    const hasGoals = homeGoals > 0 || awayGoals > 0;

    // Also persist if game has events in memory but not in DB
    const hasEventsInMemory = fixtureData.events && fixtureData.events.some(e => e.type === 'Goal');

    return hasGoals || hasEventsInMemory;
  }, []);

  // Persist goals from in-memory events (when we already have them)
  const persistFromMemory = useCallback(async (
    game: Game,
    events: ApiFootballEvent[],
    homeScore?: number,
    awayScore?: number
  ): Promise<boolean> => {
    if (game.goalEvents && game.goalEvents.length > 0) {
      persistedGamesRef.current.add(game.id);
      return false;
    }

    const goalEvents = convertToGoalEvents(events);
    return await persistGoals(game.id, goalEvents, homeScore, awayScore);
  }, [convertToGoalEvents, persistGoals]);

  // Reset persistence tracking (call when user refreshes or games list changes)
  const resetPersistenceTracking = useCallback(() => {
    // Don't clear - we want to remember what we've persisted
    // Only clear pending operations
    pendingPersistenceRef.current.clear();
  }, []);

  return {
    needsPersistence,
    fetchAndPersistGoals,
    persistFromMemory,
    resetPersistenceTracking,
    convertToGoalEvents,
  };
}
