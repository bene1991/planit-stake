import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Lay0x1RealOperation {
    id: string;
    owner_id: string;
    fixture_id: string;
    operation_date: string;
    home_team: string;
    away_team: string;
    league: string;
    odd_used: number;
    liability: number;
    stake: number;
    final_score_home: number | null;
    final_score_away: number | null;
    status: string;
    profit: number | null;
    created_at: string;
    updated_at: string;
}

export const useLay0x1RealOperations = () => {
    const [operations, setOperations] = useState<Lay0x1RealOperation[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOperations = useCallback(async () => {
        try {
            setLoading(true);
            const { data: session } = await supabase.auth.getSession();
            if (!session?.session) return;

            const { data, error } = await supabase
                .from('lay_operations_real')
                .select('*')
                .order('operation_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching operations:', error);
                toast.error('Erro ao carregar operações');
                return;
            }

            setOperations(data || []);
        } catch (err) {
            console.error('Error in fetchOperations:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const addOperation = async (op: Omit<Lay0x1RealOperation, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'status' | 'profit' | 'final_score_home' | 'final_score_away'>) => {
        try {
            const { data: session } = await supabase.auth.getSession();
            if (!session?.session) return null;

            const { data, error } = await supabase
                .from('lay_operations_real')
                .insert([{
                    ...op,
                    owner_id: session.session.user.id,
                    status: 'Pending'
                }])
                .select()
                .single();

            if (error) {
                console.error('Error adding operation:', error);
                toast.error('Erro ao salvar operação');
                return null;
            }

            setOperations(prev => [data, ...prev]);
            return data;
        } catch (err) {
            console.error('Error in addOperation:', err);
            return null;
        }
    };

    const updateOdd = async (id: string, newOdd: number) => {
        try {
            // Recalculate stake and profit if status is resolved
            const op = operations.find(o => o.id === id);
            if (!op) return;

            const newStake = op.liability / (newOdd - 1);
            let newProfit = null;

            if (op.status === 'Green') {
                newProfit = newStake;
            } else if (op.status === 'Red') {
                newProfit = -op.liability;
            }

            const { data, error } = await supabase
                .from('lay_operations_real')
                .update({
                    odd_used: newOdd,
                    stake: newStake,
                    profit: newProfit,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error updating odd:', error);
                toast.error('Erro ao atualizar odd');
                return;
            }

            setOperations(prev => prev.map(o => o.id === id ? data : o));
            toast.success('Odd atualizada e valores recalculados');
        } catch (err) {
            console.error('Error in updateOdd:', err);
        }
    };

    const deleteOperation = async (id: string) => {
        try {
            const { error } = await supabase
                .from('lay_operations_real')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting operation:', error);
                toast.error('Erro ao excluir operação');
                return;
            }

            setOperations(prev => prev.filter(o => o.id !== id));
            toast.success('Operação excluída');
        } catch (err) {
            console.error('Error in deleteOperation:', err);
        }
    };

    useEffect(() => {
        fetchOperations();
    }, [fetchOperations]);

    return {
        operations,
        loading,
        fetchOperations,
        addOperation,
        updateOdd,
        deleteOperation
    };
};
