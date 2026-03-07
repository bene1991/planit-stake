import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

interface Lay1x0ContextType {
    analyses: Lay1x0Analysis[];
    loading: boolean;
    error: string | null;
    metrics: {
        total: number;
        resolved: number;
        pending: number;
        greens: number;
        reds: number;
        winRate: number;
        totalProfit: number;
    };
    fetchAnalyses: () => Promise<void>;
    saveAnalysis: (analysis: Omit<Lay1x0Analysis, 'id' | 'owner_id' | 'created_at'>, silent?: boolean) => Promise<any>;
    resolveAnalysis: (id: string, scoreHome: number, scoreAway: number) => Promise<any>;
    unresolveAnalysis: (id: string) => Promise<any>;
    deleteAnalysis: (id: string) => Promise<void>;
    updateOdd: (id: string, odd: number) => Promise<void>;
}

const Lay1x0Context = createContext<Lay1x0ContextType | undefined>(undefined);

export const Lay1x0Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [analyses, setAnalyses] = useState<Lay1x0Analysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalyses = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
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
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchAnalyses();

            const channel = supabase
                .channel('lay1x0-realtime-' + user.id)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'lay1x0_analyses',
                        filter: `owner_id=eq.${user.id}`
                    },
                    (payload) => {
                        console.log('[Lay1x0Context] Change detected:', payload);
                        if (payload.eventType === 'INSERT') {
                            setAnalyses(prev => [payload.new as Lay1x0Analysis, ...prev]);
                        } else if (payload.eventType === 'UPDATE') {
                            setAnalyses(prev => prev.map(a => a.id === payload.new.id ? payload.new as Lay1x0Analysis : a));
                        } else if (payload.eventType === 'DELETE') {
                            setAnalyses(prev => prev.filter(a => a.id !== payload.old.id));
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        } else {
            setAnalyses([]);
            setLoading(false);
        }
    }, [user, fetchAnalyses]);

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
            toast.success('ODD atualizada');
        } else {
            console.error('Error updating ODD:', error);
            toast.error('Erro ao atualizar ODD');
        }
    }, [user, analyses]);

    // Metrics calculation
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

    return (
        <Lay1x0Context.Provider value={{
            analyses, loading, error, metrics,
            fetchAnalyses, saveAnalysis, resolveAnalysis,
            unresolveAnalysis, deleteAnalysis, updateOdd
        }}>
            {children}
        </Lay1x0Context.Provider>
    );
};

export const useLay1x0 = () => {
    const context = useContext(Lay1x0Context);
    if (context === undefined) {
        throw new Error('useLay1x0 must be used within a Lay1x0Provider');
    }
    return context;
};
