import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Lay0x1Analysis {
  id: string;
  owner_id: string;
  fixture_id: string;
  home_team: string;
  away_team: string;
  home_team_logo?: string;
  away_team_logo?: string;
  league: string;
  date: string;
  score_value: number;
  classification: string;
  criteria_snapshot: any;
  weights_snapshot: any;
  final_score_home?: number;
  final_score_away?: number;
  was_0x1?: boolean;
  result?: string;
  resolved_at?: string;
  created_at: string;
  odd_used?: number;
  liability?: number;
  stake?: number;
  profit?: number;
  is_backtest?: boolean;
  source_list?: string;
  ia_justification?: string;
}

export const useLay0x1Analyses = () => {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Lay0x1Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalyses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('lay0x1_analyses')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    setAnalyses(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAnalyses(); }, [fetchAnalyses]);

  const saveAnalysis = useCallback(async (analysis: Omit<Lay0x1Analysis, 'id' | 'owner_id' | 'created_at'>, silent = false) => {
    if (!user) return null;

    const { data, error } = await (supabase as any)
      .from('lay0x1_analyses')
      .upsert(
        { ...analysis, owner_id: user.id, is_backtest: analysis.is_backtest ?? false },
        { onConflict: 'owner_id,fixture_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error saving analysis:', error);
      if (!silent || error.message.includes('does not exist')) {
        toast.error('Erro de Banco de Dados: ' + error.message, { duration: 10000 });
      }
      return null;
    }

    if (data) {
      setAnalyses(prev => {
        const index = prev.findIndex(a => a.id === data.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }
        return [data, ...prev];
      });
    }
    return data;
  }, [user]);

  const deleteAnalysis = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from('lay0x1_analyses')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (!error) {
      setAnalyses(prev => prev.filter(a => a.id !== id));
      toast.success('Análise removida');
    } else {
      toast.error('Erro ao remover');
    }
  }, [user]);

  const updateOdd = useCallback(async (id: string, odd: number) => {
    if (!user) return;
    const analysis = analyses.find(a => a.id === id);
    const liability = 1000;
    const stake = liability / (odd - 1);

    // If already resolved, recalculate profit
    let profit = undefined;
    if (analysis?.result) {
      profit = analysis.result === 'Green' ? stake : -liability;
    }

    const { error } = await (supabase as any)
      .from('lay0x1_analyses')
      .update({ odd_used: odd, liability, stake, profit })
      .eq('id', id)
      .eq('owner_id', user.id);

    if (!error) {
      setAnalyses(prev => prev.map(a => a.id === id ? { ...a, odd_used: odd, liability, stake, profit } : a));
      toast.success('ODD atualizada');
    } else {
      console.error('Error updating ODD:', error);
      toast.error('Erro ao atualizar ODD: ' + error.message);
    }
  }, [user, analyses]);

  const resolveAnalysis = useCallback(async (id: string, scoreHome: number, scoreAway: number) => {
    if (!user) return;
    const was0x1 = scoreHome === 0 && scoreAway === 1;
    const result = was0x1 ? 'Red' : 'Green';

    const analysis = analyses.find(a => a.id === id);
    const liability = analysis?.liability || 1000;
    const stake = analysis?.stake || 0;

    // Profit: -liability for Red, stake for Green (if odd was set)
    let profit = was0x1 ? -liability : (stake > 0 ? stake : undefined);

    const { error } = await (supabase as any)
      .from('lay0x1_analyses')
      .update({
        final_score_home: scoreHome,
        final_score_away: scoreAway,
        was_0x1: was0x1,
        result,
        profit,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_id', user.id);

    if (!error) {
      setAnalyses(prev => prev.map(a => a.id === id ? {
        ...a, final_score_home: scoreHome, final_score_away: scoreAway,
        was_0x1: was0x1, result, profit, resolved_at: new Date().toISOString(),
      } : a));

      // Trigger AI post-Red analysis
      if (was0x1) {
        try {
          const res = await supabase.functions.invoke('analyze-red-lay0x1', {
            body: { analysis_id: id },
          });
          if (res.data?.analysis) {
            const aiAnalysis = res.data.analysis;
            const updatedSnapshot = {
              ...(analysis?.criteria_snapshot || {}),
              ai_red_analysis: aiAnalysis,
              red_insights: [aiAnalysis.summary, ...(aiAnalysis.key_factors || [])],
            };
            setAnalyses(prev => prev.map(a => a.id === id ? { ...a, criteria_snapshot: updatedSnapshot } : a));
            toast.warning('🔴 Análise de IA gerada para o Red', {
              description: aiAnalysis.summary,
              duration: 6000,
            });
          }
        } catch {
          // Fallback to local insights if AI fails
          if (analysis?.criteria_snapshot) {
            const insights = generateLocalInsights(analysis.criteria_snapshot);
            const updatedSnapshot = { ...analysis.criteria_snapshot, red_insights: insights };
            await (supabase as any)
              .from('lay0x1_analyses')
              .update({ criteria_snapshot: updatedSnapshot })
              .eq('id', id).eq('owner_id', user.id);
            setAnalyses(prev => prev.map(a => a.id === id ? { ...a, criteria_snapshot: updatedSnapshot } : a));
            toast.warning('🔴 Análise local de Red gerada', { description: insights[0], duration: 5000 });
          }
        }
      }

      // Auto-calibration every 30 resolved games
      const resolvedCount = analyses.filter(a => a.result || a.id === id).length;
      if (resolvedCount > 0 && resolvedCount % 30 === 0) {
        toast.info('🔄 Recalibração automática iniciada...', { duration: 3000 });
        try {
          const res = await supabase.functions.invoke('calibrate-lay0x1');
          if (res.data?.error) {
            toast.error('Erro na recalibração: ' + res.data.error);
          } else {
            toast.success(`✅ Recalibração #${res.data?.cycle || '?'} concluída!`, {
              description: `Taxa geral: ${res.data?.general_rate || 0}%${res.data?.forced_rebalance ? ' (com anti-overfitting)' : ''}`,
              duration: 6000,
            });
          }
        } catch {
          toast.error('Erro na recalibração automática');
        }
      }
    }
    return error;
  }, [user, analyses]);

  const unresolveAnalysis = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from('lay0x1_analyses')
      .update({
        final_score_home: null,
        final_score_away: null,
        was_0x1: null,
        result: null,
        profit: null,
        resolved_at: null,
      })
      .eq('id', id)
      .eq('owner_id', user.id);

    if (!error) {
      setAnalyses(prev => prev.map(a => a.id === id ? {
        ...a, final_score_home: undefined, final_score_away: undefined,
        was_0x1: undefined, result: undefined, profit: undefined, resolved_at: undefined,
      } : a));
      toast.success('Resultado removido - voltou para pendentes');
    } else {
      toast.error('Erro ao desfazer resolução');
    }
    return error;
  }, [user]);

  // Metrics
  const resolved = analyses.filter(a => a.result);
  const greens = resolved.filter(a => a.result === 'Green').length;
  const reds = resolved.filter(a => a.result === 'Red').length;
  const winRate = resolved.length > 0 ? (greens / resolved.length) * 100 : 0;

  const metrics = {
    total: analyses.length,
    resolved: resolved.length,
    pending: analyses.length - resolved.length,
    greens,
    reds,
    winRate: Math.round(winRate * 10) / 10,
  };

  // Metrics split by source_list for the comparison dashboard
  const computeSourceMetrics = (source: string) => {
    const sourceAnalyses = analyses.filter(a => (a.source_list || 'lista_padrao') === source);
    const sourceResolved = sourceAnalyses.filter(a => a.result);
    const sourceGreens = sourceResolved.filter(a => a.result === 'Green').length;
    const sourceReds = sourceResolved.filter(a => a.result === 'Red').length;
    const sourceWinRate = sourceResolved.length > 0 ? (sourceGreens / sourceResolved.length) * 100 : 0;
    const totalProfit = sourceResolved.reduce((sum, a) => sum + (a.profit || 0), 0);
    const totalStake = sourceResolved.reduce((sum, a) => sum + (a.stake || 0), 0);
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    return {
      total: sourceAnalyses.length,
      resolved: sourceResolved.length,
      greens: sourceGreens,
      reds: sourceReds,
      winRate: Math.round(sourceWinRate * 10) / 10,
      totalProfit: Math.round(totalProfit * 100) / 100,
      roi: Math.round(roi * 10) / 10,
    };
  };

  const metricsBySource = {
    lista_padrao: computeSourceMetrics('lista_padrao'),
    ia_selection: computeSourceMetrics('ia_selection'),
  };

  return { analyses, loading, metrics, metricsBySource, saveAnalysis, deleteAnalysis, updateOdd, resolveAnalysis, unresolveAnalysis, refetch: fetchAnalyses };
};

// Fallback local insights when AI is unavailable
function generateLocalInsights(criteriaSnapshot: any): string[] {
  const insights: string[] = [];
  if (!criteriaSnapshot) return insights;
  const { criteria_met, away_odd, over15_combined, home_goals_avg, away_conceded_avg, h2h_0x1_count } = criteriaSnapshot;
  if (away_odd !== undefined) {
    if (away_odd < 2.5) insights.push(`Odd visitante muito baixa: ${away_odd}`);
    else if (away_odd > 4.0) insights.push(`Odd visitante alta: ${away_odd}`);
  }
  if (over15_combined !== undefined && over15_combined < 75) insights.push(`Over 1.5 combinado no limite: ${over15_combined}%`);
  if (home_goals_avg !== undefined && home_goals_avg < 1.8) insights.push(`Mandante ofensiva fraca: ${home_goals_avg}`);
  if (away_conceded_avg !== undefined && away_conceded_avg < 1.5) insights.push(`Visitante defesa sólida: ${away_conceded_avg}`);
  if (h2h_0x1_count !== undefined && h2h_0x1_count > 0) insights.push(`H2H com ${h2h_0x1_count} resultado(s) 0x1`);
  if (criteria_met) {
    const failed = Object.entries(criteria_met).filter(([, v]) => v === false);
    if (failed.length > 0) insights.push(`Critérios não atendidos: ${failed.map(([k]) => k).join(', ')}`);
  }
  if (insights.length === 0) insights.push('Todos os critérios OK — Red inesperado');
  return insights;
}
