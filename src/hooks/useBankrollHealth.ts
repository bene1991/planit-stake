import { useMemo } from "react";
import { Game } from "@/types";
import { calculateProfit } from "@/utils/profitCalculator";

interface MethodOperationWithGame {
  result?: string | null;
  profit?: number | null;
  stakeValue?: number | null;
  odd?: number | null;
  operationType?: string | null;
  methodId: string;
  methodName?: string;
  gameDate: string;
  league?: string;
}

interface BankrollHealthMetrics {
  score: number;
  classification: "Excelente" | "Bom" | "Regular" | "Atenção" | "Crítico";
  classificationColor: string;
  
  // Advanced metrics
  recoveryRate: number; // Total Profit / Total Loss
  ruinCoefficient: number; // Drawdown / Bankroll ratio
  maxRunUp: number; // Maximum positive run in R$
  maxDrawdown: number; // Maximum negative run in R$
  maxProfit: number; // Largest single win
  maxLoss: number; // Largest single loss
  
  // Distribution data
  profitDays: number;
  lossDays: number;
  totalDays: number;
  avgDailyProfit: number;
  avgOperationProfit: number;
}

interface UseBankrollHealthProps {
  games: Game[];
  totalProfit: number;
  winRate: number;
  breakevenRate: number;
  targetMonthlyStakes?: number;
  stakeValueReais?: number;
  bankrollTotal?: number;
  uniqueLeagues?: number;
  uniqueMethods?: number;
  selectedMethods?: string[];
}

export function useBankrollHealth({
  games,
  totalProfit,
  winRate,
  breakevenRate,
  targetMonthlyStakes = 30,
  stakeValueReais = 100,
  bankrollTotal,
  uniqueLeagues = 1,
  uniqueMethods = 1,
  selectedMethods,
}: UseBankrollHealthProps): BankrollHealthMetrics {
  return useMemo(() => {
    // Extract all operations with results, filtered by selected methods
    const allOperations: MethodOperationWithGame[] = [];
    
    games.forEach(game => {
      game.methodOperations?.forEach(op => {
        if (!op.result) return;
        
        // Filter by method if selection exists
        if (selectedMethods && selectedMethods.length > 0) {
          if (!selectedMethods.includes(op.methodId)) return;
        }
        
        allOperations.push({
          result: op.result,
          profit: op.profit,
          stakeValue: op.stakeValue,
          odd: op.odd,
          operationType: op.operationType,
          methodId: op.methodId,
          gameDate: game.date,
          league: game.league,
        });
      });
    });

    // Helper: use stored profit or calculate fallback
    const getProfit = (op: MethodOperationWithGame): number => {
      if (op.profit !== null && op.profit !== undefined) return op.profit;
      if (op.stakeValue && op.odd && op.operationType && op.result) {
        return calculateProfit({
          stakeValue: op.stakeValue,
          odd: op.odd,
          operationType: op.operationType as 'Back' | 'Lay',
          result: op.result as 'Green' | 'Red',
          commissionRate: 0.045,
        });
      }
      return 0;
    };

    // Calculate total profits and losses
    let totalProfitSum = 0;
    let totalLossSum = 0;
    let maxProfit = 0;
    let maxLoss = 0;

    allOperations.forEach(op => {
      const profit = getProfit(op);
      if (profit > 0) {
        totalProfitSum += profit;
        if (profit > maxProfit) maxProfit = profit;
      } else if (profit < 0) {
        totalLossSum += Math.abs(profit);
        if (Math.abs(profit) > maxLoss) maxLoss = Math.abs(profit);
      }
    });

    // Calculate daily profits for run-up/drawdown
    const dailyProfits: { [date: string]: number } = {};
    allOperations.forEach(op => {
      const profit = getProfit(op);
      if (!dailyProfits[op.gameDate]) {
        dailyProfits[op.gameDate] = 0;
      }
      dailyProfits[op.gameDate] += profit;
    });

    const sortedDates = Object.keys(dailyProfits).sort();
    let cumulativeProfit = 0;
    let peak = 0;
    let maxRunUp = 0;
    let maxDrawdown = 0;
    let profitDays = 0;
    let lossDays = 0;

    sortedDates.forEach(date => {
      const dailyProfit = dailyProfits[date];
      cumulativeProfit += dailyProfit;
      
      if (dailyProfit > 0) profitDays++;
      if (dailyProfit < 0) lossDays++;

      // Track peak and drawdown
      if (cumulativeProfit > peak) {
        peak = cumulativeProfit;
        maxRunUp = Math.max(maxRunUp, peak);
      }
      
      const drawdown = peak - cumulativeProfit;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    // Calculate metrics
    const recoveryRate = totalLossSum > 0 ? totalProfitSum / totalLossSum : totalProfitSum > 0 ? 10 : 0;
    const actualBankroll = bankrollTotal || (stakeValueReais * 100); // Use real bankroll, fallback to estimate
    const ruinCoefficient = actualBankroll > 0 ? maxDrawdown / actualBankroll : 0;
    const totalDays = sortedDates.length;
    const avgDailyProfit = totalDays > 0 ? totalProfit / totalDays : 0;
    const avgOperationProfit = allOperations.length > 0 ? totalProfit / allOperations.length : 0;

    // Calculate SCORE (0-100)
    // Components:
    // 1. Win Rate vs Breakeven (25%) - how much above breakeven
    // 2. Profit vs Target (20%) - progress toward monthly goal
    // 3. Consistency (15%) - profit days / total days
    // 4. Drawdown ratio (15%) - inverse of ruin coefficient
    // 5. Volume (10%) - number of operations
    // 6. Diversification (15%) - leagues and methods

    // 1. Win Rate Score (0-25)
    const wrDiff = winRate - breakevenRate;
    const wrScore = Math.min(25, Math.max(0, 12.5 + (wrDiff * 1.25))); // +/-10% WR diff maps to 0-25

    // 2. Profit vs Target Score (0-20)
    const targetProfit = targetMonthlyStakes * stakeValueReais;
    const profitProgress = targetProfit > 0 ? (totalProfit / targetProfit) * 100 : 0;
    const profitScore = Math.min(20, Math.max(0, profitProgress * 0.2));

    // 3. Consistency Score (0-15)
    const consistencyRatio = totalDays > 0 ? profitDays / totalDays : 0;
    const consistencyScore = consistencyRatio * 15;

    // 4. Drawdown Score (0-15) - lower is better
    const drawdownScore = Math.max(0, 15 - (ruinCoefficient * 30));

    // 5. Volume Score (0-10)
    const volumeScore = Math.min(10, allOperations.length / 10);

    // 6. Diversification Score (0-15)
    const leagueDiversity = Math.min(5, uniqueLeagues);
    const methodDiversity = Math.min(3, uniqueMethods);
    const diversificationScore = (leagueDiversity / 5) * 7.5 + (methodDiversity / 3) * 7.5;

    const rawScore = wrScore + profitScore + consistencyScore + drawdownScore + volumeScore + diversificationScore;
    const score = Math.round(Math.min(100, Math.max(0, rawScore)));

    // Determine classification
    let classification: BankrollHealthMetrics["classification"];
    let classificationColor: string;

    if (score >= 80) {
      classification = "Excelente";
      classificationColor = "text-emerald-500";
    } else if (score >= 60) {
      classification = "Bom";
      classificationColor = "text-blue-500";
    } else if (score >= 40) {
      classification = "Regular";
      classificationColor = "text-yellow-500";
    } else if (score >= 20) {
      classification = "Atenção";
      classificationColor = "text-orange-500";
    } else {
      classification = "Crítico";
      classificationColor = "text-red-500";
    }

    return {
      score,
      classification,
      classificationColor,
      recoveryRate,
      ruinCoefficient,
      maxRunUp,
      maxDrawdown,
      maxProfit,
      maxLoss,
      profitDays,
      lossDays,
      totalDays,
      avgDailyProfit,
      avgOperationProfit,
    };
  }, [games, totalProfit, winRate, breakevenRate, targetMonthlyStakes, stakeValueReais, bankrollTotal, uniqueLeagues, uniqueMethods, selectedMethods]);
}
