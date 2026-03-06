import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StrategySimulation {
    id: string;
    name: string;
    entry_minute: number;
    exit_minute: number;
    dataset_size: number;
    games_analyzed: number;
    greens: number;
    reds: number;
    goals_in_window: number;
    win_rate: number;
    total_stakes: number;
    avg_profit: number;
    roi: number;
    filters_snapshot: any;
    simulation_version: string;
    green_stake: number;
    red_stake: number;
    user_id: string;
    created_at: string;
}

export function useStrategySimulations() {
    const queryClient = useQueryClient();

    const { data: simulations, isLoading } = useQuery({
        queryKey: ["strategy-simulations"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("strategy_simulations")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as StrategySimulation[];
        },
    });

    const saveSimulation = useMutation({
        mutationFn: async (simulation: Omit<StrategySimulation, "id" | "created_at" | "user_id">) => {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) throw new Error("Usuário não autenticado");

            const { data, error } = await supabase
                .from("strategy_simulations")
                .insert([{ ...simulation, user_id: userData.user.id }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["strategy-simulations"] });
            toast.success("Simulação salva com sucesso!");
        },
        onError: (error) => {
            console.error("Erro ao salvar simulação:", error);
            toast.error("Erro ao salvar simulação");
        },
    });

    const deleteSimulation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("strategy_simulations")
                .delete()
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["strategy-simulations"] });
            toast.success("Simulação excluída");
        },
        onError: (error) => {
            console.error("Erro ao excluir simulação:", error);
            toast.error("Erro ao excluir simulação");
        },
    });

    return {
        simulations,
        isLoading,
        saveSimulation,
        deleteSimulation,
    };
}
