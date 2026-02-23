import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Lay0x1Analysis {
  id: string;
  owner_id: string;
  fixture_id: string;
  home_team: string;
  away_team: string;
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

  const saveAnalysis = useCallback(async (analysis: Omit<Lay0x1Analysis, 'id' | 'owner_id' | 'created_at'>) => {
    if (!user) return null;
    const { data, error } = await (supabase as any)
      .from('lay0x1_analyses')
      .insert({ ...analysis, owner_id: user.id })
      .select()
      .single();
    
    if (!error && data) {
      setAnalyses(prev => [data, ...prev]);
    }
    return { data, error };
  }, [user]);

  const resolveAnalysis = useCallback(async (id: string, scoreHome: number, scoreAway: number) => {
    if (!user) return;
    const was0x1 = scoreHome === 0 && scoreAway === 1;
    const result = was0x1 ? 'Red' : 'Green';

    const { error } = await (supabase as any)
      .from('lay0x1_analyses')
      .update({
        final_score_home: scoreHome,
        final_score_away: scoreAway,
        was_0x1: was0x1,
        result,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_id', user.id);

    if (!error) {
      setAnalyses(prev => prev.map(a => a.id === id ? {
        ...a, final_score_home: scoreHome, final_score_away: scoreAway,
        was_0x1: was0x1, result, resolved_at: new Date().toISOString(),
      } : a));
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

  return { analyses, loading, metrics, saveAnalysis, resolveAnalysis, refetch: fetchAnalyses };
};
