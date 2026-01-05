import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OperationalSettings {
  id: string;
  metaMensalStakes: number;
  stopDiarioStakes: number;
  devolucaoMaximaPercent: number;
  commissionRate: number;
}

const DEFAULT_SETTINGS: Omit<OperationalSettings, 'id'> = {
  metaMensalStakes: 30,
  stopDiarioStakes: 3,
  devolucaoMaximaPercent: 50,
  commissionRate: 0.045
};

export const useOperationalSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<OperationalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('operational_settings')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          metaMensalStakes: data.meta_mensal_stakes,
          stopDiarioStakes: data.stop_diario_stakes,
          devolucaoMaximaPercent: data.devolucao_maxima_percent,
          commissionRate: data.commission_rate
        });
      } else {
        // Create default settings if none exist
        const { data: newData, error: insertError } = await supabase
          .from('operational_settings')
          .insert({
            owner_id: user.id,
            meta_mensal_stakes: DEFAULT_SETTINGS.metaMensalStakes,
            stop_diario_stakes: DEFAULT_SETTINGS.stopDiarioStakes,
            devolucao_maxima_percent: DEFAULT_SETTINGS.devolucaoMaximaPercent,
            commission_rate: DEFAULT_SETTINGS.commissionRate
          })
          .select()
          .single();

        if (insertError) throw insertError;

        setSettings({
          id: newData.id,
          metaMensalStakes: newData.meta_mensal_stakes,
          stopDiarioStakes: newData.stop_diario_stakes,
          devolucaoMaximaPercent: newData.devolucao_maxima_percent,
          commissionRate: newData.commission_rate
        });
      }
    } catch (error) {
      console.error('Error loading operational settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = async (updates: Partial<Omit<OperationalSettings, 'id'>>) => {
    if (!user || !settings) return;

    try {
      const updatePayload: Record<string, number> = {};
      if (updates.metaMensalStakes !== undefined) updatePayload.meta_mensal_stakes = updates.metaMensalStakes;
      if (updates.stopDiarioStakes !== undefined) updatePayload.stop_diario_stakes = updates.stopDiarioStakes;
      if (updates.devolucaoMaximaPercent !== undefined) updatePayload.devolucao_maxima_percent = updates.devolucaoMaximaPercent;
      if (updates.commissionRate !== undefined) updatePayload.commission_rate = updates.commissionRate;

      const { error } = await supabase
        .from('operational_settings')
        .update(updatePayload)
        .eq('id', settings.id);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('Error updating operational settings:', error);
      throw error;
    }
  };

  return {
    settings: settings || { 
      id: '', 
      ...DEFAULT_SETTINGS 
    },
    loading,
    updateSettings,
    refreshSettings: loadSettings
  };
};
