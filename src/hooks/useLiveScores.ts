import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Game } from '@/types';
import { emitApiUsageUpdate } from './useApiRequestTracker';
import { usePageVisibility } from './usePageVisibility';

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
  goalDetectedAt?: number;
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
  (
    gameId: string | number,
    team: 'home' | 'away',
    homeScore: number,
    awayScore: number,
    game?: Game,
    playerName?: string,
    minute?: string | number,
    homeTeam?: string,
    awayTeam?: string,
    leagueName?: string
  ): void;
}

export interface RedCardEvent {
  fixtureId: number;
  minute: number;
  team: 'home' | 'away';
  player?: string;
  homeTeam?: string;
  awayTeam?: string;
  leagueName?: string;
}

export type OnRedCardDetected = (event: RedCardEvent) => void;

// Default intervals (used as fallback)
const DEFAULT_ACTIVE_INTERVAL = 15 * 1000;
const REFRESH_INTERVAL_IDLE = 120 * 1000;

// Minimum interval between calls (throttle protection)
const MIN_CALL_INTERVAL = 5 * 1000;

// === MODULE-LEVEL goal dedup (survives StrictMode remounts) ===
const notifiedGoalsModule = new Map<string, number>(); // key -> timestamp
const notifiedRedCardsModule = new Map<string, number>(); // key -> timestamp

// Cleanup entries older than 2 hours to prevent memory leaks
const cleanupNotifiedEntries = () => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [key, ts] of notifiedGoalsModule) {
    if (ts < cutoff) notifiedGoalsModule.delete(key);
  }
  for (const [key, ts] of notifiedRedCardsModule) {
    if (ts < cutoff) notifiedRedCardsModule.delete(key);
  }
};

// Status codes that indicate a finished game
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO'];

// Status codes that indicate a live/in-progress game
const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];

export function useLiveScores(
  games: Game[],
  onScorePersisted?: (gameId: string, homeScore: number, awayScore: number) => void,
  onGoalDetected?: GoalDetectedCallback,
  onRedCardDetected?: OnRedCardDetected,
  activeIntervalMs?: number,
  paused?: boolean,
  monitorAllLive?: boolean
): UseLiveScoresResult {
  const [scores, setScores] = useState<Map<string, LiveScore>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  // Page visibility - pause polling when tab is hidden
  const isPageVisible = usePageVisibility();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const persistedScoresRef = useRef<Set<string>>(new Set());
  const livePersistedRef = useRef<Set<string>>(new Set());
  const lastCallTimeRef = useRef<number>(0);
  const remainingCreditsRef = useRef<number | null>(null);
  const rateLimitedUntilRef = useRef<number>(0);

  // Ref for games to avoid re-creating fetchLiveScores on every games change
  const gamesRef = useRef(games);
  useEffect(() => { gamesRef.current = games; }, [games]);
  // Internal snapshot for goal detection - stores previous scores before update
  const previousScoresRef = useRef<Map<string, { homeScore: number; awayScore: number }>>(new Map());
  // Track recently notified goals - MODULE-LEVEL to survive StrictMode remounts
  // (notifiedGoalsModule is defined outside the component)

  // Stable ref for fetchLiveScores to avoid useEffect dependency issues
  const fetchLiveScoresRef = useRef<(() => Promise<void>) | null>(null);

  // Stable refs for callbacks - prevents fetchLiveScores from being recreated when callbacks change
  const onGoalDetectedRef = useRef(onGoalDetected);
  useEffect(() => { onGoalDetectedRef.current = onGoalDetected; }, [onGoalDetected]);
  const onRedCardDetectedRef = useRef(onRedCardDetected);
  useEffect(() => { onRedCardDetectedRef.current = onRedCardDetected; }, [onRedCardDetected]);
  const onScorePersistedRef = useRef(onScorePersisted);
  useEffect(() => { onScorePersistedRef.current = onScorePersisted; }, [onScorePersisted]);

  // Get list of fixture IDs to monitor - only Live games + Pending games starting within 30 min
  const fixtureIds = useMemo(() => {
    const now = new Date();
    return games
      .filter(g => {
        if (!g.api_fixture_id) return false;
        if (g.status === 'Live') return true;
        if (g.status === 'Pending') {
          // Only include Pending games starting within 30 minutes
          try {
            const gameTime = new Date(`${g.date}T${g.time}`);
            const diffMs = gameTime.getTime() - now.getTime();
            return diffMs <= 60 * 60 * 1000 && diffMs > -60 * 60 * 1000;
          } catch {
            return false;
          }
        }
        return false;
      })
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

  // Memoized flag - only changes when game statuses change, not on every score update
  const hasLiveGames = useMemo(() => games.some(g => g.status === 'Live'), [games]);

  // Fetch all live fixtures in a single API call
  const fetchLiveScores = useCallback(async () => {
    // Rate limit backoff - skip if still in cooldown period
    const now = Date.now();
    if (now < rateLimitedUntilRef.current) {
      const remainingSec = Math.ceil((rateLimitedUntilRef.current - now) / 1000);
      console.warn(`[useLiveScores] ⛔ Rate limited - skipping (${remainingSec}s remaining)`);
      return;
    }

    // Throttle protection - prevent calls more frequent than MIN_CALL_INTERVAL
    if (now - lastCallTimeRef.current < MIN_CALL_INTERVAL) {
      console.warn('[useLiveScores] Throttled - called too soon, skipping');
      return;
    }

    if (isFetchingRef.current || (!hasGamesToMonitor && !monitorAllLive)) return;

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
        // Detect rate limit and apply 5-minute backoff
        if (data.errors.rateLimit || JSON.stringify(data.errors).toLowerCase().includes('rate limit') || JSON.stringify(data.errors).toLowerCase().includes('too many')) {
          const backoffMs = 5 * 60 * 1000;
          rateLimitedUntilRef.current = Date.now() + backoffMs;
          console.warn(`[useLiveScores] ⛔ RATE LIMITED - pausing polling for 5 minutes`);
          setError('Rate limit atingido - pausando por 5 minutos');
          return;
        }
        setError(Object.values(data.errors).join(', '));
        return;
      }

      // Emit API usage event if rate limit data is present
      if (data?._rateLimit?.used !== undefined && data?._rateLimit?.limit) {
        emitApiUsageUpdate(data._rateLimit.used, data._rateLimit.limit, data._rateLimit.remaining);
        remainingCreditsRef.current = data._rateLimit.remaining ?? null;
      }

      const fixtures = data?.response || [];
      console.log(`[useLiveScores] Got ${fixtures.length} live fixtures`);

      // Create a map of fixture ID -> live score data
      // IMPORTANTE: Começar com o estado atual e atualizar apenas o que veio de novo
      // Isso evita que o tempo suma se o jogo sumir temporariamente de 'live=all' devido ao cache
      const newScores = new Map<string, LiveScore>(scores);

      // Collect fixture IDs that need events fetched
      const fixturesWithGoals: { id: string; homeTeamId: number; awayTeamId: number }[] = [];

      // Identify games with new goals
      const newlyDetectedGoals: {
        game?: Game,
        fixtureId: string,
        team: 'home' | 'away',
        homeScore: number,
        awayScore: number,
        goalKey: string,
        homeTeam: string,
        awayTeam: string,
        league: string
      }[] = [];

      for (const fixture of fixtures) {
        const fixtureId = fixture.fixture?.id?.toString();
        const status = fixture.fixture?.status?.short ?? 'NS';
        const homeGoals = fixture.goals?.home ?? 0;
        const awayGoals = fixture.goals?.away ?? 0;
        const homeTeamId = fixture.teams?.home?.id;
        const awayTeamId = fixture.teams?.away?.id;

        if (!fixtureId) continue;

        const fixtureIdClean = fixtureId.trim();
        const oldSnapshot = previousScoresRef.current.get(fixtureIdClean);

        // ALWAYS establish baseline for EVERY game to ensure future goals are detected correctly
        const hadPreviousBaseline = !!oldSnapshot;
        const oldHomeScore = oldSnapshot?.homeScore ?? 0;
        const oldAwayScore = oldSnapshot?.awayScore ?? 0;

        // Find the game in manual planning
        const legitGame = gamesRef.current.find(g =>
          g.api_fixture_id && String(g.api_fixture_id).trim() === fixtureIdClean
        );

        const isLegit = !!legitGame;

        if (onGoalDetectedRef.current || onRedCardDetectedRef.current) {
          const homeTeam = fixture.teams?.home?.name || 'Home';
          const awayTeam = fixture.teams?.away?.name || 'Away';
          const leagueName = fixture.league?.name || 'League';

          // Periodic cleanup
          cleanupNotifiedEntries();

          // Detect home goal
          if (hadPreviousBaseline) {
            const isFinished = FINISHED_STATUSES.includes(status);

            if (!isFinished && homeGoals > oldHomeScore) {
              const goalKey = `${fixtureIdClean}-home-${homeGoals}`;
              if (!notifiedGoalsModule.has(goalKey)) {
                notifiedGoalsModule.set(goalKey, Date.now());

                // ONLY add to notifications if it's a legit planning game OR monitorAllLive is true
                if (isLegit || monitorAllLive) {
                  console.log(`[useLiveScores] 🎉 LEGIT HOME GOAL! ${homeTeam} scores! ${homeGoals}-${awayGoals}`);
                  newlyDetectedGoals.push({
                    game: legitGame, fixtureId: fixtureIdClean, team: 'home', homeScore: homeGoals, awayScore: awayGoals,
                    goalKey, homeTeam, awayTeam, league: leagueName
                  });
                } else {
                  console.log(`[useLiveScores] 🤫 Muted goal for robot/unknown game: ${homeTeam}`);
                }
              }
            }
            // Detect away goal
            if (!isFinished && awayGoals > oldAwayScore) {
              const goalKey = `${fixtureIdClean}-away-${awayGoals}`;
              if (!notifiedGoalsModule.has(goalKey)) {
                notifiedGoalsModule.set(goalKey, Date.now());

                if (isLegit || monitorAllLive) {
                  console.log(`[useLiveScores] 🎉 LEGIT AWAY GOAL! ${awayTeam} scores! ${homeGoals}-${awayGoals}`);
                  newlyDetectedGoals.push({
                    game: legitGame, fixtureId: fixtureIdClean, team: 'away', homeScore: homeGoals, awayScore: awayGoals,
                    goalKey, homeTeam, awayTeam, league: leagueName
                  });
                } else {
                  console.log(`[useLiveScores] 🤫 Muted goal for robot/unknown game: ${awayTeam}`);
                }
              }
            }
          }

          // RED CARD DETECTION: Check events in response
          if (fixture.events?.length && onRedCardDetectedRef.current) {
            const redCards = fixture.events.filter((e: any) => e.type?.toLowerCase() === 'red card');
            for (const rc of redCards) {
              const rcKey = `${fixtureIdClean}-${rc.time?.elapsed}-${rc.player?.name || 'unknown'}`;
              if (!notifiedRedCardsModule.has(rcKey)) {
                notifiedRedCardsModule.set(rcKey, Date.now());

                // ONLY fire for planning games or if explicit monitor-all
                if (isLegit || monitorAllLive) {
                  onRedCardDetectedRef.current({
                    fixtureId: parseInt(fixtureIdClean),
                    minute: rc.time?.elapsed,
                    team: rc.team?.id === homeTeamId ? 'home' : 'away',
                    player: rc.player?.name,
                    homeTeam, awayTeam, leagueName
                  } as any);
                }
              }
            }
          }

          // ALWAYS update baseline for next cycle
          previousScoresRef.current.set(fixtureIdClean, { homeScore: homeGoals, awayScore: awayGoals });
          if ((homeGoals > 0 || awayGoals > 0) && homeTeamId && awayTeamId) {
            fixturesWithGoals.push({ id: fixtureId, homeTeamId, awayTeamId });
          }

          // LIVE STATUS PERSISTENCE: Update DB when game starts
          if (legitGame && LIVE_STATUSES.includes(status) && !livePersistedRef.current.has(legitGame.id)) {
            const dbStatus = legitGame.status;
            if (dbStatus === 'Pending' || dbStatus === 'Not Started' || !dbStatus) {
              livePersistedRef.current.add(legitGame.id);
              console.log(`[useLiveScores] 🟢 GAME STARTED! ${legitGame.homeTeam} vs ${legitGame.awayTeam} - persisting status: Live`);

              supabase
                .from('games')
                .update({ status: 'Live' })
                .eq('id', legitGame.id)
                .then(({ error }) => {
                  if (error) {
                    console.error('[useLiveScores] Failed to persist Live status:', error);
                    livePersistedRef.current.delete(legitGame.id);
                  } else {
                    console.log(`[useLiveScores] ✅ Live status persisted for ${legitGame.id}`);
                    onScorePersistedRef.current?.(legitGame.id, homeGoals, awayGoals);
                  }
                });
            }
          }

          // Check if game just finished - persist final score
          if (legitGame && FINISHED_STATUSES.includes(status) && !persistedScoresRef.current.has(legitGame.id)) {
            // Mark as persisted immediately to avoid duplicates
            persistedScoresRef.current.add(legitGame.id);

            console.log(`[useLiveScores] Persisting final score for ${legitGame.homeTeam} vs ${legitGame.awayTeam}: ${homeGoals}-${awayGoals}`);

            // Persist to database (fire and forget)
            supabase
              .from('games')
              .update({
                final_score_home: homeGoals,
                final_score_away: awayGoals,
                status: 'Finished'
              })
              .eq('id', legitGame.id)
              .then(({ error }) => {
                if (error) {
                  console.error('[useLiveScores] Failed to persist score:', error);
                  // Remove from set to allow retry
                  persistedScoresRef.current.delete(legitGame.id);
                } else {
                  console.log(`[useLiveScores] Score persisted for game ${legitGame.id}`);
                  // Notify parent to update local state
                  onScorePersistedRef.current?.(legitGame.id, homeGoals, awayGoals);
                }
              });
          }
        }
      }

      // Fetch detailed events for games where a goal was just detected
      for (const info of fixturesWithGoals) {
        const score = newScores.get(info.id);
        if (score && score.goalDetectedAt) {
          console.log(`[useLiveScores] Fetching details for goal in fixture ${info.id}...`);
          try {
            const { data: details } = await supabase.functions.invoke('api-football', {
              body: { endpoint: 'fixtures', params: { id: info.id } }
            });
            const detailResponse = details?.response?.[0];
            if (detailResponse?.events) {
              score.events = detailResponse.events.map((e: any) => ({
                minute: e.time?.elapsed,
                team: e.team?.id === info.homeTeamId ? 'home' : 'away',
                type: e.type?.toLowerCase(),
                player: e.player?.name,
                detail: e.detail
              }));
              console.log(`[useLiveScores] Details fetched for fixture ${info.id}: ${score.events.length} events`);
            }
          } catch (err) {
            console.warn(`[useLiveScores] Detail fetch failed for ${info.id}:`, err);
          }
        }
      }

      // Dispatch goal detected events with player names
      for (const goal of newlyDetectedGoals) {
        const scoreDetails = newScores.get(goal.fixtureId);
        let playerName: string | undefined = undefined;
        let minute: string | number | undefined = undefined;

        if (scoreDetails?.events) {
          // Find the last goal event for the scoring team
          const teamGoals = scoreDetails.events.filter(e => e.type === 'goal' && e.team === goal.team);
          if (teamGoals.length > 0) {
            const lastGoal = teamGoals[teamGoals.length - 1];
            playerName = lastGoal.player;
            minute = lastGoal.minute;
          }
        }

        minute = minute ?? scoreDetails?.elapsed ?? '??';

        onGoalDetectedRef.current?.(
          goal.game?.id || goal.fixtureId,
          goal.team,
          goal.homeScore,
          goal.awayScore,
          goal.game,
          playerName,
          minute,
          goal.homeTeam,
          goal.awayTeam,
          goal.league
        );
      }

      // Fix for games that left live=all (likely finished)
      // API-Football removes finished games from live=all feed promptly.
      const liveGamesNotInResponse = gamesRef.current.filter(g =>
        g.api_fixture_id &&
        g.status === 'Live' &&
        !newScores.has(g.api_fixture_id) &&
        !persistedScoresRef.current.has(g.id)
      );

      if (liveGamesNotInResponse.length > 0) {
        console.log(`[useLiveScores] ${liveGamesNotInResponse.length} live games not in response - fetching individually to check if finished`);

        // Carry over old scores so the UI doesn't blank out while we fetch
        for (const game of liveGamesNotInResponse) {
          const oldScore = scores.get(game.api_fixture_id!);
          if (oldScore) {
            newScores.set(game.api_fixture_id!, oldScore);
          }
        }

        // Fetch their exact status individually
        for (const game of liveGamesNotInResponse.slice(0, 3)) { // Max 3 per cycle to avoid rate limits
          try {
            console.log(`[useLiveScores] Missing live game: Fetching status for ${game.homeTeam} vs ${game.awayTeam}...`);
            const { data: fixtureData } = await supabase.functions.invoke('api-football', {
              body: { endpoint: 'fixtures', params: { id: game.api_fixture_id } }
            });

            const fixture = fixtureData?.response?.[0];
            if (fixture) {
              const status = fixture.fixture?.status?.short ?? 'NS';
              const homeGoals = fixture.goals?.home ?? 0;
              const awayGoals = fixture.goals?.away ?? 0;

              // Update newScores with real data
              const mappedScore: LiveScore = {
                fixtureId: parseInt(game.api_fixture_id!),
                homeScore: homeGoals,
                awayScore: awayGoals,
                elapsed: fixture.fixture?.status?.elapsed ?? null,
                status: status,
                statusLong: fixture.fixture?.status?.long ?? 'Not Started',
                homeTeamId: fixture.teams?.home?.id,
                awayTeamId: fixture.teams?.away?.id,
              };
              newScores.set(game.api_fixture_id!, mappedScore);

              if (FINISHED_STATUSES.includes(status) && !persistedScoresRef.current.has(game.id)) {
                persistedScoresRef.current.add(game.id);
                console.log(`[useLiveScores] Recovered final score for ${game.homeTeam} vs ${game.awayTeam}: ${homeGoals}-${awayGoals}`);

                const { error } = await supabase
                  .from('games')
                  .update({
                    final_score_home: homeGoals,
                    final_score_away: awayGoals,
                    status: 'Finished'
                  })
                  .eq('id', game.id);

                if (error) {
                  console.error('[useLiveScores] Recovered persist error:', error);
                  persistedScoresRef.current.delete(game.id);
                } else {
                  console.log(`[useLiveScores] Recovered score persisted for ${game.id}`);
                  onScorePersistedRef.current?.(game.id, homeGoals, awayGoals);
                }
              }
            }
          } catch (err) {
            console.warn(`[useLiveScores] Missing live game fetch failed for ${game.api_fixture_id}:`, err);
          }
        }
      }

      // DISABLED: Fetching games starting soon - saves credits
      // These will appear in live=all once they actually start
      const pendingGames = gamesRef.current.filter(g =>
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
                onScorePersistedRef.current?.(game.id, homeGoals, awayGoals);
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
  }, [hasGamesToMonitor, fixtureIds, gamesNeedingBackfill]);

  // Get score for a specific game
  const getScoreForGame = useCallback((game: Game): LiveScore | null => {
    if (!game.api_fixture_id) return null;
    return scores.get(game.api_fixture_id) || null;
  }, [scores]);

  // Keep fetchLiveScores ref updated (without triggering useEffect)
  useEffect(() => {
    fetchLiveScoresRef.current = fetchLiveScores;
  }, [fetchLiveScores]);

  // Start/stop interval based on whether there are games to monitor AND page visibility
  // CRITICAL: fetchLiveScores removed from deps to prevent infinite loop!
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // If page is not visible or manually paused, stop all API calls
    if (!isPageVisible || paused) {
      console.log(`[useLiveScores] ${paused ? 'PAUSED by user' : 'Page hidden'} - stopping API polling`);
      return;
    }

    // Determine refresh interval: user setting + credit-based floor
    const hasLive = hasLiveGames;
    const userInterval = activeIntervalMs || DEFAULT_ACTIVE_INTERVAL;

    // Auto-economy: only restrict when critically low to respect user choice
    const remaining = remainingCreditsRef.current;
    let creditFloor = userInterval;
    if (remaining !== null) {
      if (remaining < 100) {
        creditFloor = 120 * 1000; // 2 min only if under 100
        console.warn(`[useLiveScores] ⚠️ CREDITS CRITICALLY LOW (${remaining}) - forcing 2min interval`);
      }
    }

    const effectiveInterval = hasGamesToMonitor
      ? Math.max(userInterval, creditFloor)
      : REFRESH_INTERVAL_IDLE;

    if (hasGamesToMonitor) {
      console.log(`[useLiveScores] Starting ${effectiveInterval / 1000}s interval (user=${userInterval / 1000}s, credits=${remaining ?? 'unknown'}, ${hasLive ? 'ACTIVE' : 'IDLE'})`);

      // Fetch immediately using ref
      fetchLiveScoresRef.current?.();

      // Dynamic interval based on credits and user setting
      intervalRef.current = setInterval(() => {
        fetchLiveScoresRef.current?.();
      }, effectiveInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
    // REMOVED: games from dependencies to prevent cascade: goal → persist → games update → re-fetch → duplicate
  }, [hasGamesToMonitor, fixtureIds.length, hasLiveGames, isPageVisible, activeIntervalMs, paused]);

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
