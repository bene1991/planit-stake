import { useMemo } from 'react';
import { Game, Method } from '@/types';
import { StatisticsFilters } from '@/components/StatisticsFilterBar';
import { format, isWithinInterval, parseISO, subDays } from 'date-fns';

interface OverallStats {
  total: number;
  greens: number;
  reds: number;
  winRate: number;
}

interface MethodStats {
  methodId: string;
  methodName: string;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
}

interface DailyMethodData {
  date: string;
  greens: number;
  reds: number;
  winRate: number;
  balance: number;
}

interface MethodDetailStats extends MethodStats {
  dailyData: DailyMethodData[];
  previousWinRate?: number;
}

interface DayBreakdown {
  date: string;
  totalGreens: number;
  totalReds: number;
  totalWinRate: number;
  totalBalance: number;
  methods: {
    methodId: string;
    methodName: string;
    greens: number;
    reds: number;
    winRate: number;
    balance: number;
  }[];
}

interface MethodTimelineData {
  date: string;
  [methodName: string]: number | string;
}

interface ComparisonStats {
  currentWinRate: number;
  previousWinRate: number;
  winRateChange: number;
  currentVolume: number;
  previousVolume: number;
  volumeChange: number;
  bestMethod: { name: string; winRate: number } | null;
}

export interface FilteredStatisticsResult {
  overallStats: OverallStats;
  methodDetailStats: MethodDetailStats[];
  dailyBreakdown: DayBreakdown[];
  methodTimeline: MethodTimelineData[];
  methodNames: string[];
  comparison: ComparisonStats;
  leagues: string[];
}

export const useFilteredStatistics = (
  games: Game[],
  methods: Method[],
  filters: StatisticsFilters
): FilteredStatisticsResult => {
  return useMemo(() => {
    // Get all unique leagues
    const leagues = [...new Set(games.map((g) => g.league))].sort();

    // Filter games based on criteria
    const filteredGames = games.filter((game) => {
      // Must have completed operations
      if (game.methodOperations.length === 0) return false;
      if (!game.methodOperations.every((op) => op.result)) return false;

      // Date filter
      if (filters.dateFrom && filters.dateTo) {
        const gameDate = parseISO(game.date);
        if (!isWithinInterval(gameDate, { start: filters.dateFrom, end: filters.dateTo })) {
          return false;
        }
      }

      // League filter
      if (filters.selectedLeagues.length > 0 && !filters.selectedLeagues.includes(game.league)) {
        return false;
      }

      return true;
    });

    // Filter operations by method and result
    const getFilteredOperations = (game: Game) => {
      return game.methodOperations.filter((op) => {
        if (filters.selectedMethods.length > 0 && !filters.selectedMethods.includes(op.methodId)) {
          return false;
        }
        if (filters.result !== 'all' && op.result !== filters.result) {
          return false;
        }
        return true;
      });
    };

    // Calculate overall stats
    const allFilteredOps = filteredGames.flatMap(getFilteredOperations);
    const totalOps = allFilteredOps.length;
    const greenOps = allFilteredOps.filter((op) => op.result === 'Green').length;
    const redOps = allFilteredOps.filter((op) => op.result === 'Red').length;
    const winRate = totalOps > 0 ? (greenOps / totalOps) * 100 : 0;

    const overallStats: OverallStats = {
      total: totalOps,
      greens: greenOps,
      reds: redOps,
      winRate: parseFloat(winRate.toFixed(1)),
    };

    // Calculate previous period stats for comparison
    let previousGames: Game[] = [];
    if (filters.dateFrom && filters.dateTo) {
      const periodDays = Math.ceil(
        (filters.dateTo.getTime() - filters.dateFrom.getTime()) / (1000 * 60 * 60 * 24)
      );
      const previousStart = subDays(filters.dateFrom, periodDays);
      const previousEnd = subDays(filters.dateTo, periodDays);

      previousGames = games.filter((game) => {
        if (game.methodOperations.length === 0) return false;
        if (!game.methodOperations.every((op) => op.result)) return false;

        const gameDate = parseISO(game.date);
        return isWithinInterval(gameDate, { start: previousStart, end: previousEnd });
      });
    }

    const previousOps = previousGames.flatMap((g) =>
      g.methodOperations.filter((op) => {
        if (filters.selectedMethods.length > 0 && !filters.selectedMethods.includes(op.methodId)) {
          return false;
        }
        return true;
      })
    );
    const previousGreens = previousOps.filter((op) => op.result === 'Green').length;
    const previousTotal = previousOps.length;
    const previousWinRate = previousTotal > 0 ? (previousGreens / previousTotal) * 100 : 0;

    // Calculate method-specific stats
    const methodDetailStats: MethodDetailStats[] = methods
      .filter((m) => filters.selectedMethods.length === 0 || filters.selectedMethods.includes(m.id))
      .map((method) => {
        const methodOps = allFilteredOps.filter((op) => op.methodId === method.id);
        const methodGreens = methodOps.filter((op) => op.result === 'Green').length;
        const methodReds = methodOps.filter((op) => op.result === 'Red').length;
        const methodTotal = methodOps.length;
        const methodWinRate = methodTotal > 0 ? (methodGreens / methodTotal) * 100 : 0;

        // Daily data for this method
        const dailyMap = new Map<string, { greens: number; reds: number }>();

        filteredGames.forEach((game) => {
          const gameOps = game.methodOperations.filter(
            (op) => op.methodId === method.id && (filters.result === 'all' || op.result === filters.result)
          );
          if (gameOps.length === 0) return;

          if (!dailyMap.has(game.date)) {
            dailyMap.set(game.date, { greens: 0, reds: 0 });
          }
          const dayData = dailyMap.get(game.date)!;
          gameOps.forEach((op) => {
            if (op.result === 'Green') dayData.greens++;
            if (op.result === 'Red') dayData.reds++;
          });
        });

        const dailyData: DailyMethodData[] = Array.from(dailyMap.entries())
          .map(([date, data]) => {
            const total = data.greens + data.reds;
            return {
              date,
              greens: data.greens,
              reds: data.reds,
              winRate: total > 0 ? (data.greens / total) * 100 : 0,
              balance: data.greens - data.reds,
            };
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Previous period win rate for this method
        const prevMethodOps = previousOps.filter((op) => op.methodId === method.id);
        const prevMethodGreens = prevMethodOps.filter((op) => op.result === 'Green').length;
        const prevMethodTotal = prevMethodOps.length;
        const prevMethodWinRate = prevMethodTotal > 0 ? (prevMethodGreens / prevMethodTotal) * 100 : undefined;

        return {
          methodId: method.id,
          methodName: method.name,
          total: methodTotal,
          greens: methodGreens,
          reds: methodReds,
          winRate: parseFloat(methodWinRate.toFixed(1)),
          dailyData,
          previousWinRate: prevMethodWinRate !== undefined ? parseFloat(prevMethodWinRate.toFixed(1)) : undefined,
        };
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => b.winRate - a.winRate);

    // Daily breakdown
    const dayBreakdownMap = new Map<
      string,
      {
        totalGreens: number;
        totalReds: number;
        methods: Map<string, { methodName: string; greens: number; reds: number }>;
      }
    >();

    filteredGames.forEach((game) => {
      const ops = getFilteredOperations(game);
      if (ops.length === 0) return;

      if (!dayBreakdownMap.has(game.date)) {
        dayBreakdownMap.set(game.date, { totalGreens: 0, totalReds: 0, methods: new Map() });
      }
      const dayData = dayBreakdownMap.get(game.date)!;

      ops.forEach((op) => {
        const method = methods.find((m) => m.id === op.methodId);
        if (!method) return;

        if (!dayData.methods.has(op.methodId)) {
          dayData.methods.set(op.methodId, { methodName: method.name, greens: 0, reds: 0 });
        }
        const methodData = dayData.methods.get(op.methodId)!;

        if (op.result === 'Green') {
          dayData.totalGreens++;
          methodData.greens++;
        }
        if (op.result === 'Red') {
          dayData.totalReds++;
          methodData.reds++;
        }
      });
    });

    const dailyBreakdown: DayBreakdown[] = Array.from(dayBreakdownMap.entries())
      .map(([date, data]) => {
        const total = data.totalGreens + data.totalReds;
        return {
          date,
          totalGreens: data.totalGreens,
          totalReds: data.totalReds,
          totalWinRate: total > 0 ? (data.totalGreens / total) * 100 : 0,
          totalBalance: data.totalGreens - data.totalReds,
          methods: Array.from(data.methods.entries()).map(([methodId, mData]) => {
            const mTotal = mData.greens + mData.reds;
            return {
              methodId,
              methodName: mData.methodName,
              greens: mData.greens,
              reds: mData.reds,
              winRate: mTotal > 0 ? (mData.greens / mTotal) * 100 : 0,
              balance: mData.greens - mData.reds,
            };
          }),
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Method timeline (cumulative balance per method per day)
    const methodNames = methodDetailStats.map((m) => m.methodName);
    const allDates = [...new Set(filteredGames.map((g) => g.date))].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    const cumulativeBalances: Record<string, number> = {};
    methodNames.forEach((name) => {
      cumulativeBalances[name] = 0;
    });

    const methodTimeline: MethodTimelineData[] = allDates.map((date) => {
      const dayData = dailyBreakdown.find((d) => d.date === date);
      const entry: MethodTimelineData = { date };

      methodDetailStats.forEach((method) => {
        const methodDayData = dayData?.methods.find((m) => m.methodId === method.methodId);
        const dayBalance = methodDayData ? methodDayData.balance : 0;
        cumulativeBalances[method.methodName] += dayBalance;
        entry[method.methodName] = cumulativeBalances[method.methodName];
      });

      return entry;
    });

    // Comparison stats
    const bestMethod =
      methodDetailStats.length > 0 ? { name: methodDetailStats[0].methodName, winRate: methodDetailStats[0].winRate } : null;

    const comparison: ComparisonStats = {
      currentWinRate: overallStats.winRate,
      previousWinRate: parseFloat(previousWinRate.toFixed(1)),
      winRateChange: parseFloat((overallStats.winRate - previousWinRate).toFixed(1)),
      currentVolume: overallStats.total,
      previousVolume: previousTotal,
      volumeChange: overallStats.total - previousTotal,
      bestMethod,
    };

    return {
      overallStats,
      methodDetailStats,
      dailyBreakdown,
      methodTimeline,
      methodNames,
      comparison,
      leagues,
    };
  }, [games, methods, filters]);
};
