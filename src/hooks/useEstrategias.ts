import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Estrategia } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export const useEstrategias = () => {
  const [estrategias, setEstrategias] = useState<Estrategia[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchEstrategias = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('estrategias')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEstrategias((data as Estrategia[]) || []);
    } catch (error) {
      console.error('Error fetching estrategias:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstrategias();
  }, [user]);

  const addEstrategia = async (estrategia: Omit<Estrategia, 'id' | 'owner_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('estrategias')
        .insert([{ ...estrategia, owner_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setEstrategias([data as Estrategia, ...estrategias]);
    } catch (error) {
      console.error('Error adding estrategia:', error);
    }
  };

  const updateEstrategia = async (id: string, updates: Partial<Estrategia>) => {
    try {
      const { error } = await supabase
        .from('estrategias')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      setEstrategias(estrategias.map(e => e.id === id ? { ...e, ...updates } : e));
    } catch (error) {
      console.error('Error updating estrategia:', error);
    }
  };

  const deleteEstrategia = async (id: string) => {
    try {
      const { error } = await supabase
        .from('estrategias')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setEstrategias(estrategias.filter(e => e.id !== id));
    } catch (error) {
      console.error('Error deleting estrategia:', error);
    }
  };

  return {
    estrategias,
    loading,
    addEstrategia,
    updateEstrategia,
    deleteEstrategia,
    refreshEstrategias: fetchEstrategias,
  };
};
