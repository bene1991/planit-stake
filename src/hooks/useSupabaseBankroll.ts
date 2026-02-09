import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Method {
  id: string;
  name: string;
  percentage: number;
  indice_confianca?: number;
  sort_order?: number;
}

export interface Bankroll {
  total: number;
  methods: Method[];
}

const defaultBankroll: Bankroll = {
  total: 10000,
  methods: [],
};

export const useSupabaseBankroll = () => {
  const { user } = useAuth();
  const [bankroll, setBankroll] = useState<Bankroll>(defaultBankroll);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadBankroll();
      loadMethods();
    }
  }, [user]);

  const loadBankroll = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('bankroll')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading bankroll:', error);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      // Use o registro mais recente
      const latestBankroll = data[0];
      setBankroll((prev) => ({ ...prev, total: Number(latestBankroll.total) }));
      
      // Deletar duplicados se existirem
      if (data.length > 1) {
        const duplicateIds = data.slice(1).map(b => b.id);
        await supabase
          .from('bankroll')
          .delete()
          .in('id', duplicateIds);
      }
    } else {
      // Create default bankroll
      const { error: insertError } = await supabase
        .from('bankroll')
        .insert({ owner_id: user.id, total: 10000 });
      
      if (insertError) {
        console.error('Error creating bankroll:', insertError);
      }
    }
    setLoading(false);
  };

  const loadMethods = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('methods')
      .select('*')
      .eq('owner_id', user.id)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading methods:', error);
      return;
    }

    if (data) {
      const methods = data.map(m => ({
        id: m.id,
        name: m.name,
        percentage: Number(m.percentage),
        indice_confianca: m.indice_confianca ? Number(m.indice_confianca) : 0,
        sort_order: m.sort_order ?? 0,
      }));
      setBankroll((prev) => ({ ...prev, methods }));
    }
  };

  const atualizarIndicesConfianca = async () => {
    if (!user) return;

    try {
      // Chamar função do Supabase para atualizar índices
      const { error } = await supabase.rpc('atualizar_indices_confianca', {
        user_id_param: user.id
      });

      if (error) throw error;

      // Recarregar métodos para pegar novos índices
      await loadMethods();
      toast.success('Índices de confiança atualizados!');
    } catch (error) {
      console.error('Error updating confidence indices:', error);
      toast.error('Erro ao atualizar índices');
    }
  };

  const updateTotal = async (total: number) => {
    if (!user) return;

    // Buscar o registro mais recente
    const { data: bankrollData } = await supabase
      .from('bankroll')
      .select('id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!bankrollData) return;

    const { error } = await supabase
      .from('bankroll')
      .update({ total })
      .eq('id', bankrollData.id);

    if (error) {
      toast.error('Erro ao atualizar banca');
      console.error('Error updating bankroll:', error);
      return;
    }

    setBankroll((prev) => ({ ...prev, total }));
    toast.success('Banca atualizada!');
  };

  const addMethod = async (method: Omit<Method, "id">) => {
    if (!user) return;

    const maxOrder = bankroll.methods.reduce((max, m) => Math.max(max, m.sort_order ?? 0), 0);

    const { data, error } = await supabase
      .from('methods')
      .insert({
        owner_id: user.id,
        name: method.name,
        percentage: method.percentage,
        sort_order: maxOrder + 1,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao adicionar método');
      console.error('Error adding method:', error);
      return;
    }

    if (data) {
      const newMethod: Method = {
        id: data.id,
        name: data.name,
        percentage: Number(data.percentage),
        indice_confianca: data.indice_confianca ? Number(data.indice_confianca) : 0,
      };
      setBankroll((prev) => ({
        ...prev,
        methods: [...prev.methods, newMethod],
      }));
      toast.success('Método adicionado!');
    }
  };

  const updateMethod = async (id: string, updates: Partial<Method>) => {
    if (!user) return;

    const { error } = await supabase
      .from('methods')
      .update(updates)
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) {
      toast.error('Erro ao atualizar método');
      console.error('Error updating method:', error);
      return;
    }

    setBankroll((prev) => ({
      ...prev,
      methods: prev.methods.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
    toast.success('Método atualizado!');
  };

  const deleteMethod = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('methods')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) {
      toast.error('Erro ao deletar método');
      console.error('Error deleting method:', error);
      return;
    }

    setBankroll((prev) => ({
      ...prev,
      methods: prev.methods.filter((m) => m.id !== id),
    }));
    toast.success('Método removido!');
  };

  const moveMethod = async (index: number, direction: 'up' | 'down') => {
    if (!user) return;
    const methods = [...bankroll.methods];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= methods.length) return;

    // Swap sort_order values
    const currentOrder = methods[index].sort_order ?? index;
    const targetOrder = methods[targetIndex].sort_order ?? targetIndex;

    // Optimistic update
    const swapped = [...methods];
    [swapped[index], swapped[targetIndex]] = [swapped[targetIndex], swapped[index]];
    swapped[index].sort_order = currentOrder;
    swapped[targetIndex].sort_order = targetOrder;
    setBankroll(prev => ({ ...prev, methods: swapped }));

    // Persist
    const updates = [
      supabase.from('methods').update({ sort_order: targetOrder } as any).eq('id', methods[index].id).eq('owner_id', user.id),
      supabase.from('methods').update({ sort_order: currentOrder } as any).eq('id', methods[targetIndex].id).eq('owner_id', user.id),
    ];
    const results = await Promise.all(updates);
    if (results.some(r => r.error)) {
      toast.error('Erro ao reordenar');
      await loadMethods();
    }
  };

  return {
    bankroll,
    loading,
    updateTotal,
    addMethod,
    updateMethod,
    deleteMethod,
    atualizarIndicesConfianca,
    moveMethod,
  };
};
