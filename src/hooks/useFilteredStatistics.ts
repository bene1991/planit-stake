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
  profitReais: number;
  combinedScore: number;
  activeDays: number;
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
  [methodName: string]: number | string; // now stores cumulative profit in R$
}

interface ComparisonStats {
  currentWinRate: number;
  previousWinRate: number;
  winRateChange: number;
  currentVolume: number;
  previousVolume: number;
  volumeChange: number;
  bestMethod: { 
    name: string; 
    winRate: number;
    volume: number;
    profitReais: number;
    combinedScore: number;
  } | null;
}

export interface BankrollEvolutionData {
  date: string;
  cumulativeReais: number;
  dailyChangeReais: number;
}

export interface OddRangeStats {
  range: string;
  min: number;
  max: number;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
  breakeven: number;
  profit: number;
}

export interface TeamStats {
  team: string;
  gamesCount: number;
  operations: number;
  greens: number;
  reds: number;
  winRate: number;
  profit: number;
}

export interface LeagueStats {
  league: string;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
  profit: number;
  averageOdd: number;
}

export interface FilteredStatisticsResult {
  overallStats: OverallStats;
  methodDetailStats: MethodDetailStats[];
  dailyBreakdown: DayBreakdown[];
  methodTimeline: MethodTimelineData[];
  methodNames: string[];
  comparison: ComparisonStats;
  leagues: string[];
  leagueStats: LeagueStats[];
  averageOdd: number;
  operationsWithOdd: number;
  breakevenRate: number;
  bankrollEvolution: BankrollEvolutionData[];
  oddRangeStats: OddRangeStats[];
  teamStats: TeamStats[];
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

      // Date filter - use T12:00:00 to avoid timezone shift
      if (filters.dateFrom && filters.dateTo) {
        const gameDate = new Date(`${game.date}T12:00:00`);
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

        const gameDate = new Date(`${game.date}T12:00:00`);
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

    // Calculate method-specific stats with profit and combined score
    const methodStatsRaw = methods
      .filter((m) => filters.selectedMethods.length === 0 || filters.selectedMethods.includes(m.id))
      .map((method) => {
        const methodOps = allFilteredOps.filter((op) => op.methodId === method.id);
        const methodGreens = methodOps.filter((op) => op.result === 'Green').length;
        const methodReds = methodOps.filter((op) => op.result === 'Red').length;
        const methodTotal = methodOps.length;
        const methodWinRate = methodTotal > 0 ? (methodGreens / methodTotal) * 100 : 0;

        // Calculate profit in R$ for this method
        let profitReais = 0;
        methodOps.forEach((op) => {
          if (op.profit !== undefined && op.profit !== null) {
            profitReais += op.profit;
          } else if (op.stakeValue && op.odd && op.odd > 0 && op.operationType) {
            const commissionRate = op.commissionRate ?? 0.045;
            if (op.operationType === 'Back') {
              if (op.result === 'Green') {
                profitReais += op.stakeValue * (op.odd - 1) * (1 - commissionRate);
              } else {
                profitReais -= op.stakeValue;
              }
            } else { // Lay
              if (op.result === 'Green') {
                profitReais += op.stakeValue * (1 - commissionRate);
              } else {
                profitReais -= op.stakeValue * (op.odd - 1);
              }
            }
          }
        });

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

        // Calculate method breakeven based on average odd
        const methodOpsWithOdd = methodOps.filter(op => op.odd && op.odd > 0);
        const methodAvgOdd = methodOpsWithOdd.length > 0 
          ? methodOpsWithOdd.reduce((sum, op) => sum + (op.odd || 0), 0) / methodOpsWithOdd.length
          : 2.0;
        const methodBreakeven = 100 / methodAvgOdd;

        return {
          methodId: method.id,
          methodName: method.name,
          total: methodTotal,
          greens: methodGreens,
          reds: methodReds,
          winRate: parseFloat(methodWinRate.toFixed(1)),
          dailyData,
          previousWinRate: prevMethodWinRate !== undefined ? parseFloat(prevMethodWinRate.toFixed(1)) : undefined,
          profitReais: parseFloat(profitReais.toFixed(2)),
          activeDays: dailyMap.size,
          breakeven: methodBreakeven,
        };
      })
      .filter((s) => s.total > 0);

    // Calculate combined score for each method
    const avgVolume = methodStatsRaw.length > 0 
      ? methodStatsRaw.reduce((sum, m) => sum + m.total, 0) / methodStatsRaw.length 
      : 1;
    const totalActiveDays = new Set(filteredGames.map(g => g.date)).size;
    const maxProfit = Math.max(...methodStatsRaw.map(m => Math.abs(m.profitReais)), 1);

    const methodDetailStats: MethodDetailStats[] = methodStatsRaw.map((method) => {
      // Win Rate Score (0-100) - 35% weight
      const wrDiff = method.winRate - method.breakeven;
      let wrScore: number;
      if (method.winRate >= method.breakeven) {
        wrScore = 50 + Math.min(50, wrDiff * 5);
      } else {
        wrScore = Math.max(0, 50 - Math.abs(wrDiff) * 5);
      }

      // Volume Score (0-100) - 25% weight
      let volumeScore = Math.min(100, (method.total / avgVolume) * 50);
      // Bonus for consistency (present in >50% of active days)
      if (totalActiveDays > 0 && method.activeDays / totalActiveDays > 0.5) {
        volumeScore = Math.min(100, volumeScore + 10);
      }
      // Penalty for very low volume (<5 operations)
      if (method.total < 5) {
        volumeScore = volumeScore * (method.total / 5);
      }

      // Profit Score (0-100) - 40% weight
      const normalizedProfit = (method.profitReais / maxProfit) * 50;
      let profitScore: number;
      if (method.profitReais >= 0) {
        profitScore = 50 + Math.min(50, normalizedProfit);
      } else {
        profitScore = Math.max(0, 50 + normalizedProfit);
      }

      // Combined Score with weights
      const combinedScore = parseFloat(
        ((wrScore * 0.35) + (volumeScore * 0.25) + (profitScore * 0.40)).toFixed(1)
      );

      return {
        methodId: method.methodId,
        methodName: method.methodName,
        total: method.total,
        greens: method.greens,
        reds: method.reds,
        winRate: method.winRate,
        dailyData: method.dailyData,
        previousWinRate: method.previousWinRate,
        profitReais: method.profitReais,
        combinedScore,
        activeDays: method.activeDays,
      };
    }).sort((a, b) => b.combinedScore - a.combinedScore);

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

    // Method timeline (cumulative profit in R$ per method per day)
    const methodNames = methodDetailStats.map((m) => m.methodName);
    const allDates = [...new Set(filteredGames.map((g) => g.date))].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    // Build a map of daily profit per method (in R$)
    const dailyMethodProfitMap = new Map<string, Map<string, number>>();
    
    filteredGames.forEach((game) => {
      const ops = getFilteredOperations(game);
      ops.forEach((op) => {
        if (!op.result) return;
        
        const method = methods.find((m) => m.id === op.methodId);
        if (!method) return;
        
        // Get profit in R$ - use same calculation as useOperationalStatus for consistency
        let profitReais = 0;
        if (op.profit !== undefined && op.profit !== null) {
          profitReais = op.profit;
        } else if (op.stakeValue && op.odd && op.odd > 0 && op.operationType) {
          const commissionRate = op.commissionRate ?? 0.045;
          if (op.operationType === 'Back') {
            if (op.result === 'Green') {
              profitReais = op.stakeValue * (op.odd - 1) * (1 - commissionRate);
            } else {
              profitReais = -op.stakeValue;
            }
          } else { // Lay
            if (op.result === 'Green') {
              profitReais = op.stakeValue * (1 - commissionRate);
            } else {
              profitReais = -op.stakeValue * (op.odd - 1);
            }
          }
        }
        
        if (!dailyMethodProfitMap.has(game.date)) {
          dailyMethodProfitMap.set(game.date, new Map());
        }
        const dayMap = dailyMethodProfitMap.get(game.date)!;
        const current = dayMap.get(method.name) || 0;
        dayMap.set(method.name, current + profitReais);
      });
    });

    const cumulativeBalances: Record<string, number> = {};
    methodNames.forEach((name) => {
      cumulativeBalances[name] = 0;
    });

    const methodTimeline: MethodTimelineData[] = allDates.map((date) => {
      const entry: MethodTimelineData = { date };
      const dayProfitMap = dailyMethodProfitMap.get(date);

      methodDetailStats.forEach((method) => {
        const dayProfit = dayProfitMap?.get(method.methodName) || 0;
        cumulativeBalances[method.methodName] += dayProfit;
        entry[method.methodName] = parseFloat(cumulativeBalances[method.methodName].toFixed(2));
      });

      return entry;
    });

    // Comparison stats - best method now based on combined score
    const bestMethod = methodDetailStats.length > 0 
      ? { 
          name: methodDetailStats[0].methodName, 
          winRate: methodDetailStats[0].winRate,
          volume: methodDetailStats[0].total,
          profitReais: methodDetailStats[0].profitReais,
          combinedScore: methodDetailStats[0].combinedScore,
        } 
      : null;

    const comparison: ComparisonStats = {
      currentWinRate: overallStats.winRate,
      previousWinRate: parseFloat(previousWinRate.toFixed(1)),
      winRateChange: parseFloat((overallStats.winRate - previousWinRate).toFixed(1)),
      currentVolume: overallStats.total,
      previousVolume: previousTotal,
      volumeChange: overallStats.total - previousTotal,
      bestMethod,
    };

    // Calculate average odd
    const operationsWithOdd = allFilteredOps.filter(op => op.odd && op.odd > 0);
    const averageOdd = operationsWithOdd.length > 0 
      ? operationsWithOdd.reduce((sum, op) => sum + (op.odd || 0), 0) / operationsWithOdd.length
      : 0;
    const breakevenRate = averageOdd > 0 ? 100 / averageOdd : 0;

    // Calculate win rate by odd range
    const oddRanges = [
      { range: '1.80 - 2.00', min: 1.80, max: 2.00 },
      { range: '2.01 - 2.20', min: 2.01, max: 2.20 },
      { range: '2.21 - 2.40', min: 2.21, max: 2.40 },
      { range: '2.41 - 2.60', min: 2.41, max: 2.60 },
      { range: '2.61 - 2.80', min: 2.61, max: 2.80 },
      { range: '2.81+', min: 2.81, max: Infinity },
    ];

    const oddRangeStats: OddRangeStats[] = oddRanges.map(({ range, min, max }) => {
      const rangeOps = operationsWithOdd.filter(op => {
        const odd = op.odd || 0;
        return odd >= min && odd <= max;
      });
      
      const greens = rangeOps.filter(op => op.result === 'Green').length;
      const reds = rangeOps.filter(op => op.result === 'Red').length;
      const total = rangeOps.length;
      const winRate = total > 0 ? (greens / total) * 100 : 0;
      
      // Calculate average odd for this range to get breakeven
      const rangeAvgOdd = total > 0 
        ? rangeOps.reduce((sum, op) => sum + (op.odd || 0), 0) / total 
        : (min + (max === Infinity ? min + 0.5 : max)) / 2;
      const rangeBreakeven = 100 / rangeAvgOdd;

      // Calculate profit in stakes for this range
      let rangeProfit = 0;
      rangeOps.forEach((op) => {
        if (op.profit !== undefined && op.profit !== null && op.stakeValue && op.stakeValue > 0) {
          rangeProfit += op.profit / op.stakeValue;
        } else if (op.result === 'Green') {
          rangeProfit += op.odd && op.odd > 0 ? op.odd - 1 : 0;
        } else if (op.result === 'Red') {
          rangeProfit -= 1;
        }
      });

      return {
        range,
        min,
        max,
        total,
        greens,
        reds,
        winRate: parseFloat(winRate.toFixed(1)),
        breakeven: parseFloat(rangeBreakeven.toFixed(1)),
        profit: parseFloat(rangeProfit.toFixed(2)),
      };
    }).filter(r => r.total > 0);

    // Calculate bankroll evolution (cumulative profit in R$ per day)
    // IMPORTANT: This must match the calculation in useOperationalStatus for consistency
    const dailyProfitReaisMap = new Map<string, number>();
    
    filteredGames.forEach((game) => {
      const ops = getFilteredOperations(game);
      ops.forEach((op) => {
        if (!op.result) return;
        
        // Use actual profit in R$ if available
        let profitReais = 0;
        if (op.profit !== undefined && op.profit !== null) {
          profitReais = op.profit;
        } else if (op.stakeValue && op.odd && op.odd > 0 && op.operationType) {
          // Calculate profit based on operation type (same logic as useOperationalStatus)
          const commissionRate = op.commissionRate ?? 0.045;
          if (op.operationType === 'Back') {
            if (op.result === 'Green') {
              profitReais = op.stakeValue * (op.odd - 1) * (1 - commissionRate);
            } else {
              profitReais = -op.stakeValue;
            }
          } else { // Lay
            if (op.result === 'Green') {
              profitReais = op.stakeValue * (1 - commissionRate);
            } else {
              profitReais = -op.stakeValue * (op.odd - 1);
            }
          }
        }
        
        const current = dailyProfitReaisMap.get(game.date) || 0;
        dailyProfitReaisMap.set(game.date, current + profitReais);
      });
    });

    const sortedDates = Array.from(dailyProfitReaisMap.keys()).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    let cumulative = 0;
    const bankrollEvolution: BankrollEvolutionData[] = sortedDates.map((date) => {
      const dailyChange = dailyProfitReaisMap.get(date) || 0;
      cumulative += dailyChange;
      return {
        date,
        cumulativeReais: parseFloat(cumulative.toFixed(2)),
        dailyChangeReais: parseFloat(dailyChange.toFixed(2)),
      };
    });

    // Calculate team statistics
    const teamMap = new Map<string, {
      gamesSet: Set<string>;
      operations: number;
      greens: number;
      reds: number;
      profit: number;
    }>();

    filteredGames.forEach((game) => {
      const ops = getFilteredOperations(game);
      if (ops.length === 0) return;

      [game.homeTeam, game.awayTeam].forEach((team) => {
        if (!teamMap.has(team)) {
          teamMap.set(team, {
            gamesSet: new Set(),
            operations: 0,
            greens: 0,
            reds: 0,
            profit: 0,
          });
        }
        const teamData = teamMap.get(team)!;
        teamData.gamesSet.add(game.id);

        ops.forEach((op) => {
          teamData.operations++;
          if (op.result === 'Green') teamData.greens++;
          if (op.result === 'Red') teamData.reds++;

          // Calculate profit in stakes
          if (op.profit !== undefined && op.profit !== null && op.stakeValue && op.stakeValue > 0) {
            teamData.profit += op.profit / op.stakeValue;
          } else if (op.result === 'Green') {
            teamData.profit += op.odd && op.odd > 0 ? op.odd - 1 : 0;
          } else if (op.result === 'Red') {
            teamData.profit -= 1;
          }
        });
      });
    });

    const teamStats: TeamStats[] = Array.from(teamMap.entries())
      .map(([team, data]) => ({
        team,
        gamesCount: data.gamesSet.size,
        operations: data.operations,
        greens: data.greens,
        reds: data.reds,
        winRate: data.operations > 0 ? parseFloat(((data.greens / data.operations) * 100).toFixed(1)) : 0,
        profit: parseFloat(data.profit.toFixed(2)),
      }))
      .filter((stat) => stat.gamesCount >= 2)
      .sort((a, b) => b.winRate - a.winRate);

    // Calculate league statistics with profit and averageOdd
    const leagueMap = new Map<string, {
      operations: number;
      greens: number;
      reds: number;
      profit: number;
      totalOdds: number;
      oddsCount: number;
    }>();

    filteredGames.forEach((game) => {
      const ops = getFilteredOperations(game);
      if (ops.length === 0) return;

      if (!leagueMap.has(game.league)) {
        leagueMap.set(game.league, {
          operations: 0,
          greens: 0,
          reds: 0,
          profit: 0,
          totalOdds: 0,
          oddsCount: 0,
        });
      }
      const leagueData = leagueMap.get(game.league)!;

      ops.forEach((op) => {
        leagueData.operations++;
        if (op.result === 'Green') leagueData.greens++;
        if (op.result === 'Red') leagueData.reds++;

        // Average odd
        if (op.odd && op.odd > 0) {
          leagueData.totalOdds += op.odd;
          leagueData.oddsCount++;
        }

        // Profit in stakes
        if (op.profit !== undefined && op.profit !== null && op.stakeValue && op.stakeValue > 0) {
          leagueData.profit += op.profit / op.stakeValue;
        } else if (op.result === 'Green') {
          leagueData.profit += op.odd && op.odd > 0 ? op.odd - 1 : 0;
        } else if (op.result === 'Red') {
          leagueData.profit -= 1;
        }
      });
    });

    const leagueStats: LeagueStats[] = Array.from(leagueMap.entries())
      .map(([league, data]) => ({
        league,
        total: data.operations,
        greens: data.greens,
        reds: data.reds,
        winRate: data.operations > 0 ? parseFloat(((data.greens / data.operations) * 100).toFixed(1)) : 0,
        profit: parseFloat(data.profit.toFixed(2)),
        averageOdd: data.oddsCount > 0 ? parseFloat((data.totalOdds / data.oddsCount).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.winRate - a.winRate);

    return {
      overallStats,
      methodDetailStats,
      dailyBreakdown,
      methodTimeline,
      methodNames,
      comparison,
      leagues,
      leagueStats,
      averageOdd: parseFloat(averageOdd.toFixed(2)),
      operationsWithOdd: operationsWithOdd.length,
      breakevenRate: parseFloat(breakevenRate.toFixed(1)),
      bankrollEvolution,
      oddRangeStats,
      teamStats,
    };
  }, [games, methods, filters]);
};
