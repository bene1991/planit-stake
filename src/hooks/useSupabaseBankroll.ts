import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Method {
  id: string;
  name: string;
  percentage: number;
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
      .maybeSingle();

    if (error) {
      console.error('Error loading bankroll:', error);
      return;
    }

    if (data) {
      setBankroll((prev) => ({ ...prev, total: Number(data.total) }));
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
      .eq('owner_id', user.id);

    if (error) {
      console.error('Error loading methods:', error);
      return;
    }

    if (data) {
      const methods = data.map(m => ({
        id: m.id,
        name: m.name,
        percentage: Number(m.percentage),
      }));
      setBankroll((prev) => ({ ...prev, methods }));
    }
  };

  const updateTotal = async (total: number) => {
    if (!user) return;

    const { error } = await supabase
      .from('bankroll')
      .update({ total })
      .eq('owner_id', user.id);

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

    const { data, error } = await supabase
      .from('methods')
      .insert({
        owner_id: user.id,
        name: method.name,
        percentage: method.percentage,
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

  return {
    bankroll,
    loading,
    updateTotal,
    addMethod,
    updateMethod,
    deleteMethod,
  };
};
