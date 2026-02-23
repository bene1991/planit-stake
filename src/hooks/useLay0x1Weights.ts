import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Lay0x1Weights {
  id?: string;
  owner_id?: string;
  offensive_weight: number;
  defensive_weight: number;
  over_weight: number;
  league_avg_weight: number;
  h2h_weight: number;
  odds_weight: number;
  min_home_goals_avg: number;
  min_away_conceded_avg: number;
  max_away_odd: number;
  min_over15_combined: number;
  max_h2h_0x1: number;
  cycle_count: number;
  last_calibration_at?: string;
}

const DEFAULT_WEIGHTS: Lay0x1Weights = {
  offensive_weight: 20,
  defensive_weight: 20,
  over_weight: 20,
  league_avg_weight: 15,
  h2h_weight: 15,
  odds_weight: 10,
  min_home_goals_avg: 1.5,
  min_away_conceded_avg: 1.5,
  max_away_odd: 4.5,
  min_over15_combined: 70,
  max_h2h_0x1: 0,
  cycle_count: 0,
};

export const useLay0x1Weights = () => {
  const { user } = useAuth();
  const [weights, setWeights] = useState<Lay0x1Weights>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(true);

  const fetchWeights = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('lay0x1_weights')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();
    
    if (data) {
      setWeights(data);
    } else {
      setWeights(DEFAULT_WEIGHTS);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchWeights(); }, [fetchWeights]);

  const saveWeights = useCallback(async (newWeights: Partial<Lay0x1Weights>) => {
    if (!user) return;
    const payload = {
      owner_id: user.id,
      ...DEFAULT_WEIGHTS,
      ...weights,
      ...newWeights,
      updated_at: new Date().toISOString(),
    };
    delete (payload as any).id;

    const { error } = await (supabase as any)
      .from('lay0x1_weights')
      .upsert(payload, { onConflict: 'owner_id' });

    if (!error) {
      setWeights(prev => ({ ...prev, ...newWeights }));
    }
    return error;
  }, [user, weights]);

  const resetWeights = useCallback(() => saveWeights(DEFAULT_WEIGHTS), [saveWeights]);

  return { weights, loading, saveWeights, resetWeights, refetch: fetchWeights };
};
