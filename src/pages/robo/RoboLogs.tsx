import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Loader2, ListFilter, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { RobotExecutionLog } from "@/types/database/live-alerts";

export default function RoboLogs() {
    const [logs, setLogs] = useState<RobotExecutionLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('robot_execution_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) throw error;
            setLogs(data || []);
        } catch (error: any) {
            toast.error('Erro ao buscar logs', { description: error.message });
        } finally {
            if (loading) setLoading(false);
        }
    };

    const getStageBadge = (stage: string) => {
        switch (stage) {
            case 'FILTER': return <Badge variant="secondary" className="bg-zinc-700/50">Filtro Base</Badge>;
            case 'FROZEN': return <Badge variant="outline" className="border-orange-500/50 text-orange-400">Dados Congelados</Badge>;
            case 'SNAPSHOT': return <Badge variant="secondary" className="bg-blue-900/40 text-blue-300">Gravação Delta</Badge>;
            case 'VARIATION': return <Badge variant="secondary" className="bg-purple-900/40 text-purple-300">Match Variação</Badge>;
            case 'CLEANUP': return <Badge variant="outline" className="text-zinc-400">Limpeza DB</Badge>;
            case 'DISCARDED_PRE_FILTER': return <Badge variant="secondary" className="bg-emerald-900/40 text-emerald-300">Pré-Filtro</Badge>;
            case 'DISCARDED_FILTER': return <Badge variant="secondary" className="bg-red-900/40 text-red-300">Filtro Rejeitado</Badge>;
            default: return <Badge variant="outline">{stage}</Badge>;
        }
    };

    const blockLeague = async (leagueId: string, leagueName: string) => {
        try {
            const { error } = await supabase.from('robot_blocked_leagues').upsert({
                league_id: leagueId.toString(),
                league_name: leagueName,
                active: true
            }, { onConflict: 'league_id' });

            if (error) throw error;
            toast.success(`Liga bloqueada: ${leagueName}`);
            fetchLogs();
        } catch (error: any) {
            toast.error('Erro ao bloquear liga', { description: error.message });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-medium text-white flex items-center">
                        <Cpu className="w-5 h-5 mr-2 text-blue-400" />
                        Logs de Execução (Edge Function)
                    </h3>
                    <p className="text-sm text-muted-foreground">Histórico técnico das últimas avaliações do robô.</p>
                </div>
            </div>

            <div className="rounded-md border border-[#2a3142] overflow-hidden">
                <Table>
                    <TableHeader className="bg-[#1e2333]/50">
                        <TableRow className="border-[#2a3142] hover:bg-transparent">
                            <TableHead className="text-[#a1a1aa] font-medium w-[150px]">Data/Hora</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium w-[180px]">Liga</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium w-[200px]">Times</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium">Estágio / Minuto</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium">Motivo / Detalhe</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium w-[100px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="bg-[#1a1f2d]">
                        {loading ? (
                            <TableRow className="border-[#2a3142]">
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <div className="flex items-center justify-center text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                        Carregando logs técnicos...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow className="border-[#2a3142]">
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Nenhum log recente. O cron-job pode não estar rodando.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => {
                                const details = log.details as any;
                                const league = details?.league || '-';
                                const teams = details?.teams || '-';
                                const minute = details?.minute !== undefined ? `${details.minute}'` : '';

                                return (
                                    <TableRow key={log.id} className="border-[#2a3142] hover:bg-[#1e2333]/50 transition-colors">
                                        <TableCell className="text-zinc-400 text-sm font-mono">
                                            {format(new Date(log.created_at || ''), 'dd/MM HH:mm:ss')}
                                        </TableCell>
                                        <TableCell className="text-zinc-400 text-xs truncate max-w-[180px]" title={league}>
                                            {league}
                                        </TableCell>
                                        <TableCell className="text-white text-sm font-medium truncate max-w-[200px]" title={teams}>
                                            {teams}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getStageBadge(log.stage)}
                                                {minute && <Badge variant="outline" className="text-blue-400 border-blue-400/30">{minute}</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-300">
                                            {log.reason.includes(' - ') ? log.reason.split(' - ').slice(1).join(' - ') : log.reason}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                                onClick={() => blockLeague(log.league_id, league)}
                                            >
                                                Bloquear
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
