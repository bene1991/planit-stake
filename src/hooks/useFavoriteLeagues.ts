import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FavoriteLeague {
  id: string;
  league_id: number;
  league_name: string;
  country: string | null;
  logo: string | null;
}

export function useFavoriteLeagues() {
  const { user } = useAuth();
  const [favoriteLeagues, setFavoriteLeagues] = useState<FavoriteLeague[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavoriteLeagues = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_favorite_leagues')
        .select('*')
        .eq('owner_id', user.id)
        .order('league_name');

      if (error) throw error;
      setFavoriteLeagues(data || []);
    } catch (error) {
      console.error('Error loading favorite leagues:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadFavoriteLeagues();
  }, [loadFavoriteLeagues]);

  const addFavoriteLeague = async (league: {
    league_id: number;
    league_name: string;
    country?: string;
    logo?: string;
  }) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_favorite_leagues')
        .insert({
          owner_id: user.id,
          league_id: league.league_id,
          league_name: league.league_name,
          country: league.country || null,
          logo: league.logo || null,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Esta liga já está nos favoritos');
          return;
        }
        throw error;
      }

      toast.success(`${league.league_name} adicionada aos favoritos`);
      await loadFavoriteLeagues();
    } catch (error) {
      console.error('Error adding favorite league:', error);
      toast.error('Erro ao adicionar liga');
    }
  };

  const removeFavoriteLeague = async (leagueId: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_favorite_leagues')
        .delete()
        .eq('owner_id', user.id)
        .eq('league_id', leagueId);

      if (error) throw error;

      toast.success('Liga removida dos favoritos');
      await loadFavoriteLeagues();
    } catch (error) {
      console.error('Error removing favorite league:', error);
      toast.error('Erro ao remover liga');
    }
  };

  const isFavorite = (leagueId: number) => {
    return favoriteLeagues.some(l => l.league_id === leagueId);
  };

  return {
    favoriteLeagues,
    loading,
    addFavoriteLeague,
    removeFavoriteLeague,
    isFavorite,
    refresh: loadFavoriteLeagues,
  };
}
