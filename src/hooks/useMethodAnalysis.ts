import { useMemo } from 'react';
import { useSupabaseGames } from './useSupabaseGames';
import { useSupabaseBankroll } from './useSupabaseBankroll';
import { useOperationalSettings } from './useOperationalSettings';

export type MethodPhase = 'Em Validação' | 'Sinal Fraco' | 'Validado' | 'Reprovado';
export type AlertType = 'info' | 'warning' | 'success' | 'danger';

export interface MethodAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
}

export interface MethodScores {
  confidence: number; // 0-100
  risk: number; // 0-100 (higher = more risky)
  edge: number; // -100 to +100 (positive = advantage)
}

export interface MethodAnalysisData {
  methodId: string;
  methodName: string;
  phase: MethodPhase;
  scores: MethodScores;
  alerts: MethodAlert[];
  stats: {
    totalOperations: number;
    greens: number;
    reds: number;
    winRate: number;
    profitReais: number;
    profitStakes: number;
    roi: number;
    avgOdd: number;
    maxDrawdown: number;
    currentStreak: { type: 'green' | 'red'; count: number };
    activeDays: number;
    firstOperationDate: string | null;
    lastOperationDate: string | null;
  };
  evolutionByBlocks: Array<{
    block: number;
    operations: number;
    winRate: number;
    profit: number;
  }>;
  contextAnalysis: {
    byLeague: Array<{ league: string; operations: number; winRate: number; profit: number }>;
    byOddRange: Array<{ range: string; operations: number; winRate: number; profit: number }>;
  };
}

// Calculate breakeven rate based on average odd
function calculateBreakevenRate(avgOdd: number): number {
  if (avgOdd <= 1) return 100;
  return (1 / avgOdd) * 100;
}

// Determine method phase based on operations and performance
function determinePhase(totalOps: number, winRate: number, breakevenRate: number, roi: number): MethodPhase {
  if (totalOps < 21) return 'Em Validação';
  if (totalOps < 51) {
    // Sinal Fraco - still gathering data but can give early signals
    if (winRate < breakevenRate - 15) return 'Reprovado';
    return 'Sinal Fraco';
  }
  // 51+ operations - can make more confident assessment
  if (winRate >= breakevenRate && roi > 0) return 'Validado';
  if (winRate < breakevenRate - 10 || roi < -15) return 'Reprovado';
  return 'Sinal Fraco';
}

// Calculate confidence score based on sample size and consistency
function calculateConfidenceScore(totalOps: number, winRateVariance: number): number {
  // Base score from sample size (max 60 points)
  let sampleScore = Math.min(60, totalOps * 1.2);
  
  // Consistency bonus (max 40 points) - lower variance = higher consistency
  const varianceScore = Math.max(0, 40 - winRateVariance * 2);
  
  return Math.min(100, Math.round(sampleScore + varianceScore));
}

// Calculate risk score
function calculateRiskScore(
  maxDrawdown: number,
  avgOdd: number,
  winRate: number,
  breakevenRate: number
): number {
  // Higher drawdown = higher risk
  const drawdownRisk = Math.min(40, maxDrawdown * 4);
  
  // Higher odds = higher risk
  const oddRisk = Math.min(30, (avgOdd - 1.5) * 15);
  
  // Further from breakeven (negative) = higher risk
  const marginRisk = winRate < breakevenRate 
    ? Math.min(30, (breakevenRate - winRate) * 2)
    : 0;
  
  return Math.min(100, Math.round(drawdownRisk + oddRisk + marginRisk));
}

// Calculate edge score (-100 to +100)
function calculateEdgeScore(winRate: number, breakevenRate: number, roi: number): number {
  // Win rate edge: how much above/below breakeven
  const winRateEdge = (winRate - breakevenRate) * 1.5;
  
  // ROI component
  const roiEdge = roi * 0.5;
  
  const score = winRateEdge + roiEdge;
  return Math.max(-100, Math.min(100, Math.round(score)));
}

// Generate alerts based on analysis
function generateAlerts(
  methodName: string,
  totalOps: number,
  winRate: number,
  breakevenRate: number,
  currentStreak: { type: 'green' | 'red'; count: number },
  maxDrawdown: number,
  roi: number,
  edgeScore: number
): MethodAlert[] {
  const alerts: MethodAlert[] = [];

  // Sample size alerts
  if (totalOps < 10) {
    alerts.push({
      id: 'sample-critical',
      type: 'info',
      title: 'Amostra insuficiente',
      message: `Apenas ${totalOps} operações. Continue coletando dados para uma análise mais precisa.`
    });
  } else if (totalOps < 30) {
    alerts.push({
      id: 'sample-warning',
      type: 'info',
      title: 'Amostra em crescimento',
      message: `${totalOps} operações. Resultados preliminares, aguarde pelo menos 30 para validação.`
    });
  }

  // Streak alerts
  if (currentStreak.type === 'red' && currentStreak.count >= 4) {
    alerts.push({
      id: 'red-streak',
      type: 'danger',
      title: 'Sequência negativa',
      message: `${currentStreak.count} reds consecutivos. Considere revisar o método ou pausar temporariamente.`
    });
  } else if (currentStreak.type === 'green' && currentStreak.count >= 5) {
    alerts.push({
      id: 'green-streak',
      type: 'success',
      title: 'Boa sequência',
      message: `${currentStreak.count} greens consecutivos. Momento favorável.`
    });
  }

  // Drawdown alert
  if (maxDrawdown >= 5) {
    alerts.push({
      id: 'high-drawdown',
      type: 'warning',
      title: 'Drawdown elevado',
      message: `Drawdown máximo de ${maxDrawdown.toFixed(1)} stakes. Gerencie o risco com cuidado.`
    });
  }

  // Edge alerts
  if (totalOps >= 30) {
    if (edgeScore > 15) {
      alerts.push({
        id: 'positive-edge',
        type: 'success',
        title: 'Vantagem detectada',
        message: `Método apresenta edge positivo. Continue operando com consistência.`
      });
    } else if (edgeScore < -15) {
      alerts.push({
        id: 'negative-edge',
        type: 'danger',
        title: 'Sem vantagem',
        message: `Método não apresenta edge positivo. Considere ajustes ou encerramento.`
      });
    }
  }

  // Win rate vs breakeven
  if (totalOps >= 20 && winRate < breakevenRate - 5) {
    alerts.push({
      id: 'below-breakeven',
      type: 'warning',
      title: 'Abaixo do breakeven',
      message: `Win rate (${winRate.toFixed(1)}%) está abaixo do breakeven (${breakevenRate.toFixed(1)}%).`
    });
  }

  return alerts;
}

export function useMethodAnalysis() {
  const { games, loading: gamesLoading } = useSupabaseGames();
  const { bankroll, loading: bankrollLoading } = useSupabaseBankroll();
  const { settings } = useOperationalSettings();

  const methods = bankroll.methods;
  const stakeValueReais = settings?.stakeValueReais || 100;
  const commissionRate = settings?.commissionRate || 0.045;

  const analysisData = useMemo<MethodAnalysisData[]>(() => {
    if (!methods || methods.length === 0) return [];

    return methods.map(method => {
      // Get all operations for this method
      const methodOperations = games
        .flatMap(game => 
          game.methodOperations
            .filter(op => op.methodId === method.id && op.result)
            .map(op => ({
              ...op,
              date: game.date,
              league: game.league
            }))
        )
        .sort((a, b) => a.date.localeCompare(b.date));

      const totalOperations = methodOperations.length;
      const greens = methodOperations.filter(op => op.result === 'Green').length;
      const reds = totalOperations - greens;
      const winRate = totalOperations > 0 ? (greens / totalOperations) * 100 : 0;

      // Calculate profit
      const profitReais = methodOperations.reduce((sum, op) => sum + (op.profit || 0), 0);
      const profitStakes = profitReais / stakeValueReais;

      // Calculate average odd
      const oddsSum = methodOperations.reduce((sum, op) => sum + (op.odd || 2), 0);
      const avgOdd = totalOperations > 0 ? oddsSum / totalOperations : 2;

      // Calculate breakeven
      const breakevenRate = calculateBreakevenRate(avgOdd);

      // Calculate ROI
      const totalStaked = totalOperations * stakeValueReais;
      const roi = totalStaked > 0 ? (profitReais / totalStaked) * 100 : 0;

      // Calculate max drawdown
      let runningProfit = 0;
      let peak = 0;
      let maxDrawdown = 0;
      methodOperations.forEach(op => {
        runningProfit += (op.profit || 0) / stakeValueReais;
        if (runningProfit > peak) peak = runningProfit;
        const drawdown = peak - runningProfit;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      });

      // Calculate current streak
      let currentStreak: { type: 'green' | 'red'; count: number } = { type: 'green', count: 0 };
      for (let i = methodOperations.length - 1; i >= 0; i--) {
        const result = methodOperations[i].result;
        if (i === methodOperations.length - 1) {
          currentStreak.type = result === 'Green' ? 'green' : 'red';
          currentStreak.count = 1;
        } else if ((result === 'Green' && currentStreak.type === 'green') ||
                   (result === 'Red' && currentStreak.type === 'red')) {
          currentStreak.count++;
        } else {
          break;
        }
      }

      // Calculate active days
      const uniqueDays = new Set(methodOperations.map(op => op.date));
      const activeDays = uniqueDays.size;

      // Calculate win rate variance (for confidence)
      const blockSize = 10;
      const blocks: number[] = [];
      for (let i = 0; i < methodOperations.length; i += blockSize) {
        const blockOps = methodOperations.slice(i, i + blockSize);
        if (blockOps.length >= 5) {
          const blockGreens = blockOps.filter(op => op.result === 'Green').length;
          blocks.push((blockGreens / blockOps.length) * 100);
        }
      }
      const avgBlockWinRate = blocks.length > 0 ? blocks.reduce((a, b) => a + b, 0) / blocks.length : winRate;
      const variance = blocks.length > 1 
        ? blocks.reduce((sum, wr) => sum + Math.pow(wr - avgBlockWinRate, 2), 0) / blocks.length
        : 20; // default variance when not enough blocks

      // Calculate scores
      const confidenceScore = calculateConfidenceScore(totalOperations, Math.sqrt(variance));
      const riskScore = calculateRiskScore(maxDrawdown, avgOdd, winRate, breakevenRate);
      const edgeScore = calculateEdgeScore(winRate, breakevenRate, roi);

      // Determine phase
      const phase = determinePhase(totalOperations, winRate, breakevenRate, roi);

      // Generate alerts
      const alerts = generateAlerts(
        method.name,
        totalOperations,
        winRate,
        breakevenRate,
        currentStreak,
        maxDrawdown,
        roi,
        edgeScore
      );

      // Evolution by blocks
      const evolutionByBlocks = [];
      for (let i = 0; i < methodOperations.length; i += blockSize) {
        const blockOps = methodOperations.slice(i, i + blockSize);
        const blockGreens = blockOps.filter(op => op.result === 'Green').length;
        const blockProfit = blockOps.reduce((sum, op) => sum + (op.profit || 0), 0) / stakeValueReais;
        evolutionByBlocks.push({
          block: Math.floor(i / blockSize) + 1,
          operations: blockOps.length,
          winRate: (blockGreens / blockOps.length) * 100,
          profit: blockProfit
        });
      }

      // Context analysis by league
      const leagueMap = new Map<string, { operations: number; greens: number; profit: number }>();
      methodOperations.forEach(op => {
        const current = leagueMap.get(op.league) || { operations: 0, greens: 0, profit: 0 };
        current.operations++;
        if (op.result === 'Green') current.greens++;
        current.profit += (op.profit || 0) / stakeValueReais;
        leagueMap.set(op.league, current);
      });
      const byLeague = Array.from(leagueMap.entries())
        .map(([league, data]) => ({
          league,
          operations: data.operations,
          winRate: (data.greens / data.operations) * 100,
          profit: data.profit
        }))
        .sort((a, b) => b.operations - a.operations)
        .slice(0, 5);

      // Context analysis by odd range
      const oddRanges = [
        { label: '1.01-1.50', min: 1.01, max: 1.50 },
        { label: '1.51-2.00', min: 1.51, max: 2.00 },
        { label: '2.01-2.50', min: 2.01, max: 2.50 },
        { label: '2.51-3.00', min: 2.51, max: 3.00 },
        { label: '3.01+', min: 3.01, max: 100 }
      ];
      const byOddRange = oddRanges.map(range => {
        const rangeOps = methodOperations.filter(op => {
          const odd = op.odd || 2;
          return odd >= range.min && odd <= range.max;
        });
        const rangeGreens = rangeOps.filter(op => op.result === 'Green').length;
        const rangeProfit = rangeOps.reduce((sum, op) => sum + (op.profit || 0), 0) / stakeValueReais;
        return {
          range: range.label,
          operations: rangeOps.length,
          winRate: rangeOps.length > 0 ? (rangeGreens / rangeOps.length) * 100 : 0,
          profit: rangeProfit
        };
      }).filter(r => r.operations > 0);

      // Get first and last operation dates
      const firstOperationDate = methodOperations.length > 0 ? methodOperations[0].date : null;
      const lastOperationDate = methodOperations.length > 0 ? methodOperations[methodOperations.length - 1].date : null;

      return {
        methodId: method.id,
        methodName: method.name,
        phase,
        scores: {
          confidence: confidenceScore,
          risk: riskScore,
          edge: edgeScore
        },
        alerts,
        stats: {
          totalOperations,
          greens,
          reds,
          winRate,
          profitReais,
          profitStakes,
          roi,
          avgOdd,
          maxDrawdown,
          currentStreak,
          activeDays,
          firstOperationDate,
          lastOperationDate
        },
        evolutionByBlocks,
        contextAnalysis: {
          byLeague,
          byOddRange
        }
      };
    }).sort((a, b) => b.stats.totalOperations - a.stats.totalOperations);
  }, [games, methods, stakeValueReais, commissionRate]);

  return {
    analysisData,
    loading: gamesLoading || bankrollLoading,
    methods
  };
}
