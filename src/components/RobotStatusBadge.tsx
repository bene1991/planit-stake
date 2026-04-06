import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInMinutes, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { BotOff, Bot } from 'lucide-react';

export const RobotStatusBadge = () => {
    // Fetch robot status
    const { data: robotStatus } = useQuery({
        queryKey: ['robot-status'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('robot_status')
                .select('*')
                .eq('id', '00000000-0000-0000-0000-000000000000')
                .single();
            if (error) return null;
            return data;
        },
        refetchInterval: 30000, // Refetch every 30 seconds
    });

    const isRobotOnline = useMemo(() => {
        if (!robotStatus) return false;
        if (robotStatus.status === 'error') return false;
        
        // Se o último ping for mais antigo que 3 minutos (180s), considera offline
        const diff = differenceInMinutes(new Date(), new Date(robotStatus.last_ping));
        return diff <= 3;
    }, [robotStatus]);

    if (!robotStatus) return null;

    return (
        <div 
            className="flex items-center gap-2 px-3 py-1.5 bg-[#2a3142]/50 hover:bg-[#2a3142] transition-colors rounded-full border border-[#3b4256] cursor-help" 
            title={robotStatus.status === 'error' ? `ERRO: ${robotStatus.last_error_message}` : `Último sinal de vida: ${format(new Date(robotStatus.last_ping), 'HH:mm:ss')}`}
        >
            <div className="relative flex h-2.5 w-2.5">
                <span className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", 
                    isRobotOnline ? "bg-emerald-400" : "bg-rose-400"
                )}></span>
                <span className={cn(
                    "relative inline-flex rounded-full h-2.5 w-2.5", 
                    isRobotOnline ? "bg-emerald-500" : "bg-rose-500"
                )}></span>
            </div>
            <span className={cn(
                "text-[10px] md:text-xs font-bold uppercase tracking-wider", 
                isRobotOnline ? "text-emerald-400" : "text-rose-400"
            )}>
                {isRobotOnline ? "Robô: Online" : "Robô: Offline"}
            </span>
        </div>
    );
};
