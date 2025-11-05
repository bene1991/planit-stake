import { Game } from "@/hooks/useSupabaseGames";

/**
 * Calculate minutes until game starts
 */
export const getMinutesUntilGameStart = (game: Game): number => {
  const now = new Date();
  const gameStart = new Date(`${game.date}T${game.time}`);
  return Math.floor((gameStart.getTime() - now.getTime()) / (1000 * 60));
};

/**
 * Check if game has pending operations (without result)
 */
export const hasPendingOperations = (game: Game): boolean => {
  return game.methodOperations.some(op => !op.result);
};

/**
 * Get daily statistics for today
 */
export const getDailyStats = (games: Game[]) => {
  const today = new Date().toISOString().split('T')[0];
  const todayGames = games.filter(g => g.date === today && g.status === 'Finished');
  
  const operations = todayGames.flatMap(g => g.methodOperations);
  const finalized = operations.filter(op => op.result);
  
  const greens = finalized.filter(op => op.result === 'Green').length;
  const reds = finalized.filter(op => op.result === 'Red').length;
  const total = finalized.length;
  const winRate = total > 0 ? (greens / total) * 100 : 0;
  
  // Calculate ROI (simplified)
  const roi = finalized.reduce((acc, op) => {
    if (op.result === 'Green') {
      return acc + ((op.exitOdds || 0) - (op.entryOdds || 0));
    } else if (op.result === 'Red') {
      return acc - (op.entryOdds || 0);
    }
    return acc;
  }, 0);
  
  return { greens, reds, total, winRate, roi };
};

/**
 * Detect current streak (consecutive greens or reds)
 */
export const detectStreak = (games: Game[]): { streak: number; type: 'green' | 'red' | null } => {
  const finalized = games
    .filter(g => g.status === 'Finished')
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateB.getTime() - dateA.getTime();
    });
  
  if (finalized.length === 0) return { streak: 0, type: null };
  
  let streak = 0;
  let type: 'green' | 'red' | null = null;
  
  for (const game of finalized) {
    const operations = game.methodOperations.filter(op => op.result);
    if (operations.length === 0) continue;
    
    // Get dominant result for this game
    const greens = operations.filter(op => op.result === 'Green').length;
    const reds = operations.filter(op => op.result === 'Red').length;
    const gameResult = greens > reds ? 'green' : 'red';
    
    if (type === null) {
      type = gameResult;
      streak = 1;
    } else if (type === gameResult) {
      streak++;
    } else {
      break;
    }
  }
  
  return { streak, type };
};

/**
 * Get count of pending operations across all games
 */
export const getPendingOperationsCount = (games: Game[]): number => {
  return games.reduce((count, game) => {
    return count + game.methodOperations.filter(op => !op.result).length;
  }, 0);
};

/**
 * Format game name for notifications
 */
export const formatGameName = (game: Game): string => {
  return `${game.homeTeam} vs ${game.awayTeam}`;
};
