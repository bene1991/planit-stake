import { getNowInBrasilia } from './timezone';

/**
 * Calculates the game status based on the start time
 * @param dateTime - Game start date/time in ISO format
 * @returns 'Not Started' | 'Live' | 'Finished'
 */
export function calculateGameStatus(dateTime: string): string {
  if (!dateTime) return 'Not Started';

  const now = getNowInBrasilia(); // UTC-3
  const gameStart = new Date(dateTime + '-03:00'); // Força UTC-3
  
  // Game end time is 2 hours and 10 minutes after start
  const gameEnd = new Date(gameStart.getTime() + (2 * 60 + 10) * 60 * 1000);

  if (now < gameStart) {
    return 'Not Started';
  } else if (now >= gameStart && now <= gameEnd) {
    return 'Live';
  } else {
    return 'Finished';
  }
}

/**
 * Updates game statuses for all games
 * @param games - Array of games
 * @returns Updated games array with new statuses
 */
export function updateGameStatuses<T extends { date: string; time: string; status?: string }>(
  games: T[]
): T[] {
  return games.map(game => {
    const dateTime = `${game.date}T${game.time}`;
    const newStatus = calculateGameStatus(dateTime);
    return { ...game, status: newStatus };
  });
}
