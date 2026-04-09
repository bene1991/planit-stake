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
            case 'VARIATION_EVALUATION': return <Badge variant="secondary" className="bg-slate-700/50 text-slate-300 border-slate-600">Análise Filtro</Badge>;
            case 'ALERT_SENT': return <Badge variant="secondary" className="bg-green-600/20 text-green-400 border-green-500/20">Alerta Enviado</Badge>;
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
            <div className="rounded-2xl border border-white/5 bg-[#141416]/50 backdrop-blur-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <Table>
                        <TableHeader className="bg-white/10">
                            <TableRow className="border-white/10 hover:bg-transparent">
                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest min-w-[120px]">Data/Hora</TableHead>
                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest min-w-[150px]">Liga</TableHead>
                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest min-w-[200px]">Partida</TableHead>
                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest min-w-[130px]">Estágio / Min</TableHead>
                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest min-w-[200px]">Diagnóstico</TableHead>
                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest w-[80px] text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="bg-[#1a1f2d]">
                            {loading ? (
                                <TableRow className="border-white/5">
                                    <TableCell colSpan={6} className="h-40 text-center">
                                        <div className="flex flex-col items-center gap-3 justify-center text-zinc-600">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                            <span className="font-black text-[10px] uppercase tracking-widest">Sincronizando logs do servidor...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow className="border-white/5">
                                    <TableCell colSpan={6} className="h-40 text-center text-zinc-600">
                                        <div className="font-black text-[10px] uppercase tracking-widest italic opacity-50">
                                            Nenhum evento registrado pelo robô nas últimas 24h
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => {
                                    const details = log.details as any;
                                    const league = details?.league || '-';
                                    const teams = details?.teams || '-';
                                    const minute = details?.minute !== undefined ? `${details.minute}'` : '';

                                    return (
                                        <TableRow key={log.id} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                                            <TableCell className="text-zinc-500 text-xs font-mono py-4">
                                                {format(new Date(log.created_at || ''), 'dd/MM HH:mm:ss')}
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="text-zinc-300 text-[11px] font-bold uppercase tracking-tight" title={league}>
                                                    {league}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="text-white text-[11px] font-black uppercase tracking-tight" title={teams}>
                                                    {teams}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {getStageBadge(log.stage)}
                                                    {minute && <Badge variant="outline" className="text-blue-400 border-blue-400/20 bg-blue-400/5 text-[9px] font-black px-1.5 h-4">{minute}</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="text-[11px] font-bold text-zinc-400 leading-relaxed">
                                                    {log.reason.includes(' - ') ? log.reason.split(' - ').slice(1).join(' - ') : log.reason}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-4">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-3 text-[9px] font-black uppercase tracking-widest text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                    onClick={() => blockLeague(log.league_id, league)}
                                                >
                                                    BLOQUEAR
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
        </div>
    );
}
