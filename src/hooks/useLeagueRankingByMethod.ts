import { useMemo } from 'react';
import { Game, Method, MethodOperation } from '@/types';
import { StatisticsFilters } from '@/components/StatisticsFilterBar';
import { isWithinInterval } from 'date-fns';

export interface LeagueMethodStats {
  league: string;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
  profit: number; // em stakes
  score: number;
}

export interface MethodLeagueRanking {
  methodId: string;
  methodName: string;
  allLeagues: LeagueMethodStats[]; // All leagues sorted by score (best to worst)
}

const calculateProfitInStakes = (op: MethodOperation): number => {
  if (op.profit !== undefined && op.profit !== null && op.stakeValue && op.stakeValue > 0) {
    return op.profit / op.stakeValue;
  }
  if (op.result === 'Green') {
    return op.odd && op.odd > 0 ? op.odd - 1 : 0;
  }
  if (op.result === 'Red') {
    return -1;
  }
  return 0;
};

export const useLeagueRankingByMethod = (
  games: Game[],
  methods: Method[],
  filters: StatisticsFilters
): MethodLeagueRanking[] => {
  return useMemo(() => {
    // Filter games by date and league
    const filteredGames = games.filter((game) => {
      if (game.methodOperations.length === 0) return false;
      if (!game.methodOperations.every((op) => op.result)) return false;

      if (filters.dateFrom && filters.dateTo) {
        const gameDate = new Date(`${game.date}T12:00:00`);
        if (!isWithinInterval(gameDate, { start: filters.dateFrom, end: filters.dateTo })) {
          return false;
        }
      }

      if (filters.selectedLeagues.length > 0 && !filters.selectedLeagues.includes(game.league)) {
        return false;
      }

      return true;
    });

    // Get methods to analyze (respect method filter)
    const methodsToAnalyze = filters.selectedMethods.length > 0
      ? methods.filter(m => filters.selectedMethods.includes(m.id))
      : methods;

    // For each method, build league stats
    const rankings: MethodLeagueRanking[] = methodsToAnalyze.map((method) => {
      const leagueMap = new Map<string, {
        greens: number;
        reds: number;
        profit: number;
      }>();

      filteredGames.forEach((game) => {
        const methodOps = game.methodOperations.filter((op) => {
          if (op.methodId !== method.id) return false;
          if (filters.result !== 'all' && op.result !== filters.result) return false;
          return true;
        });

        if (methodOps.length === 0) return;

        if (!leagueMap.has(game.league)) {
          leagueMap.set(game.league, { greens: 0, reds: 0, profit: 0 });
        }
        const leagueData = leagueMap.get(game.league)!;

        methodOps.forEach((op) => {
          if (op.result === 'Green') leagueData.greens++;
          if (op.result === 'Red') leagueData.reds++;
          leagueData.profit += calculateProfitInStakes(op);
        });
      });

      // Convert to array and calculate stats
      const leagueStats: LeagueMethodStats[] = Array.from(leagueMap.entries())
        .map(([league, data]) => {
          const total = data.greens + data.reds;
          const winRate = total > 0 ? (data.greens / total) * 100 : 0;
          return {
            league,
            total,
            greens: data.greens,
            reds: data.reds,
            winRate: parseFloat(winRate.toFixed(1)),
            profit: parseFloat(data.profit.toFixed(2)),
            score: 0,
          };
        })
        .filter((l) => l.total >= 3); // Minimum 3 operations for statistical relevance

      if (leagueStats.length === 0) {
        return {
          methodId: method.id,
          methodName: method.name,
          allLeagues: [],
        };
      }

      // Normalize profit for score calculation
      const maxProfit = Math.max(...leagueStats.map((l) => Math.abs(l.profit)), 1);

      // Calculate combined score: winRate * 0.6 + normalizedProfit * 0.4
      leagueStats.forEach((l) => {
        const normalizedProfit = (l.profit / maxProfit) * 100;
        l.score = parseFloat(((l.winRate * 0.6) + (normalizedProfit * 0.4)).toFixed(1));
      });

      // Sort by score descending (best first)
      const sortedLeagues = [...leagueStats].sort((a, b) => b.score - a.score);

      return {
        methodId: method.id,
        methodName: method.name,
        allLeagues: sortedLeagues,
      };
    }).filter((r) => r.allLeagues.length > 0);

    return rankings;
  }, [games, methods, filters]);
};
