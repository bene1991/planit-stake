import { useMemo } from 'react';
import { useSupabaseGames } from './useSupabaseGames';
import { useOperationalSettings } from './useOperationalSettings';
import { OperationalFilters } from '@/components/OperationalFilterBar';
import { calculateProfit } from '@/utils/profitCalculator';

export type OperationalStatusType = 'NORMAL' | 'ALERTA' | 'PROTEÇÃO' | 'PAUSADO';

interface OperationWithDate {
  result: 'Green' | 'Red' | null;
  date: string;
  profit: number | null;
  stakeValue: number | null;
  methodId: string;
  league: string;
  operationType: 'Back' | 'Lay' | null;
  odd: number | null;
}

interface StreakInfo {
  type: 'Green' | 'Red' | null;
  count: number;
}

export interface OperationalMetrics {
  currentStreak: StreakInfo;
  maxRedStreakPeriod: number;
  maxGreenStreakPeriod: number;
  dailyProfitStakes: number;
  dailyProfitMoney: number;
  periodProfitStakes: number;
  periodProfitMoney: number;
  peakProfit: number;
  currentDrawdown: number;
  status: OperationalStatusType;
  statusMessage: string;
  totalOperationsToday: number;
  totalOperationsPeriod: number;
  operationsWithFinancialData: number;
  operationsWithoutFinancialData: number;
}

export const useOperationalStatus = (filters?: OperationalFilters) => {
  const { games, loading: gamesLoading } = useSupabaseGames();
  const { settings, loading: settingsLoading } = useOperationalSettings();

  const metrics = useMemo<OperationalMetrics>(() => {
    // Flatten all operations from games
    let allOperations: OperationWithDate[] = [];
    
    games.forEach(game => {
      game.methodOperations.forEach(op => {
        if (op.result) {
          allOperations.push({
            result: op.result,
            date: game.date,
            profit: op.profit ?? null,
            stakeValue: op.stakeValue ?? null,
            methodId: op.methodId,
            league: game.league,
            operationType: op.operationType ?? null,
            odd: op.odd ?? null
          });
        }
      });
    });

    // Apply filters
    if (filters?.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      allOperations = allOperations.filter(op => {
        const opDate = new Date(op.date);
        opDate.setHours(0, 0, 0, 0);
        return opDate >= fromDate;
      });
    }
    if (filters?.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      allOperations = allOperations.filter(op => {
        const opDate = new Date(op.date);
        opDate.setHours(0, 0, 0, 0);
        return opDate <= toDate;
      });
    }
    if (filters?.selectedMethods && filters.selectedMethods.length > 0) {
      allOperations = allOperations.filter(op => 
        filters.selectedMethods.includes(op.methodId)
      );
    }
    if (filters?.selectedLeagues && filters.selectedLeagues.length > 0) {
      allOperations = allOperations.filter(op => 
        filters.selectedLeagues.includes(op.league)
      );
    }

    // Sort by date descending for streak calculation
    const sortedOps = [...allOperations].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Calculate current streak
    let currentStreak: StreakInfo = { type: null, count: 0 };
    for (const op of sortedOps) {
      if (!op.result) continue;
      if (currentStreak.type === null) {
        currentStreak = { type: op.result, count: 1 };
      } else if (op.result === currentStreak.type) {
        currentStreak.count++;
      } else {
        break;
      }
    }

    // Get today
    const today = new Date().toISOString().split('T')[0];

    // Filter operations for today
    const todayOps = allOperations.filter(op => op.date === today);

    // Period operations = all filtered operations
    const periodOps = allOperations;

    // Calculate max streaks for the period
    let maxRedStreakPeriod = 0;
    let maxGreenStreakPeriod = 0;
    let tempRedStreak = 0;
    let tempGreenStreak = 0;

    // Sort period ops by date for streak calculation
    const sortedPeriodOps = [...periodOps].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const op of sortedPeriodOps) {
      if (op.result === 'Red') {
        tempRedStreak++;
        tempGreenStreak = 0;
        maxRedStreakPeriod = Math.max(maxRedStreakPeriod, tempRedStreak);
      } else if (op.result === 'Green') {
        tempGreenStreak++;
        tempRedStreak = 0;
        maxGreenStreakPeriod = Math.max(maxGreenStreakPeriod, tempGreenStreak);
      }
    }

    // Helper function to calculate profit for an operation
    const getOperationProfit = (op: OperationWithDate): number | null => {
      // If profit is already calculated, use it
      if (op.profit !== null) {
        return op.profit;
      }
      // If we have all required data, calculate profit in real-time
      if (op.stakeValue && op.odd && op.operationType && op.result) {
        return calculateProfit({
          stakeValue: op.stakeValue,
          odd: op.odd,
          operationType: op.operationType,
          result: op.result,
          commissionRate: settings.commissionRate
        });
      }
      return null;
    };

    // Helper function to calculate profit in stakes
    const getProfitInStakes = (op: OperationWithDate): number => {
      const profit = getOperationProfit(op);
      if (profit !== null && op.stakeValue) {
        return profit / op.stakeValue;
      }
      // No fallback - if no financial data, return 0
      return 0;
    };

    // Calculate profits using real stake values only
    const dailyProfitStakes = todayOps.reduce((acc, op) => acc + getProfitInStakes(op), 0);
    const periodProfitStakes = periodOps.reduce((acc, op) => acc + getProfitInStakes(op), 0);

    // Money: use calculated profit values
    const dailyProfitMoney = todayOps.reduce((acc, op) => acc + (getOperationProfit(op) ?? 0), 0);
    const periodProfitMoney = periodOps.reduce((acc, op) => acc + (getOperationProfit(op) ?? 0), 0);

    // Count operations with/without complete financial data (stake + odd + operationType)
    const operationsWithFinancialData = periodOps.filter(op => 
      op.stakeValue && op.odd && op.operationType
    ).length;
    const operationsWithoutFinancialData = periodOps.length - operationsWithFinancialData;

    // Calculate peak profit and drawdown for the period
    let runningProfit = 0;
    let peakProfit = 0;

    for (const op of sortedPeriodOps) {
      runningProfit += getProfitInStakes(op);
      peakProfit = Math.max(peakProfit, runningProfit);
    }

    const currentDrawdown = peakProfit - periodProfitStakes;

    // Calculate status
    let status: OperationalStatusType = 'NORMAL';
    let statusMessage = 'Operações dentro dos parâmetros normais';

    const redStreakLimit = 8;
    const alertRedStreak = 6;
    const metaAtingida = periodProfitStakes >= settings.metaMensalStakes;
    const stopDiarioAtingido = dailyProfitStakes <= -settings.stopDiarioStakes;
    const devolucaoExcessiva = metaAtingida && peakProfit > 0 &&
      (currentDrawdown / peakProfit) * 100 >= settings.devolucaoMaximaPercent;

    if (currentStreak.type === 'Red' && currentStreak.count >= redStreakLimit) {
      status = 'PAUSADO';
      statusMessage = `Sequência de ${currentStreak.count} reds. Pare e analise.`;
    } else if (stopDiarioAtingido) {
      status = 'PAUSADO';
      statusMessage = `Stop diário de ${settings.stopDiarioStakes} stakes atingido.`;
    } else if (devolucaoExcessiva) {
      status = 'PAUSADO';
      statusMessage = `Devolução de ${settings.devolucaoMaximaPercent}% pós-meta atingida.`;
    } else if (metaAtingida) {
      status = 'PROTEÇÃO';
      statusMessage = `Meta de ${settings.metaMensalStakes} stakes atingida! Proteja seu lucro.`;
    } else if (currentStreak.type === 'Red' && currentStreak.count >= alertRedStreak) {
      status = 'ALERTA';
      statusMessage = `Atenção: ${currentStreak.count} reds consecutivos.`;
    }

    return {
      currentStreak,
      maxRedStreakPeriod,
      maxGreenStreakPeriod,
      dailyProfitStakes: Math.round(dailyProfitStakes * 100) / 100,
      dailyProfitMoney,
      periodProfitStakes: Math.round(periodProfitStakes * 100) / 100,
      periodProfitMoney,
      peakProfit: Math.round(peakProfit * 100) / 100,
      currentDrawdown: Math.round(currentDrawdown * 100) / 100,
      status,
      statusMessage,
      totalOperationsToday: todayOps.length,
      totalOperationsPeriod: periodOps.length,
      operationsWithFinancialData,
      operationsWithoutFinancialData
    };
  }, [games, settings, filters]);

  return {
    metrics,
    settings,
    loading: gamesLoading || settingsLoading
  };
};
