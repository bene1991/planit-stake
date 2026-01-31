import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Game, Method } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { calculateProfit } from '@/utils/profitCalculator';

export interface MonthlyStats {
  totalOperations: number;
  greens: number;
  reds: number;
  winRate: number;
  profitMoney: number;
  profitStakes: number;
  maxDrawdown: number;
  maxGreenStreak: number;
  maxRedStreak: number;
  bestDayProfit: number;
  worstDayProfit: number;
  bestMethodName: string;
  bestMethodProfit: number;
  dailyProfits: { date: string; profit: number }[];
  methodRanking: { name: string; profit: number; winRate: number; operations: number }[];
}

export interface MonthlyReport {
  id: string;
  owner_id: string;
  year_month: string;
  total_operations: number;
  greens: number;
  reds: number;
  win_rate: number;
  profit_money: number;
  profit_stakes: number;
  max_drawdown: number;
  max_green_streak: number;
  max_red_streak: number;
  best_day_profit?: number;
  worst_day_profit?: number;
  best_method_name?: string;
  best_method_profit?: number;
  ai_score?: number;
  ai_summary?: string;
  ai_positive_points?: string[];
  ai_negative_points?: string[];
  ai_suggestions?: string[];
  closed_at: string;
  created_at: string;
}

interface UseMonthlyReportResult {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  stats: MonthlyStats | null;
  savedReport: MonthlyReport | null;
  savedReports: MonthlyReport[];
  isLoading: boolean;
  isSaving: boolean;
  isLoadingAI: boolean;
  aiAnalysis: {
    score: number;
    summary: string;
    positivePoints: string[];
    negativePoints: string[];
    suggestions: string[];
  } | null;
  calculateStats: () => void;
  saveReport: () => Promise<void>;
  requestAIAnalysis: () => Promise<void>;
  loadSavedReports: () => Promise<void>;
}

export function useMonthlyReport(
  games: Game[],
  methods: Method[],
  stakeValueReais: number = 100
): UseMonthlyReportResult {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [savedReport, setSavedReport] = useState<MonthlyReport | null>(null);
  const [savedReports, setSavedReports] = useState<MonthlyReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiAnalysis, setAIAnalysis] = useState<{
    score: number;
    summary: string;
    positivePoints: string[];
    negativePoints: string[];
    suggestions: string[];
  } | null>(null);

  // Filter games for selected month
  const monthGames = useMemo(() => {
    return games.filter(g => g.date.startsWith(selectedMonth));
  }, [games, selectedMonth]);

  // Calculate statistics for the selected month
  const calculateStats = useCallback(() => {
    setIsLoading(true);
    setAIAnalysis(null);
    
    try {
      // Collect all operations with results
      const operations: { date: string; methodId: string; result: 'Green' | 'Red'; profit: number }[] = [];
      
      monthGames.forEach(game => {
        game.methodOperations?.forEach(op => {
          if (op.result && op.stakeValue && op.odd) {
            const profit = calculateProfit({
              stakeValue: op.stakeValue,
              odd: op.odd,
              operationType: op.operationType || 'Back',
              result: op.result,
              commissionRate: op.commissionRate || 0.045
            });
            
            operations.push({
              date: game.date,
              methodId: op.methodId,
              result: op.result,
              profit
            });
          }
        });
      });

      // Basic stats
      const greens = operations.filter(op => op.result === 'Green').length;
      const reds = operations.filter(op => op.result === 'Red').length;
      const total = operations.length;
      const winRate = total > 0 ? (greens / total) * 100 : 0;
      const profitMoney = operations.reduce((sum, op) => sum + op.profit, 0);
      const profitStakes = stakeValueReais > 0 ? profitMoney / stakeValueReais : 0;

      // Calculate streaks
      let currentGreenStreak = 0;
      let currentRedStreak = 0;
      let maxGreenStreak = 0;
      let maxRedStreak = 0;
      
      operations.forEach(op => {
        if (op.result === 'Green') {
          currentGreenStreak++;
          currentRedStreak = 0;
          maxGreenStreak = Math.max(maxGreenStreak, currentGreenStreak);
        } else {
          currentRedStreak++;
          currentGreenStreak = 0;
          maxRedStreak = Math.max(maxRedStreak, currentRedStreak);
        }
      });

      // Calculate drawdown
      let peak = 0;
      let cumulative = 0;
      let maxDrawdown = 0;
      
      operations.forEach(op => {
        cumulative += op.profit;
        peak = Math.max(peak, cumulative);
        const drawdown = peak - cumulative;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      });

      // Daily profits
      const dailyProfitsMap = new Map<string, number>();
      operations.forEach(op => {
        const current = dailyProfitsMap.get(op.date) || 0;
        dailyProfitsMap.set(op.date, current + op.profit);
      });
      
      const dailyProfits = Array.from(dailyProfitsMap.entries())
        .map(([date, profit]) => ({ date, profit }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const bestDayProfit = dailyProfits.length > 0 
        ? Math.max(...dailyProfits.map(d => d.profit))
        : 0;
      const worstDayProfit = dailyProfits.length > 0 
        ? Math.min(...dailyProfits.map(d => d.profit))
        : 0;

      // Method ranking
      const methodStats = new Map<string, { profit: number; greens: number; total: number }>();
      operations.forEach(op => {
        const current = methodStats.get(op.methodId) || { profit: 0, greens: 0, total: 0 };
        current.profit += op.profit;
        current.total++;
        if (op.result === 'Green') current.greens++;
        methodStats.set(op.methodId, current);
      });

      const methodRanking = Array.from(methodStats.entries())
        .map(([methodId, stats]) => {
          const method = methods.find(m => m.id === methodId);
          return {
            name: method?.name || 'Desconhecido',
            profit: stats.profit,
            winRate: stats.total > 0 ? (stats.greens / stats.total) * 100 : 0,
            operations: stats.total
          };
        })
        .sort((a, b) => b.profit - a.profit);

      const bestMethod = methodRanking[0];

      setStats({
        totalOperations: total,
        greens,
        reds,
        winRate,
        profitMoney,
        profitStakes,
        maxDrawdown,
        maxGreenStreak,
        maxRedStreak,
        bestDayProfit,
        worstDayProfit,
        bestMethodName: bestMethod?.name || '',
        bestMethodProfit: bestMethod?.profit || 0,
        dailyProfits,
        methodRanking
      });

      // Check if there's a saved report for this month
      checkSavedReport();
      
    } finally {
      setIsLoading(false);
    }
  }, [monthGames, methods, stakeValueReais]);

  // Check if report exists for selected month
  const checkSavedReport = useCallback(async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('monthly_reports')
      .select('*')
      .eq('owner_id', user.id)
      .eq('year_month', selectedMonth)
      .maybeSingle();
    
    if (data) {
      setSavedReport(data as MonthlyReport);
    } else {
      setSavedReport(null);
    }
  }, [user, selectedMonth]);

  // Load all saved reports
  const loadSavedReports = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('monthly_reports')
      .select('*')
      .eq('owner_id', user.id)
      .order('year_month', { ascending: false });
    
    if (error) {
      console.error('Error loading saved reports:', error);
      return;
    }
    
    setSavedReports((data || []) as MonthlyReport[]);
  }, [user]);

  // Save the current month report
  const saveReport = useCallback(async () => {
    if (!user || !stats) return;
    
    setIsSaving(true);
    
    try {
      const reportData = {
        owner_id: user.id,
        year_month: selectedMonth,
        total_operations: stats.totalOperations,
        greens: stats.greens,
        reds: stats.reds,
        win_rate: stats.winRate,
        profit_money: stats.profitMoney,
        profit_stakes: stats.profitStakes,
        max_drawdown: stats.maxDrawdown,
        max_green_streak: stats.maxGreenStreak,
        max_red_streak: stats.maxRedStreak,
        best_day_profit: stats.bestDayProfit,
        worst_day_profit: stats.worstDayProfit,
        best_method_name: stats.bestMethodName,
        best_method_profit: stats.bestMethodProfit,
        ai_score: aiAnalysis?.score,
        ai_summary: aiAnalysis?.summary,
        ai_positive_points: aiAnalysis?.positivePoints,
        ai_negative_points: aiAnalysis?.negativePoints,
        ai_suggestions: aiAnalysis?.suggestions,
        closed_at: new Date().toISOString()
      };

      if (savedReport) {
        // Update existing report
        const { error } = await supabase
          .from('monthly_reports')
          .update(reportData)
          .eq('id', savedReport.id);
        
        if (error) throw error;
        
        toast({
          title: 'Relatório atualizado',
          description: `O fechamento de ${formatMonthYear(selectedMonth)} foi atualizado.`
        });
      } else {
        // Insert new report
        const { error } = await supabase
          .from('monthly_reports')
          .insert(reportData);
        
        if (error) throw error;
        
        toast({
          title: 'Mês fechado com sucesso!',
          description: `O fechamento de ${formatMonthYear(selectedMonth)} foi salvo.`
        });
      }

      await checkSavedReport();
      await loadSavedReports();
      
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o relatório.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [user, stats, selectedMonth, savedReport, aiAnalysis, checkSavedReport, loadSavedReports, toast]);

  // Request AI analysis
  const requestAIAnalysis = useCallback(async () => {
    if (!stats) return;
    
    setIsLoadingAI(true);
    
    try {
      const prompt = `Analise o desempenho de um trader de apostas esportivas no mês de ${formatMonthYear(selectedMonth)}:

ESTATÍSTICAS DO MÊS:
- Total de operações: ${stats.totalOperations}
- Greens: ${stats.greens} | Reds: ${stats.reds}
- Win Rate: ${stats.winRate.toFixed(1)}%
- Lucro: R$ ${stats.profitMoney.toFixed(2)} (${stats.profitStakes.toFixed(2)} stakes)
- Drawdown Máximo: R$ ${stats.maxDrawdown.toFixed(2)}
- Maior sequência de greens: ${stats.maxGreenStreak}
- Maior sequência de reds: ${stats.maxRedStreak}
- Melhor dia: R$ ${stats.bestDayProfit.toFixed(2)}
- Pior dia: R$ ${stats.worstDayProfit.toFixed(2)}
- Melhor método: ${stats.bestMethodName} (R$ ${stats.bestMethodProfit.toFixed(2)})

RANKING DE MÉTODOS:
${stats.methodRanking.map((m, i) => `${i + 1}. ${m.name}: R$ ${m.profit.toFixed(2)} | WR: ${m.winRate.toFixed(1)}% | ${m.operations} ops`).join('\n')}

Forneça uma análise estruturada com:
1. Score geral (0-100)
2. Resumo executivo (2-3 frases)
3. 3 pontos positivos
4. 3 pontos negativos ou alertas
5. 3 sugestões para o próximo mês

Responda APENAS em JSON válido:
{
  "score": number,
  "summary": "string",
  "positivePoints": ["string", "string", "string"],
  "negativePoints": ["string", "string", "string"],
  "suggestions": ["string", "string", "string"]
}`;

      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: { prompt }
      });

      if (error) throw error;

      // Parse the AI response
      let analysis;
      try {
        const content = data.analysis || data.content || data;
        if (typeof content === 'string') {
          // Extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          }
        } else {
          analysis = content;
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        throw new Error('Failed to parse AI analysis');
      }

      if (analysis) {
        setAIAnalysis({
          score: analysis.score || 50,
          summary: analysis.summary || 'Análise não disponível',
          positivePoints: analysis.positivePoints || [],
          negativePoints: analysis.negativePoints || [],
          suggestions: analysis.suggestions || []
        });
        
        toast({
          title: 'Análise concluída',
          description: 'A IA gerou insights para o seu mês.'
        });
      }
      
    } catch (error) {
      console.error('Error requesting AI analysis:', error);
      toast({
        title: 'Erro na análise',
        description: 'Não foi possível gerar a análise de IA.',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingAI(false);
    }
  }, [stats, selectedMonth, toast]);

  return {
    selectedMonth,
    setSelectedMonth,
    stats,
    savedReport,
    savedReports,
    isLoading,
    isSaving,
    isLoadingAI,
    aiAnalysis,
    calculateStats,
    saveReport,
    requestAIAnalysis,
    loadSavedReports
  };
}

function formatMonthYear(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}
