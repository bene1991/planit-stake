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

        const handleGoalDetected = useCallback<GoalDetectedCallback>((...args) => {
            onGoalDetectedRef.current?.(...args);
        }, []);

        const handleRedCardDetected = useCallback<OnRedCardDetected>((...args) => {
            onRedCardDetectedRef.current?.(...args);
        }, []);

        const [localHighlightedGameId, localSetHighlightedGameId] = React.useState<string | null>(null);

        const activeHighlightedGameId = externalHighlightedGameId !== undefined ? externalHighlightedGameId : localHighlightedGameId;
        const activeSetHighlightedGameId = externalSetHighlightedGameId !== undefined ? externalSetHighlightedGameId : localSetHighlightedGameId;

        // The hook that does the heavy lifting
        const liveScoresResult = useLiveScores(
            games,
            undefined, // onScorePersisted is handled internally by the hook for DB updates
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
