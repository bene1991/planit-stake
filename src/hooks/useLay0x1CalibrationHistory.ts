import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CalibrationHistoryRecord {
  id: string;
  owner_id: string;
  cycle_number: number;
  trigger_type: string;
  total_analyses: number;
  general_rate: number;
  old_weights: Record<string, number>;
  new_weights: Record<string, number>;
  old_thresholds: Record<string, number>;
  new_thresholds: Record<string, number>;
  criterion_rates: Record<string, number>;
  threshold_details: Record<string, any>;
  patterns_detected: Record<string, any>;
  changes_summary: string[];
  forced_rebalance: boolean;
  ai_recommendations: Record<string, any>;
  created_at: string;
}

export const useLay0x1CalibrationHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<CalibrationHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('lay0x1_calibration_history')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setHistory(data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return { history, loading, refetch: fetchHistory };
};
