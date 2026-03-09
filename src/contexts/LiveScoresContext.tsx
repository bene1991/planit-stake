import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { Game } from '@/types';
import { useLiveScores, LiveScore, GoalDetectedCallback, OnRedCardDetected } from '@/hooks/useLiveScores';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { useApiPause } from '@/hooks/useApiPause';
import { useRefreshInterval } from '@/hooks/useRefreshInterval';

interface LiveScoresContextType {
    scores: Map<string, LiveScore>;
    loading: boolean;
    refresh: () => Promise<void>;
    lastRefresh: number | null;
    getScoreForGame: (game: Game) => LiveScore | null;
    highlightedGameId: string | null;
    setHighlightedGameId: (id: string | null) => void;
}

const LiveScoresContext = createContext<LiveScoresContextType | undefined>(undefined);

export const LiveScoresProvider: React.FC<{
    children: React.ReactNode;
    onGoalDetected?: GoalDetectedCallback;
    onRedCardDetected?: OnRedCardDetected;
    monitorAllLive?: boolean;
    highlightedGameId?: string | null;
    setHighlightedGameId?: (id: string | null) => void;
}> = ({
    children,
    onGoalDetected,
    onRedCardDetected,
    monitorAllLive,
    highlightedGameId: externalHighlightedGameId,
    setHighlightedGameId: externalSetHighlightedGameId
}) => {
        const { games } = useSupabaseGames();
        const { isPaused } = useApiPause();
        const { intervalMs } = useRefreshInterval();

        // Persist callbacks to avoid re-creating the hook
        const onGoalDetectedRef = useRef(onGoalDetected);
        useEffect(() => {
            onGoalDetectedRef.current = onGoalDetected;
        }, [onGoalDetected]);

        const onRedCardDetectedRef = useRef(onRedCardDetected);
        useEffect(() => {
            onRedCardDetectedRef.current = onRedCardDetected;
        }, [onRedCardDetected]);

        const handleGoalDetected = useCallback<GoalDetectedCallback>((gameId, team, homeScore, awayScore, game, playerName, minute, homeTeam, awayTeam, leagueName) => {
            // BACKSTOP FILTER: Even if the hook detects a goal, only propagate if it's a planning game
            const targetFixtureId = game?.api_fixture_id || String(gameId);
            const isLegit = games.some(g => g.api_fixture_id && String(g.api_fixture_id).trim() === String(targetFixtureId).trim());

            if (!isLegit && !monitorAllLive) {
                console.log(`[LiveScoresContext] 🛡️ Blocked goal alert for non-planning game: ${homeTeam} vs ${awayTeam}`);
                return;
            }

            onGoalDetectedRef.current?.(gameId, team, homeScore, awayScore, game, playerName, minute, homeTeam, awayTeam, leagueName);
        }, [games, monitorAllLive]);

        const handleRedCardDetected = useCallback<OnRedCardDetected>((event) => {
            const isLegit = games.some(g => g.api_fixture_id && String(g.api_fixture_id).trim() === String(event.fixtureId).trim());

            if (!isLegit && !monitorAllLive) {
                console.log(`[LiveScoresContext] 🛡️ Blocked red card alert for non-planning game: ${event.fixtureId}`);
                return;
            }

            onRedCardDetectedRef.current?.(event);
        }, [games, monitorAllLive]);

        const [localHighlightedGameId, localSetHighlightedGameId] = React.useState<string | null>(null);

        const activeHighlightedGameId = externalHighlightedGameId !== undefined ? externalHighlightedGameId : localHighlightedGameId;
        const activeSetHighlightedGameId = externalSetHighlightedGameId !== undefined ? externalSetHighlightedGameId : localSetHighlightedGameId;

        const { refreshGames } = useSupabaseGames();

        // The hook that does the heavy lifting
        const liveScoresResult = useLiveScores(
            games,
            () => {
                console.log('[LiveScoresContext] Score persisted, refreshing games list...');
                refreshGames();
            },
            handleGoalDetected,
            handleRedCardDetected,
            intervalMs,
            isPaused,
            monitorAllLive
        );

        return (
            <LiveScoresContext.Provider value={{
                ...liveScoresResult,
                highlightedGameId: activeHighlightedGameId,
                setHighlightedGameId: activeSetHighlightedGameId
            }}>
                {children}
            </LiveScoresContext.Provider>
        );
    };

export const useLiveScoresContext = () => {
    const context = useContext(LiveScoresContext);
    if (context === undefined) {
        throw new Error('useLiveScoresContext must be used within a LiveScoresProvider');
    }
    return context;
};
