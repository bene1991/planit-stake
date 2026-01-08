import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BttsHealthSettings } from '@/types/btts';
import { toast } from 'sonner';

const defaultSettings: Omit<BttsHealthSettings, 'id' | 'owner_id' | 'created_at' | 'updated_at'> = {
  stake_percent: 3.0,
  bankroll_initial: 5000,
  bankroll_current: 5000,
  bankroll_peak: 5000,
  pause_until: null,
  stake_reduction_until: null,
  stake_reduction_percent: 0,
  odd_range_min: 2.05,
  odd_range_max: 2.55,
};

export function useBttsSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BttsHealthSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('btts_health_settings')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as BttsHealthSettings);
      } else {
        // Create default settings
        const { data: newData, error: insertError } = await supabase
          .from('btts_health_settings')
          .insert({ ...defaultSettings, owner_id: user.id })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newData as BttsHealthSettings);
      }
    } catch (error) {
      console.error('Error fetching BTTS settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<BttsHealthSettings>) => {
    if (!user || !settings) return false;

    try {
      const { error } = await supabase
        .from('btts_health_settings')
        .update(updates)
        .eq('id', settings.id)
        .eq('owner_id', user.id);

      if (error) throw error;

      setSettings(prev => (prev ? { ...prev, ...updates } : prev));
      return true;
    } catch (error) {
      console.error('Error updating BTTS settings:', error);
      toast.error('Erro ao atualizar configurações');
      return false;
    }
  };

  const updateBankroll = async (newBankroll: number) => {
    if (!settings) return false;

    const updates: Partial<BttsHealthSettings> = {
      bankroll_current: newBankroll,
    };

    // Update peak if new bankroll is higher
    if (newBankroll > settings.bankroll_peak) {
      updates.bankroll_peak = newBankroll;
    }

    return updateSettings(updates);
  };

  const setPause = async (hours: number) => {
    const pauseUntil = new Date();
    pauseUntil.setHours(pauseUntil.getHours() + hours);
    return updateSettings({ pause_until: pauseUntil.toISOString() });
  };

  const setStakeReduction = async (percent: number, days: number) => {
    const reductionUntil = new Date();
    reductionUntil.setDate(reductionUntil.getDate() + days);
    return updateSettings({
      stake_reduction_percent: percent,
      stake_reduction_until: reductionUntil.toISOString(),
    });
  };

  const clearPause = async () => {
    return updateSettings({ pause_until: null });
  };

  const clearStakeReduction = async () => {
    return updateSettings({
      stake_reduction_percent: 0,
      stake_reduction_until: null,
    });
  };

  return {
    settings,
    loading,
    updateSettings,
    updateBankroll,
    setPause,
    setStakeReduction,
    clearPause,
    clearStakeReduction,
    refetch: fetchSettings,
  };
}
