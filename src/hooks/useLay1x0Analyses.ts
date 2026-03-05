import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Lay1x0Analysis {
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
    was_1x0?: boolean;
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

export const useLay1x0Analyses = () => {
    const { user } = useAuth();
    const [analyses, setAnalyses] = useState<Lay1x0Analysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalyses = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        const { data, error } = await (supabase as any)
            .from('lay1x0_analyses')
            .select('*')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching lay1x0_analyses:', error);
            setError(error.message);
        } else {
            setAnalyses(data || []);
        }
        setLoading(false);
    }, [user]);

    useEffect(() => { fetchAnalyses(); }, [fetchAnalyses]);

    const saveAnalysis = useCallback(async (analysis: Omit<Lay1x0Analysis, 'id' | 'owner_id' | 'created_at'>, silent = false) => {
        if (!user) return null;

        const { data, error } = await (supabase as any)
            .from('lay1x0_analyses')
            .upsert(
                { ...analysis, owner_id: user.id, is_backtest: analysis.is_backtest ?? false },
                { onConflict: 'owner_id,fixture_id' }
            )
            .select()
            .single();

        if (error) {
            console.error('Error saving lay1x0 analysis:', error);
            if (!silent) toast.error('Erro ao salvar: ' + error.message);
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
            .from('lay1x0_analyses')
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

    const resolveAnalysis = useCallback(async (id: string, scoreHome: number, scoreAway: number) => {
        if (!user) return;
        const was1x0 = scoreHome === 1 && scoreAway === 0;
        const result = was1x0 ? 'Red' : 'Green';

        const analysis = analyses.find(a => a.id === id);
        const liability = analysis?.liability || 1000;
        const stake = analysis?.stake || 0;

        // Profit: -liability for Red, stake for Green (if odd was set)
        const profit = was1x0 ? -liability : (stake > 0 ? stake : 0);

        const { error } = await (supabase as any)
            .from('lay1x0_analyses')
            .update({
                final_score_home: scoreHome,
                final_score_away: scoreAway,
                was_1x0: was1x0,
                result,
                profit,
                resolved_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('owner_id', user.id);

        if (!error) {
            setAnalyses(prev => prev.map(a => a.id === id ? {
                ...a, final_score_home: scoreHome, final_score_away: scoreAway,
                was_1x0: was1x0, result, profit, resolved_at: new Date().toISOString(),
            } : a));
        } else {
            console.error('Error resolving analysis:', error);
        }
        return error;
    }, [user, analyses]);

    const unresolveAnalysis = useCallback(async (id: string) => {
        if (!user) return;
        const { error } = await (supabase as any)
            .from('lay1x0_analyses')
            .update({
                final_score_home: null,
                final_score_away: null,
                was_1x0: null,
                result: null,
                profit: null,
                resolved_at: null,
            })
            .eq('id', id)
            .eq('owner_id', user.id);

        if (!error) {
            setAnalyses(prev => prev.map(a => a.id === id ? {
                ...a, final_score_home: undefined, final_score_away: undefined,
                was_1x0: undefined, result: undefined, profit: undefined, resolved_at: undefined,
            } : a));
            toast.success('Resultado removido - voltou para pendentes');
        } else {
            toast.error('Erro ao desfazer resolução');
        }
        return error;
    }, [user]);

    const updateOdd = useCallback(async (id: string, odd: number) => {
        if (!user) return;
        const analysis = analyses.find(a => a.id === id);
        if (!analysis) return;

        const liability = 1000;
        const stake = liability / (odd - 1);

        // If already resolved, we MUST update profit
        let profit = analysis.profit;
        if (analysis.result) {
            const was1x0 = analysis.final_score_home === 1 && analysis.final_score_away === 0;
            profit = was1x0 ? -liability : stake;
        }

        const { error } = await (supabase as any)
            .from('lay1x0_analyses')
            .update({ odd_used: odd, liability, stake, profit })
            .eq('id', id)
            .eq('owner_id', user.id);

        if (!error) {
            setAnalyses(prev => prev.map(a => a.id === id ? { ...a, odd_used: odd, liability, stake, profit } : a));
            toast.success('ODD atualizada');
        } else {
            console.error('Error updating ODD:', error);
            toast.error('Erro ao atualizar ODD');
        }
    }, [user, analyses]);

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
        totalProfit: Math.round(resolved.reduce((sum, a) => sum + (a.profit || 0), 0) * 100) / 100,
    };

    return { analyses, metrics, loading, error, saveAnalysis, resolveAnalysis, deleteAnalysis, updateOdd, unresolveAnalysis, refetch: fetchAnalyses };
};
