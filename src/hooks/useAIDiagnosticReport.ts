import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DiagnosticReport {
    overallScore: number;
    classification: 'Excelente' | 'Bom' | 'Regular' | 'Atenção' | 'Crítico';
    summary: string;
    strengths: string[];
    weaknesses: string[];
    redDeepDive: {
        pattern: string;
        commonLeagues: string[];
        commonCriteria: string[];
        recommendation: string;
    };
    leagueClassification: {
        strong: Array<{ name: string; reason: string }>;
        weak: Array<{ name: string; reason: string; action: 'block' | 'monitor' }>;
        insufficient: Array<{ name: string; reason: string }>;
    };
    parameterSuggestions: Array<{
        param: string;
        current: string;
        suggested: string;
        reason: string;
        impact: 'high' | 'medium' | 'low';
    }>;
    actionPlan: string[];
    raw?: boolean;
}

export interface DiagnosticInput {
    tab: 'lay0x1' | 'lay1x0' | 'robo';
    metrics: {
        total: number;
        greens: number;
        reds: number;
        winRate: number;
        profit: number;
        avgOdd: number;
    };
    redAnalysis: Array<{
        game: string;
        league: string;
        score: string;
        criteria: Record<string, any>;
        date: string;
    }>;
    leagueBreakdown: Array<{
        name: string;
        total: number;
        greens: number;
        reds: number;
        winRate: number;
        profit: number;
    }>;
    paramSnapshot: Record<string, any>;
    oddRangeStats: Array<{
        range: string;
        total: number;
        greens: number;
        reds: number;
        winRate: number;
        profit: number;
    }>;
    recentTrend: Array<{
        date: string;
        greens: number;
        reds: number;
        profit: number;
    }>;
    variationName?: string;
    methodBreakdown?: {
        ht: { greens: number; reds: number; profit: number; roi: number };
        o15: { greens: number; reds: number; profit: number; roi: number };
    };
}

export function useAIDiagnosticReport() {
    const [report, setReport] = useState<DiagnosticReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateReport = useCallback(async (input: DiagnosticInput) => {
        setLoading(true);
        setError(null);

        try {
            const response = await supabase.functions.invoke('analyze-diagnostic-report', {
                body: input,
            });

            if (response.error) {
                throw new Error(response.error.message || 'Erro ao gerar relatório');
            }

            const data = response.data;
            if (data?.report) {
                setReport(data.report);
                return data.report as DiagnosticReport;
            } else if (data?.error) {
                throw new Error(data.error);
            } else {
                throw new Error('Resposta inesperada da IA');
            }
        } catch (err: any) {
            const errorMsg = err.message || 'Erro desconhecido';
            setError(errorMsg);
            console.error('Diagnostic report error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const clearReport = useCallback(() => {
        setReport(null);
        setError(null);
    }, []);

    return { report, loading, error, generateReport, clearReport };
}
