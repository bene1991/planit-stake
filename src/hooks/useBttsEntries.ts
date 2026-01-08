import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BttsEntry } from '@/types/btts';
import { toast } from 'sonner';

export function useBttsEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<BttsEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('btts_entries')
        .select('*')
        .eq('owner_id', user.id)
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (error) throw error;
      setEntries((data as BttsEntry[]) || []);
    } catch (error) {
      console.error('Error fetching BTTS entries:', error);
      toast.error('Erro ao carregar entradas');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = async (entry: Omit<BttsEntry, 'id' | 'owner_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;

    // Calculate profit based on result
    let profit: number;
    if (entry.result === 'Green') {
      profit = entry.stake_value * (entry.odd - 1);
    } else if (entry.result === 'Red') {
      profit = -entry.stake_value;
    } else {
      profit = 0; // Void
    }

    try {
      const { data, error } = await supabase
        .from('btts_entries')
        .insert({
          ...entry,
          owner_id: user.id,
          profit,
        })
        .select()
        .single();

      if (error) throw error;
      
      setEntries(prev => [data as BttsEntry, ...prev]);
      toast.success('Entrada registrada!');
      return data as BttsEntry;
    } catch (error) {
      console.error('Error adding BTTS entry:', error);
      toast.error('Erro ao registrar entrada');
      return null;
    }
  };

  const updateEntry = async (id: string, updates: Partial<BttsEntry>) => {
    if (!user) return false;

    // Recalculate profit if result or stake/odd changed
    let profit = updates.profit;
    if (updates.result !== undefined || updates.stake_value !== undefined || updates.odd !== undefined) {
      const currentEntry = entries.find(e => e.id === id);
      if (currentEntry) {
        const result = updates.result ?? currentEntry.result;
        const stake = updates.stake_value ?? currentEntry.stake_value;
        const odd = updates.odd ?? currentEntry.odd;

        if (result === 'Green') {
          profit = stake * (odd - 1);
        } else if (result === 'Red') {
          profit = -stake;
        } else {
          profit = 0;
        }
      }
    }

    try {
      const { error } = await supabase
        .from('btts_entries')
        .update({ ...updates, profit })
        .eq('id', id)
        .eq('owner_id', user.id);

      if (error) throw error;

      setEntries(prev =>
        prev.map(e => (e.id === id ? { ...e, ...updates, profit: profit ?? e.profit } : e))
      );
      toast.success('Entrada atualizada!');
      return true;
    } catch (error) {
      console.error('Error updating BTTS entry:', error);
      toast.error('Erro ao atualizar entrada');
      return false;
    }
  };

  const deleteEntry = async (id: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('btts_entries')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.id);

      if (error) throw error;

      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Entrada removida!');
      return true;
    } catch (error) {
      console.error('Error deleting BTTS entry:', error);
      toast.error('Erro ao remover entrada');
      return false;
    }
  };

  return {
    entries,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
    refetch: fetchEntries,
  };
}
