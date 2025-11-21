import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Settings {
  id?: string;
  api_key?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  last_import_date?: string;
  google_sheets_url?: string;
}

export const useSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading settings:', error);
      }
      
      setSettings(data || null);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [user]);

  const updateSettings = async (updates: Partial<Settings>) => {
    if (!user) throw new Error('User not authenticated');

    try {
      if (settings) {
        // Update existing settings
        const { data, error } = await supabase
          .from('settings')
          .update(updates)
          .eq('owner_id', user.id)
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
        return data;
      } else {
        // Insert new settings
        const { data, error } = await supabase
          .from('settings')
          .insert({ ...updates, owner_id: user.id })
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
        return data;
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    refreshSettings: loadSettings,
  };
};
