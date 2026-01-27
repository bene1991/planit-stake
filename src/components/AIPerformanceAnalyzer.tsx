import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, RefreshCw, Bot, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FilteredStatisticsResult, LeagueStats, TeamStats } from '@/hooks/useFilteredStatistics';
import { cn } from '@/lib/utils';
import { BankrollHealthScore } from './BankrollHealthScore';
import { AIStructuredAnalysis } from './AIStructuredAnalysis';
import { useBankrollHealth } from '@/hooks/useBankrollHealth';
import { Game } from '@/types';

interface ActiveFilters {
  selectedMethods: string[];
  selectedLeagues: string[];
  result: 'all' | 'Green' | 'Red';
}

interface StructuredAnalysisData {
  score: number;
  classification: "Excelente" | "Bom" | "Regular" | "Atenção" | "Crítico";
  summary: string;
  positivePoints: string[];
  negativePoints: string[];
  suggestions: string[];
}

interface AIPerformanceAnalyzerProps {
  statistics: FilteredStatisticsResult;
  leagueStats: LeagueStats[];
  teamStats: TeamStats[];
  period: string;
  profit: number;
  activeFilters: ActiveFilters;
  methodNames: Record<string, string>;
  generalWinRate: number;
  games: Game[];
  stakeValueReais?: number;
  targetMonthlyStakes?: number;
}

export function AIPerformanceAnalyzer({ 
  statistics, 
  leagueStats, 
  teamStats,
  period,
  profit,
  activeFilters,
  methodNames,
  generalWinRate,
  games,
  stakeValueReais = 100,
  targetMonthlyStakes = 30,
}: AIPerformanceAnalyzerProps) {
  const [analysis, setAnalysis] = useState<string>('');
  const [structuredAnalysis, setStructuredAnalysis] = useState<StructuredAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAnalysisDate, setLastAnalysisDate] = useState<Date | null>(null);
  const { toast } = useToast();

  // Calculate health metrics
  const totalProfit = useMemo(() => {
    if (statistics.bankrollEvolution.length === 0) return 0;
    const lastEntry = statistics.bankrollEvolution[statistics.bankrollEvolution.length - 1];
    return lastEntry?.cumulativeReais || 0;
  }, [statistics.bankrollEvolution]);

  const healthMetrics = useBankrollHealth({
    games,
    totalProfit,
    winRate: statistics.overallStats.winRate,
    breakevenRate: statistics.breakevenRate,
    targetMonthlyStakes,
    stakeValueReais,
    uniqueLeagues: leagueStats.length,
    uniqueMethods: statistics.methodDetailStats.length,
  });

  // Check if any filter is active
  const isFiltered = activeFilters.selectedMethods.length > 0 || 
                     activeFilters.selectedLeagues.length > 0 || 
                     activeFilters.result !== 'all';

  // Get human-readable filter description
  const getFilterDescription = () => {
    const parts: string[] = [];
    if (activeFilters.selectedMethods.length > 0) {
      const names = activeFilters.selectedMethods.map(id => methodNames[id] || id);
      parts.push(names.join(', '));
    }
    if (activeFilters.selectedLeagues.length > 0) {
      parts.push(activeFilters.selectedLeagues.join(', '));
    }
    if (activeFilters.result !== 'all') {
      parts.push(activeFilters.result === 'Green' ? 'Greens' : 'Reds');
    }
    return parts.join(' • ');
  };

  const analyzePerformance = useCallback(async () => {
    if (statistics.overallStats.total === 0) {
      toast({
        title: "Sem dados para análise",
        description: "Registre algumas operações para receber insights da IA.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setAnalysis('');
    setStructuredAnalysis(null);

    try {
      // Prepare data for AI
      const sortedLeaguesByWR = [...leagueStats].sort((a, b) => b.winRate - a.winRate);
      const topLeagues = sortedLeaguesByWR.slice(0, 3);
      const bottomLeagues = sortedLeaguesByWR.filter(l => l.total >= 3).slice(-3).reverse();

      const sortedTeamsByWR = [...teamStats].sort((a, b) => b.winRate - a.winRate);
      const topTeams = sortedTeamsByWR.slice(0, 3);
      const bottomTeams = sortedTeamsByWR.filter(t => t.operations >= 3).slice(-3).reverse();

      const performanceData = {
        period,
        overallStats: statistics.overallStats,
        profit,
        averageOdd: statistics.averageOdd,
        breakevenRate: statistics.breakevenRate,
        methodStats: statistics.methodDetailStats.map(m => ({
          methodName: m.methodName,
          total: m.total,
          greens: m.greens,
          reds: m.reds,
          winRate: m.winRate,
        })),
        topLeagues: topLeagues.map(l => ({
          league: l.league,
          winRate: l.winRate,
          profit: l.profit,
          total: l.total,
        })),
        bottomLeagues: bottomLeagues.map(l => ({
          league: l.league,
          winRate: l.winRate,
          profit: l.profit,
          total: l.total,
        })),
        topTeams: topTeams.map(t => ({
          team: t.team,
          winRate: t.winRate,
          profit: t.profit,
          operations: t.operations,
        })),
        bottomTeams: bottomTeams.map(t => ({
          team: t.team,
          winRate: t.winRate,
          profit: t.profit,
          operations: t.operations,
        })),
        oddRangeStats: statistics.oddRangeStats.map(o => ({
          range: o.range,
          winRate: o.winRate,
          profit: o.profit,
          total: o.total,
        })),
        comparison: {
          winRateChange: statistics.comparison.winRateChange,
          volumeChange: statistics.comparison.volumeChange,
        },
        activeFilters: {
          methods: activeFilters.selectedMethods.map(id => methodNames[id] || id),
          leagues: activeFilters.selectedLeagues,
          result: activeFilters.result,
        },
        isFiltered,
        generalWinRate,
        // Advanced metrics for AI context
        advancedMetrics: {
          maxRunUp: healthMetrics.maxRunUp,
          maxDrawdown: healthMetrics.maxDrawdown,
          recoveryRate: healthMetrics.recoveryRate,
          ruinCoefficient: healthMetrics.ruinCoefficient,
          profitDays: healthMetrics.profitDays,
          lossDays: healthMetrics.lossDays,
          totalDays: healthMetrics.totalDays,
        },
      };

      // Call with structured output
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-performance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ performanceData, structuredOutput: true }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao analisar desempenho');
      }

      const data = await response.json();
      
      if (data.analysis) {
        setStructuredAnalysis(data.analysis);
        setLastAnalysisDate(new Date());
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      toast({
        title: "Erro na análise",
        description: error instanceof Error ? error.message : "Não foi possível analisar o desempenho",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [statistics, leagueStats, teamStats, period, profit, activeFilters, methodNames, isFiltered, generalWinRate, healthMetrics, toast]);

  // Calculate score - use AI score if available, otherwise use calculated score
  const displayScore = structuredAnalysis?.score ?? healthMetrics.score;
  const displayClassification = structuredAnalysis?.classification ?? healthMetrics.classification;
  const displayClassificationColor = useMemo(() => {
    const classification = displayClassification;
    if (classification === "Excelente") return "text-emerald-500";
    if (classification === "Bom") return "text-blue-500";
    if (classification === "Regular") return "text-yellow-500";
    if (classification === "Atenção") return "text-orange-500";
    return "text-red-500";
  }, [displayClassification]);

  return (
    <div className="space-y-6">
      {/* Score Card with Analyze Button */}
      <BankrollHealthScore
        score={displayScore}
        classification={displayClassification}
        classificationColor={displayClassificationColor}
        isAnalyzing={isLoading}
        lastAnalysisDate={lastAnalysisDate || undefined}
        onAnalyze={analyzePerformance}
        summary={structuredAnalysis?.summary}
        previousScore={structuredAnalysis ? healthMetrics.score : undefined}
      />

      {/* Structured Analysis Cards */}
      <AIStructuredAnalysis
        positivePoints={structuredAnalysis?.positivePoints || []}
        negativePoints={structuredAnalysis?.negativePoints || []}
        suggestions={structuredAnalysis?.suggestions || []}
        isLoading={isLoading}
      />

      {/* Filter Badge */}
      {isFiltered && (
        <div className="flex justify-center">
          <Badge variant="outline" className="text-xs gap-1">
            <Filter className="h-3 w-3" />
            Análise filtrada: {getFilterDescription()}
          </Badge>
        </div>
      )}
    </div>
  );
}
