import { useMemo } from 'react';
import { useSupabaseGames } from './useSupabaseGames';
import { useOperationalSettings } from './useOperationalSettings';

export type OperationalStatusType = 'NORMAL' | 'ALERTA' | 'PROTEÇÃO' | 'PAUSADO';

interface OperationWithDate {
  result: 'Green' | 'Red' | null;
  date: string;
  profit: number | null;
  stakeValue: number | null;
}

interface StreakInfo {
  type: 'Green' | 'Red' | null;
  count: number;
}

export interface OperationalMetrics {
  currentStreak: StreakInfo;
  maxRedStreakMonth: number;
  maxGreenStreakMonth: number;
  dailyProfitStakes: number;
  dailyProfitMoney: number;
  monthlyProfitStakes: number;
  monthlyProfitMoney: number;
  peakProfit: number;
  currentDrawdown: number;
  status: OperationalStatusType;
  statusMessage: string;
  totalOperationsToday: number;
  totalOperationsMonth: number;
}

export const useOperationalStatus = () => {
  const { games, loading: gamesLoading } = useSupabaseGames();
  const { settings, loading: settingsLoading } = useOperationalSettings();

  const metrics = useMemo<OperationalMetrics>(() => {
    // Flatten all operations from games
    const allOperations: OperationWithDate[] = [];
    
    games.forEach(game => {
      game.methodOperations.forEach(op => {
        if (op.result) {
          allOperations.push({
            result: op.result,
            date: game.date,
            profit: op.profit ?? null,
            stakeValue: op.stakeValue ?? null
          });
        }
      });
    });

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

    // Get current month and today
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];

    // Filter operations for current month
    const monthOps = allOperations.filter(op => {
      const opDate = new Date(op.date);
      return opDate.getMonth() === currentMonth && opDate.getFullYear() === currentYear;
    });

    // Filter operations for today
    const todayOps = allOperations.filter(op => op.date === today);

    // Calculate max streaks for the month
    let maxRedStreakMonth = 0;
    let maxGreenStreakMonth = 0;
    let tempRedStreak = 0;
    let tempGreenStreak = 0;

    // Sort month ops by date for streak calculation
    const sortedMonthOps = [...monthOps].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const op of sortedMonthOps) {
      if (op.result === 'Red') {
        tempRedStreak++;
        tempGreenStreak = 0;
        maxRedStreakMonth = Math.max(maxRedStreakMonth, tempRedStreak);
      } else if (op.result === 'Green') {
        tempGreenStreak++;
        tempRedStreak = 0;
        maxGreenStreakMonth = Math.max(maxGreenStreakMonth, tempGreenStreak);
      }
    }

    // Calculate profits
    // Stakes: Green = +1, Red = -1
    const dailyProfitStakes = todayOps.reduce((acc, op) => {
      return acc + (op.result === 'Green' ? 1 : -1);
    }, 0);

    const monthlyProfitStakes = monthOps.reduce((acc, op) => {
      return acc + (op.result === 'Green' ? 1 : -1);
    }, 0);

    // Money: use actual profit values if available
    const dailyProfitMoney = todayOps.reduce((acc, op) => {
      return acc + (op.profit ?? 0);
    }, 0);

    const monthlyProfitMoney = monthOps.reduce((acc, op) => {
      return acc + (op.profit ?? 0);
    }, 0);

    // Calculate peak profit and drawdown for the month
    let runningProfit = 0;
    let peakProfit = 0;

    for (const op of sortedMonthOps) {
      runningProfit += op.result === 'Green' ? 1 : -1;
      peakProfit = Math.max(peakProfit, runningProfit);
    }

    const currentDrawdown = peakProfit - monthlyProfitStakes;

    // Calculate status
    let status: OperationalStatusType = 'NORMAL';
    let statusMessage = 'Operações dentro dos parâmetros normais';

    const redStreakLimit = 8;
    const alertRedStreak = 6;
    const metaAtingida = monthlyProfitStakes >= settings.metaMensalStakes;
    const stopDiarioAtingido = dailyProfitStakes <= -settings.stopDiarioStakes;
    const devolucaoExcessiva = metaAtingida && 
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
      statusMessage = `Meta mensal de ${settings.metaMensalStakes} stakes atingida! Proteja seu lucro.`;
    } else if (currentStreak.type === 'Red' && currentStreak.count >= alertRedStreak) {
      status = 'ALERTA';
      statusMessage = `Atenção: ${currentStreak.count} reds consecutivos.`;
    }

    return {
      currentStreak,
      maxRedStreakMonth,
      maxGreenStreakMonth,
      dailyProfitStakes,
      dailyProfitMoney,
      monthlyProfitStakes,
      monthlyProfitMoney,
      peakProfit,
      currentDrawdown,
      status,
      statusMessage,
      totalOperationsToday: todayOps.length,
      totalOperationsMonth: monthOps.length
    };
  }, [games, settings]);

  return {
    metrics,
    settings,
    loading: gamesLoading || settingsLoading
  };
};
