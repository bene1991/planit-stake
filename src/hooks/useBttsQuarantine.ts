import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BttsLeagueQuarantine } from '@/types/btts';
import { toast } from 'sonner';
import { addDays, isAfter } from 'date-fns';

export function useBttsQuarantine() {
  const { user } = useAuth();
  const [quarantines, setQuarantines] = useState<BttsLeagueQuarantine[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuarantines = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('btts_league_quarantine')
        .select('*')
        .eq('owner_id', user.id);

      if (error) throw error;

      // Filter active quarantines
      const now = new Date();
      const active = (data || []).filter(q => 
        isAfter(new Date(q.quarantine_until), now)
      );

      setQuarantines(active as BttsLeagueQuarantine[]);
    } catch (error) {
      console.error('Error fetching quarantines:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchQuarantines();
  }, [fetchQuarantines]);

  const addQuarantine = async (league: string, reason: string) => {
    if (!user) return false;

    const quarantineUntil = addDays(new Date(), 14);

    try {
      const { error } = await supabase
        .from('btts_league_quarantine')
        .upsert({
          owner_id: user.id,
          league,
          quarantine_until: quarantineUntil.toISOString().split('T')[0],
          reason,
        }, {
          onConflict: 'owner_id,league',
        });

      if (error) throw error;

      await fetchQuarantines();
      toast.success(`${league} em quarentena por 14 dias`);
      return true;
    } catch (error) {
      console.error('Error adding quarantine:', error);
      toast.error('Erro ao adicionar quarentena');
      return false;
    }
  };

  const removeQuarantine = async (league: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('btts_league_quarantine')
        .delete()
        .eq('owner_id', user.id)
        .eq('league', league);

      if (error) throw error;

      setQuarantines(prev => prev.filter(q => q.league !== league));
      toast.success(`${league} removida da quarentena`);
      return true;
    } catch (error) {
      console.error('Error removing quarantine:', error);
      toast.error('Erro ao remover quarentena');
      return false;
    }
  };

  const quarantineLeagues = quarantines.map(q => q.league);

  return {
    quarantines,
    quarantineLeagues,
    loading,
    addQuarantine,
    removeQuarantine,
    refetch: fetchQuarantines,
  };
}
