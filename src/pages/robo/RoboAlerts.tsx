import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Loader2, BellRing, Target, Clock, ArrowRight, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useRef } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Database } from "@/integrations/supabase/types";

type LiveAlert = Database['public']['Tables']['live_alerts']['Row'] & {
    robot_variations?: { name: string }
};
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export default function RoboAlerts() {
    const isMobile = useIsMobile();
    const [alerts, setAlerts] = useState<LiveAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [liveStats, setLiveStats] = useState<Record<string, any>>({});
    const prevAlertsRef = useRef<string[]>([]);
    const prevResultsRef = useRef<Record<string, string>>({});

    const playAlertSound = () => {
        try {
            const audio = new Audio('/sounds/notification-info.mp3');
            audio.play().catch(e => console.warn('Audio play blocked:', e));
        } catch (e) {
            console.warn('Audio play failed:', e);
        }
    };

    const playGoalSound = () => {
        try {
            const audio = new Audio('/sounds/notification-success.mp3');
            audio.play().catch(e => console.warn('Audio play blocked:', e));
        } catch (e) {
            console.warn('Audio play failed:', e);
        }
    };

    useEffect(() => {
        fetchAlerts();

        // Polling for stats is fine, but alerts should be real-time
        const interval = setInterval(() => {
            setAlerts(currentAlerts => {
                if (currentAlerts.length > 0) {
                    const uniqueIds = [...new Set(currentAlerts.map(a => String(a.fixture_id)))];
                    updateLiveStats(uniqueIds);
                }
                return currentAlerts;
            });
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // Real-time subscription for alerts (One-time setup)
        console.log('[RoboAlerts] Starting real-time subscription');
        const channel = supabase
            .channel('public:live_alerts_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'live_alerts'
                },
                (payload) => {
                    console.log('[RoboAlerts] Change detected:', payload);

                    if (payload.eventType === 'INSERT') {
                        const newAlert = payload.new as LiveAlert;
                        setAlerts(prev => {
                            // Deduplicate if already present (e.g. from polling and realtime racing)
                            if (prev.some(a => a.id === newAlert.id)) return prev;
                            return [newAlert, ...prev].slice(0, 100);
                        });
                        playAlertSound();
                        toast.info(`Novo Alerta: ${newAlert.home_team} vs ${newAlert.away_team}`, {
                            description: `Filtro: ${newAlert.variation_name || 'Variação'}`,
                            icon: '🚨'
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as LiveAlert;
                        const old = payload.old as LiveAlert;

                        setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));

                        // Check if goal happened
                        if (
                            (updated.goal_ht_result === 'green' && old?.goal_ht_result !== 'green') ||
                            (updated.over15_result === 'green' && old?.over15_result !== 'green')
                        ) {
                            playGoalSound();
                            toast.success(`GOL NO ROBÔ! ${updated.home_team} vs ${updated.away_team}`, {
                                description: 'Resultado GREEN detectado!',
                                icon: '✅'
                            });
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setAlerts(prev => prev.filter(a => a.id !== payload.old.id));
                    }
                }
            )
            .subscribe((status) => {
                console.log('[RoboAlerts] Subscription status:', status);
            });

        return () => {
            console.log('[RoboAlerts] Removing channel');
            supabase.removeChannel(channel);
        };
    }, []);


    const updateLiveStats = async (fixtureIds: string[]) => {
        try {
            // Fetch all live matches to be efficient
            const { data, error } = await supabase.functions.invoke('api-football', {
                body: { endpoint: 'fixtures', params: { live: 'all' } }
            });

            if (error) throw error;

            const liveFixtures = data?.response || [];
            const statsMap: Record<string, any> = {};

            liveFixtures.forEach((f: any) => {
                const fId = String(f.fixture.id);
                if (fixtureIds.includes(fId)) {
                    statsMap[fId] = {
                        goalsHome: f.goals.home,
                        goalsAway: f.goals.away,
                        minute: f.fixture.status.elapsed,
                        status: f.fixture.status.short
                    };
                }
            });

            setLiveStats(statsMap);
        } catch (err) {
            console.error('Error fetching live stats:', err);
        }
    };

    const fetchAlerts = async () => {
        try {
            const { data, error } = await supabase
                .from('live_alerts')
                .select(`
          *,
          robot_variations(name)
        `)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            // Filter only pending results (where at least one is pending)
            const activeAlerts = (data || []).filter(a =>
                a.goal_ht_result === 'pending' ||
                a.over15_result === 'pending'
            );

            setAlerts(activeAlerts);

            // Fetch live stats for these fixtures
            if (activeAlerts.length > 0) {
                const uniqueIds = [...new Set(activeAlerts.map(a => String(a.fixture_id)))];
                updateLiveStats(uniqueIds);
            }
        } catch (error: any) {
            toast.error('Erro ao buscar alertas', { description: error.message });
        } finally {
            if (loading) setLoading(false);
        }
    };

    const getResultBadge = (result: string | null) => {
        if (!result || result === 'pending') return <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20">Aguardando</Badge>;
        if (result === 'green') return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Green</Badge>;
        if (result === 'red') return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Red</Badge>;
        return null;
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-medium text-white flex items-center">
                        <BellRing className="w-5 h-5 mr-2 text-emerald-400" />
                        Alertas Recentes
                    </h3>
                    <p className="text-sm text-muted-foreground">Oportunidades encontradas pelo robô em tempo real.</p>
                </div>
            </div>

            <div className="rounded-md border border-[#2a3142] overflow-hidden">
                <Table>
                    <TableHeader className="bg-[#1e2333]/50">
                        <TableRow className="border-[#2a3142] hover:bg-transparent">
                            <TableHead className="text-[#a1a1aa] font-medium w-[120px]">{isMobile ? "Data" : "Data/Hora"}</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium">Jogo</TableHead>
                            {!isMobile && <TableHead className="text-[#a1a1aa] font-medium">Variação</TableHead>}
                            <TableHead className="text-[#a1a1aa] font-medium text-center">{isMobile ? "Snap" : "Snapshots"}</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium text-center">{isMobile ? "HT" : "Gol HT"}</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium text-center">{isMobile ? "O1.5" : "Over 1.5"}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="bg-[#1a1f2d]">
                        {loading ? (
                            <TableRow className="border-[#2a3142]">
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <div className="flex items-center justify-center text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                        Buscando alertas...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : alerts.length === 0 ? (
                            <TableRow className="border-[#2a3142]">
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    Nenhum alerta gerado hoje. O robô está monitorando...
                                </TableCell>
                            </TableRow>
                        ) : (
                            (() => {
                                // Simple visual deduplication: if multiple variations trigger at the same minute,
                                // we group them or visually distinct them.
                                const seenGames = new Set();

                                return alerts.map((a: any) => {
                                    const snap = a.stats_snapshot;
                                    const h = snap?.h || {};
                                    const aTeam = snap?.a || {};
                                    const current = liveStats[String(a.fixture_id)];

                                    const gameKey = `${a.fixture_id}_${a.minute_at_alert}`;
                                    const isDuplicate = seenGames.has(gameKey);
                                    seenGames.add(gameKey);

                                    // Calculate if a goal happened after the alert
                                    const alertTotalGoals = (h.goals || 0) + (aTeam.goals || 0);
                                    const currentTotalGoals = current ? (current.goalsHome + current.goalsAway) : 0;
                                    const finalTotalGoals = a.final_score ? a.final_score.split('x').reduce((sum: number, val: string) => sum + parseInt(val), 0) : 0;

                                    const hasGoalHappened =
                                        a.goal_ht_result === 'green' ||
                                        a.over15_result === 'green' ||
                                        (current && currentTotalGoals > alertTotalGoals) ||
                                        (a.final_score && finalTotalGoals > alertTotalGoals);

                                    return (
                                        <TableRow
                                            key={a.id}
                                            className={cn(
                                                "border-[#2a3142] hover:bg-[#1e2333]/50 transition-colors",
                                                isDuplicate && "opacity-50",
                                                hasGoalHappened && "goal-highlight"
                                            )}
                                        >
                                            <TableCell className={cn("text-zinc-400 text-[10px]", !isMobile && "text-sm")}>
                                                {format(new Date(a.created_at), isMobile ? 'dd/MM HH:mm' : 'dd/MM/yyyy HH:mm')}
                                            </TableCell>
                                            <TableCell className="font-medium text-white">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className={cn("block truncate max-w-[150px]", isMobile ? "text-xs" : "text-sm")}>
                                                        {a.home_team} vs {a.away_team}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-zinc-500 font-normal truncate max-w-[100px]">{a.league_name}</span>
                                                        {current && (
                                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 py-0 text-[8px] h-3 px-1">
                                                                Live
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {isMobile && (
                                                        <span className="text-[9px] text-emerald-400 flex items-center">
                                                            <Target className="w-2 h-2 mr-1" />
                                                            {a.variation_name || a.robot_variations?.name || 'Var.'}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            {!isMobile && (
                                                <TableCell className="text-emerald-400">
                                                    <div className="flex items-center flex-wrap gap-1">
                                                        <Target className="w-3 h-3 mr-1" />
                                                        {a.variation_name || a.robot_variations?.name || 'Variação Excluída'}
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell className="text-center font-mono text-sm text-zinc-300">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="flex flex-col items-center opacity-40 grayscale scale-90" title="No momento do alerta">
                                                        <span className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5">Alertado</span>
                                                        <div className="flex items-center justify-center gap-3">
                                                            <span className="flex items-center text-blue-400"><Clock className="w-3 h-3 mr-1" /> {a.minute_at_alert}'</span>
                                                            <span className="text-amber-400 font-bold">{h.goals || 0}x{aTeam.goals || 0}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 text-[9px] text-zinc-400 font-normal">
                                                            <span>Volume (xG): {h.xg || 0}-{aTeam.xg || 0}</span>
                                                            <span>Chutes na Área: {h.shotsInBox || 0}-{aTeam.shotsInBox || 0}</span>
                                                            <span>Escanteios: {h.corners || 0}-{aTeam.corners || 0}</span>
                                                        </div>
                                                    </div>
                                                    {current ? (
                                                        <div className="flex flex-col items-center border-t border-white/5 pt-1 w-full">
                                                            <span className="text-[10px] uppercase font-bold text-emerald-500 mb-0.5 animate-pulse">Ao Vivo</span>
                                                            <div className="flex items-center justify-center gap-3">
                                                                <span className="flex items-center text-emerald-400"><Clock className="w-3 h-3 mr-1" /> {current.minute}'</span>
                                                                <span className="text-white font-bold">{current.goalsHome}x{current.goalsAway}</span>
                                                            </div>
                                                        </div>
                                                    ) : a.final_score ? (
                                                        <div className="flex flex-col items-center border-t border-white/5 pt-1 w-full text-zinc-500">
                                                            <span className="text-[10px] uppercase font-bold mb-0.5">Finalizado</span>
                                                            <div className="flex items-center justify-center gap-3">
                                                                <span>{a.final_score}</span>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {getResultBadge(a.goal_ht_result)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center justify-center gap-1">
                                                    {getResultBadge(a.over15_result)}
                                                    {a.final_score && <span className="text-xs text-zinc-500 font-mono">({a.final_score})</span>}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                });
                            })()
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
