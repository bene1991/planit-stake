import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Simulacao } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export const useSimulacoes = () => {
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchSimulacoes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('simulacoes')
        .select('*')
        .eq('owner_id', user.id)
        .order('data', { ascending: false });

      if (error) throw error;
      setSimulacoes((data as Simulacao[]) || []);
    } catch (error) {
      console.error('Error fetching simulacoes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulacoes();
  }, [user]);

  const addSimulacao = async (simulacao: Omit<Simulacao, 'id' | 'owner_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('simulacoes')
        .insert([{ ...simulacao, owner_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setSimulacoes([data as Simulacao, ...simulacoes]);
    } catch (error) {
      console.error('Error adding simulacao:', error);
    }
  };

  const updateSimulacao = async (id: string, updates: Partial<Simulacao>) => {
    try {
      const { error } = await supabase
        .from('simulacoes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      setSimulacoes(simulacoes.map(s => s.id === id ? { ...s, ...updates } : s));
    } catch (error) {
      console.error('Error updating simulacao:', error);
    }
  };

  const deleteSimulacao = async (id: string) => {
    try {
      const { error } = await supabase
        .from('simulacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSimulacoes(simulacoes.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting simulacao:', error);
    }
  };

  return {
    simulacoes,
    loading,
    addSimulacao,
    updateSimulacao,
    deleteSimulacao,
    refreshSimulacoes: fetchSimulacoes,
  };
};
