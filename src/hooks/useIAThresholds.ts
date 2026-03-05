import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface IAThresholds {
    max_away_odd: number;
    min_home_goals_avg: number;
    min_away_conceded_avg: number;
    min_btts_pct: number;
    min_over25_pct: number;
    max_home_clean_sheet_pct: number;
    max_away_clean_sheet_pct: number;
}

export interface IAThresholdsRow extends IAThresholds {
    id: string;
    cycle: number;
    games_since_calibration: number;
    calibration_trigger: number;
    last_calibrated_at: string | null;
}

const DEFAULTS: IAThresholds = {
    max_away_odd: 5.0,
    min_home_goals_avg: 1.2,
    min_away_conceded_avg: 1.5,
    min_btts_pct: 50,
    min_over25_pct: 60,
    max_home_clean_sheet_pct: 50,
    max_away_clean_sheet_pct: 40,
};

export const useIAThresholds = () => {
    const { user } = useAuth();
    const [thresholds, setThresholds] = useState<IAThresholdsRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [calibrating, setCalibrating] = useState(false);

    const fetchThresholds = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        // Try to cast the query to work with the dynamic table
        const { data, error } = await (supabase as any)
            .from('lay0x1_ia_thresholds')
            .select('*')
            .eq('owner_id', user.id)
            .maybeSingle();

        if (!error && data) {
            setThresholds({
                id: data.id,
                cycle: data.cycle,
                max_away_odd: parseFloat(data.max_away_odd),
                min_home_goals_avg: parseFloat(data.min_home_goals_avg),
                min_away_conceded_avg: parseFloat(data.min_away_conceded_avg),
                min_btts_pct: parseFloat(data.min_btts_pct),
                min_over25_pct: parseFloat(data.min_over25_pct),
                max_home_clean_sheet_pct: parseFloat(data.max_home_clean_sheet_pct),
                max_away_clean_sheet_pct: parseFloat(data.max_away_clean_sheet_pct),
                games_since_calibration: data.games_since_calibration || 0,
                calibration_trigger: data.calibration_trigger || 20,
                last_calibrated_at: data.last_calibrated_at,
            });
        } else {
            // Table might not exist yet — use defaults
            setThresholds(null);
        }
        setLoading(false);
    }, [user]);

    useEffect(() => { fetchThresholds(); }, [fetchThresholds]);

    const currentThresholds: IAThresholds = thresholds || DEFAULTS;

    const calibrate = useCallback(async () => {
        setCalibrating(true);
        try {
            const res = await supabase.functions.invoke('calibrate-ia-selection');
            if (res.data?.error) {
                setCalibrating(false);
                return { error: res.data.error, data: null };
            }
            await fetchThresholds();
            setCalibrating(false);
            return { error: null, data: res.data };
        } catch (err: any) {
            setCalibrating(false);
            return { error: err.message, data: null };
        }
    }, [fetchThresholds]);

    const incrementGamesCount = useCallback(async () => {
        if (!user || !thresholds) return;
        await (supabase as any)
            .from('lay0x1_ia_thresholds')
            .update({
                games_since_calibration: (thresholds.games_since_calibration || 0) + 1,
                updated_at: new Date().toISOString(),
            })
            .eq('owner_id', user.id);
    }, [user, thresholds]);

    return {
        thresholds: currentThresholds,
        meta: thresholds,
        loading,
        calibrating,
        calibrate,
        incrementGamesCount,
        refetch: fetchThresholds,
        DEFAULTS,
    };
};
