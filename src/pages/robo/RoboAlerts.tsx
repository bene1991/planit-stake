import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, BellRing, Activity } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { LiveRadarCard } from "@/components/robo/LiveRadarCard";

type LiveAlert = any & {
    robot_variations?: { name: string }
};

interface GroupedAlert {
    fixture_id: string;
    league_name: string;
    home_team: string;
    away_team: string;
    created_at: string;
    final_score?: string;
    stats_snapshot: any;
    triggers: {
        id: string;
        name: string;
        minute: number;
        result_ht?: string;
        result_o15?: string;
        totalProfit: number;
    }[];
    totalGreens: number;
    totalReds: number;
    totalProfit: number;
}

export default function RoboAlerts() {
    const isMobile = useIsMobile();
    const [alerts, setAlerts] = useState<LiveAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [liveStats, setLiveStats] = useState<Record<string, any>>({});

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

    const alertsRef = React.useRef(alerts);
    useEffect(() => {
        alertsRef.current = alerts;
    }, [alerts]);

    useEffect(() => {
        fetchAlerts();

        const interval = setInterval(() => {
            const currentAlerts = alertsRef.current;
            if (currentAlerts.length > 0) {
                const uniqueIds = [...new Set(currentAlerts.map(a => String(a.fixture_id)))];
                updateLiveStats(uniqueIds, currentAlerts);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const channel = supabase
            .channel('public:live_alerts_changes_radar')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'live_alerts'
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newAlert = payload.new as LiveAlert;
                        setAlerts(prev => {
                            if (prev.some(a => a.id === newAlert.id)) return prev;
                            return [newAlert, ...prev].slice(0, 200);
                        });
                        playAlertSound();
                        toast.info(`Novo Alerta: ${newAlert.home_team} vs ${newAlert.away_team}`, {
                            description: `Filtro: ${newAlert.variation_name || 'Variação'}`,
                            icon: '🚨'
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as LiveAlert;
                        const old = payload.old as LiveAlert;

                        setAlerts(prev => {
                            const isFT = updated.final_score && updated.final_score !== 'pending' && updated.final_score !== '';

                            // If initialized or discarded or both markets resolved or match is FT/Finished
                            if (updated.is_discarded || (updated.goal_ht_result !== 'pending' && updated.over15_result !== 'pending') || isFT) {
                                return prev.filter(a => a.id !== updated.id);
                            }
                            // Otherwise update it in the list
                            return prev.map(a => a.id === updated.id ? updated : a);
                        });

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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const updateLiveStats = async (fixtureIds: string[], currentAlerts: LiveAlert[]) => {
        if (fixtureIds.length === 0) return;
        try {
            const statsMap: Record<string, any> = {};

            // API Football often has limits on how many IDs can be queried at once
            // We'll chunk them in groups of 20
            const chunks = [];
            for (let i = 0; i < fixtureIds.length; i += 20) {
                chunks.push(fixtureIds.slice(i, i + 20));
            }

            for (const chunk of chunks) {
                const idsParam = chunk.join('-');
                const { data, error } = await supabase.functions.invoke('api-football', {
                    body: { endpoint: `fixtures?id=${idsParam}` }
                });

                if (!error && data?.response) {
                    data.response.forEach((f: any) => {
                        const fId = String(f.fixture.id);
                        statsMap[fId] = {
                            goalsHome: f.goals.home ?? 0,
                            goalsAway: f.goals.away ?? 0,
                            minute: f.fixture.status.elapsed ?? 0,
                            status: f.fixture.status.short || 'NS'
                        };
                    });
                }
            }

            // For fixtures not returned by API or if API failed, check DB final_score
            for (const fId of fixtureIds) {
                if (!statsMap[fId]) {
                    const alert = currentAlerts.find(a => String(a.fixture_id) === fId);
                    if (alert?.final_score) {
                        const parts = alert.final_score.split('x');
                        statsMap[fId] = {
                            goalsHome: parseInt(parts[0]) || 0,
                            goalsAway: parseInt(parts[1]) || 0,
                            minute: 90,
                            status: 'FT'
                        };
                    }
                }
            }

            setLiveStats(prev => ({ ...prev, ...statsMap }));
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
                .limit(200);

            if (error) throw error;

            const activeAlerts = (data || []).filter(a => {
                const isFT = a.final_score && a.final_score !== 'pending' && a.final_score !== '';
                return !a.is_discarded && (a.goal_ht_result === 'pending' || a.over15_result === 'pending') && !isFT;
            });

            setAlerts(activeAlerts);

            if (activeAlerts.length > 0) {
                const uniqueIds = [...new Set(activeAlerts.map(a => String(a.fixture_id)))] as string[];
                updateLiveStats(uniqueIds, activeAlerts);
            }
        } catch (error: any) {
            toast.error('Erro ao buscar alertas', { description: error.message });
        } finally {
            if (loading) setLoading(false);
        }
    };

    // Group alerts by fixture_id
    const groupedAlerts = alerts.reduce((acc: Record<string, GroupedAlert>, alert) => {
        const fixtureId = String(alert.fixture_id);

        if (!acc[fixtureId]) {
            acc[fixtureId] = {
                fixture_id: fixtureId,
                league_name: alert.league_name,
                home_team: alert.home_team,
                away_team: alert.away_team,
                created_at: alert.created_at,
                final_score: alert.final_score,
                stats_snapshot: alert.stats_snapshot,
                triggers: [],
                totalGreens: 0,
                totalReds: 0,
                totalProfit: 0
            };
        }

        const htProfit = alert.goal_ht_result === 'green' ? 0.7 : (alert.goal_ht_result === 'red' ? -1 : 0);
        const o15Profit = alert.over15_result === 'green' ? 0.6 : (alert.over15_result === 'red' ? -1 : 0);
        const totalAlertProfit = htProfit + o15Profit;

        const trigger = {
            id: alert.id,
            name: alert.variation_name || alert.robot_variations?.name || 'Estratégia',
            minute: alert.minute_at_alert,
            result_ht: alert.goal_ht_result,
            result_o15: alert.over15_result,
            totalProfit: totalAlertProfit
        };

        acc[fixtureId].triggers.push(trigger);

        // Profit & Result calculation
        if (alert.goal_ht_result === 'green') {
            acc[fixtureId].totalGreens++;
        } else if (alert.goal_ht_result === 'red') {
            acc[fixtureId].totalReds++;
        }

        if (alert.over15_result === 'green') {
            acc[fixtureId].totalGreens++;
        } else if (alert.over15_result === 'red') {
            acc[fixtureId].totalReds++;
        }

        acc[fixtureId].totalProfit += totalAlertProfit;

        return acc;
    }, {});

    const sortedGroups = Object.values(groupedAlerts).sort((a, b) => {
        const groupA = a as GroupedAlert;
        const groupB = b as GroupedAlert;
        return new Date(groupB.created_at).getTime() - new Date(groupA.created_at).getTime();
    });

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-2xl font-black text-white flex items-center tracking-tighter uppercase group cursor-default">
                        <div className="p-2 bg-emerald-500/10 rounded-lg mr-3 group-hover:bg-emerald-500/20 transition-colors">
                            <BellRing className="w-6 h-6 text-emerald-500" />
                        </div>
                        Radar de Alertas
                        <span className="ml-4 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-500 font-mono text-center min-w-[80px]">
                            {sortedGroups.length} JOGOS
                        </span>
                    </h3>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 bg-zinc-900/10 rounded-[2rem] border border-dashed border-zinc-800/50 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-6" />
                    <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-[10px]">Sincronizando Satélites...</p>
                </div>
            ) : sortedGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-zinc-900/10 rounded-[2rem] border border-dashed border-zinc-800/50 grayscale opacity-50 backdrop-blur-sm">
                    <Activity className="w-12 h-12 text-zinc-700 mb-6" />
                    <p className="text-zinc-600 font-black uppercase tracking-[0.3em] text-[10px]">Silêncio no Radar... Aguardando Gatilhos.</p>
                </div>
            ) : (
                <motion.div
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8"
                >
                    <AnimatePresence mode="popLayout">
                        {sortedGroups.map((group: GroupedAlert) => {
                            const current = liveStats[group.fixture_id];
                            const snap = group.stats_snapshot;
                            // Priority: live API data > DB final_score > stats_snapshot
                            const hGoals = current?.goalsHome ?? (group.final_score ? parseInt(group.final_score.split('x')[0]) : snap?.h?.goals ?? 0);
                            const aGoals = current?.goalsAway ?? (group.final_score ? parseInt(group.final_score.split('x')[1]) : snap?.a?.goals ?? 0);
                            // Determine match status from live data or from resolved results
                            const allResolved = group.triggers.every(t => t.result_ht !== 'pending' && t.result_o15 !== 'pending');
                            const matchStatus = current?.status || (allResolved ? 'FT' : 'NS');
                            const matchMinute = current?.minute || (matchStatus === 'FT' ? 90 : 0);

                            return (
                                <LiveRadarCard
                                    key={group.fixture_id}
                                    fixtureId={group.fixture_id}
                                    leagueName={group.league_name}
                                    homeTeam={group.home_team}
                                    awayTeam={group.away_team}
                                    scoreHome={parseInt(String(hGoals)) || 0}
                                    scoreAway={parseInt(String(aGoals)) || 0}
                                    currentMinute={matchMinute}
                                    status={matchStatus}
                                    triggers={group.triggers}
                                    totalGreens={group.totalGreens}
                                    totalReds={group.totalReds}
                                    totalProfit={group.totalProfit}
                                    createdAt={group.created_at}
                                />
                            );
                        })}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
}
