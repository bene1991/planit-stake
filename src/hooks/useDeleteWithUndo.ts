import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Game } from '@/types';

interface UseDeleteWithUndoOptions {
  onDelete: (gameId: string) => Promise<void> | void;
  onRestore: (game: Game) => Promise<void> | void;
  undoDuration?: number;
}

export function useDeleteWithUndo({
  onDelete,
  onRestore,
  undoDuration = 5000,
}: UseDeleteWithUndoOptions) {
  const pendingDeletes = useRef<Map<string, { game: Game; timeoutId: NodeJS.Timeout }>>(new Map());

  const deleteWithUndo = useCallback((game: Game) => {
    const gameId = game.id;
    
    // If there's already a pending delete for this game, cancel it
    if (pendingDeletes.current.has(gameId)) {
      const pending = pendingDeletes.current.get(gameId)!;
      clearTimeout(pending.timeoutId);
      pendingDeletes.current.delete(gameId);
    }

    // Immediately delete from UI/database
    onDelete(gameId);

    // Create timeout for permanent deletion
    const timeoutId = setTimeout(() => {
      pendingDeletes.current.delete(gameId);
    }, undoDuration);

    // Store game data for potential restore
    pendingDeletes.current.set(gameId, { game, timeoutId });

    // Show toast with undo button
    toast.success('Jogo removido', {
      description: `${game.homeTeam} vs ${game.awayTeam}`,
      action: {
        label: 'Desfazer',
        onClick: async () => {
          const pending = pendingDeletes.current.get(gameId);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pendingDeletes.current.delete(gameId);
            await onRestore(game);
            toast.success('Jogo restaurado!');
          }
        },
      },
      duration: undoDuration,
    });
  }, [onDelete, onRestore, undoDuration]);

  return { deleteWithUndo };
}
