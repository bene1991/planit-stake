import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DailyGame {
  id: string;
  date: string;
  time: string;
  date_time?: string;
  league: string;
  home_team: string;
  away_team: string;
  home_team_logo?: string;
  away_team_logo?: string;
  status: string;
  added_to_planning: boolean;
  created_at?: string;
  updated_at?: string;
}

export const useDailyGames = () => {
  const { user } = useAuth();
  const [dailyGames, setDailyGames] = useState<DailyGame[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDailyGames = async () => {
    if (!user) {
      setDailyGames([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('daily_games')
        .select('*')
        .eq('owner_id', user.id)
        .order('date_time', { ascending: true });

      if (error) throw error;
      setDailyGames(data || []);
    } catch (error) {
      console.error('Error loading daily games:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDailyGames();
  }, [user]);

  const clearDailyGames = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('daily_games')
        .delete()
        .eq('owner_id', user.id);

      if (error) throw error;
      await loadDailyGames();
    } catch (error) {
      console.error('Error clearing daily games:', error);
      throw error;
    }
  };

  const markAsAdded = async (gameId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('daily_games')
        .update({ added_to_planning: true })
        .eq('id', gameId);

      if (error) throw error;
      await loadDailyGames();
    } catch (error) {
      console.error('Error marking game as added:', error);
      throw error;
    }
  };

  return {
    dailyGames,
    loading,
    loadDailyGames,
    clearDailyGames,
    markAsAdded,
  };
};
