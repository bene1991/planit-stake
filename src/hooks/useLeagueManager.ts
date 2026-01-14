import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LeagueInfo {
  name: string;
  gamesCount: number;
  gameIds: string[];
}

export const useLeagueManager = (games: { id: string; league: string }[]) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Get unique leagues with game counts
  const leagues = useMemo(() => {
    const leagueMap = new Map<string, LeagueInfo>();
    
    games.forEach(game => {
      const existing = leagueMap.get(game.league);
      if (existing) {
        existing.gamesCount++;
        existing.gameIds.push(game.id);
      } else {
        leagueMap.set(game.league, {
          name: game.league,
          gamesCount: 1,
          gameIds: [game.id],
        });
      }
    });

    return Array.from(leagueMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }, [games]);

  // Find potential duplicates (similar names)
  const findDuplicates = useCallback(() => {
    const duplicates: { original: string; similar: string[] }[] = [];
    const leagueNames = leagues.map(l => l.name);

    leagueNames.forEach((name, i) => {
      const similar: string[] = [];
      const normalized = name.toLowerCase().replace(/[-_\s]/g, '');
      
      leagueNames.forEach((other, j) => {
        if (i !== j) {
          const otherNormalized = other.toLowerCase().replace(/[-_\s]/g, '');
          if (normalized === otherNormalized || 
              name.includes(other) || 
              other.includes(name)) {
            similar.push(other);
          }
        }
      });

      if (similar.length > 0 && !duplicates.some(d => d.original === name || d.similar.includes(name))) {
        duplicates.push({ original: name, similar });
      }
    });

    return duplicates;
  }, [leagues]);

  // Rename a league (update all games)
  const renameLeague = useCallback(async (oldName: string, newName: string) => {
    if (!user) return false;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ league: newName })
        .eq('owner_id', user.id)
        .eq('league', oldName);

      if (error) throw error;

      toast.success(`Liga renomeada: ${oldName} → ${newName}`);
      return true;
    } catch (error: any) {
      toast.error(`Erro ao renomear liga: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Merge multiple leagues into one
  const mergeLeagues = useCallback(async (sourceLeagues: string[], targetLeague: string) => {
    if (!user) return false;
    
    setLoading(true);
    try {
      for (const source of sourceLeagues) {
        if (source !== targetLeague) {
          const { error } = await supabase
            .from('games')
            .update({ league: targetLeague })
            .eq('owner_id', user.id)
            .eq('league', source);

          if (error) throw error;
        }
      }

      toast.success(`Ligas mescladas em: ${targetLeague}`);
      return true;
    } catch (error: any) {
      toast.error(`Erro ao mesclar ligas: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update single game's league
  const updateGameLeague = useCallback(async (gameId: string, newLeague: string) => {
    if (!user) return false;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ league: newLeague })
        .eq('id', gameId)
        .eq('owner_id', user.id);

      if (error) throw error;

      toast.success('Liga do jogo atualizada');
      return true;
    } catch (error: any) {
      toast.error(`Erro ao atualizar liga: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Get list of countries for dropdown
  const countries = useMemo(() => [
    'Argentina', 'Australia', 'Austria', 'Belgium', 'Brazil', 'Chile', 'China',
    'Colombia', 'Croatia', 'Czech Republic', 'Denmark', 'Ecuador', 'Egypt',
    'England', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'India',
    'Indonesia', 'Iran', 'Ireland', 'Israel', 'Italy', 'Japan', 'Mexico',
    'Morocco', 'Netherlands', 'Nigeria', 'Norway', 'Paraguay', 'Peru', 'Poland',
    'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Scotland',
    'Serbia', 'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Thailand',
    'Turkey', 'UAE', 'Ukraine', 'Uruguay', 'USA', 'Venezuela', 'Wales'
  ], []);

  return {
    leagues,
    loading,
    countries,
    renameLeague,
    mergeLeagues,
    updateGameLeague,
    findDuplicates,
  };
};
