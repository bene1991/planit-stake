import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyPlus, ShieldX, BarChart3, ListFilter, Settings2, Activity, Zap, TrendingUp, Calendar, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from 'framer-motion';
import RoboVariations from './robo/RoboVariations';
import RoboBlockedLeagues from './robo/RoboBlockedLeagues';
import RoboAlerts from './robo/RoboAlerts';
import RoboPerformance from './robo/RoboPerformance';
import RoboLogs from './robo/RoboLogs';
import RoboReports from './robo/RoboReports';
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subDays, startOfMonth, startOfToday, isAfter, parseISO } from "date-fns";

export default function RoboAoVivo() {
    const [activeTab, setActiveTab] = useState("alerts");
    const [period, setPeriod] = useState("today");
    const [todayStats, setTodayStats] = useState({ total: 0, greens: 0, profit: 0 });
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    useEffect(() => {
        fetchTerminalStats();
    }, [period]);

    const fetchTerminalStats = async () => {
        setIsLoadingStats(true);
        try {
            // 1. Fetch active robot variations first
            const { data: activeRobots } = await supabase
                .from('robot_variations')
                .select('id')
                .eq('active', true);

            const activeRobotIds = activeRobots?.map(r => r.id) || [];

            if (activeRobotIds.length === 0) {
                setTodayStats({ total: 0, greens: 0, profit: 0 });
                return;
            }

            // 2. Build date filter
            let dateThreshold = startOfToday();
            if (period === 'yesterday') dateThreshold = subDays(startOfToday(), 1);
            else if (period === '7d') dateThreshold = subDays(startOfToday(), 7);
            else if (period === '30d') dateThreshold = subDays(startOfToday(), 30);
            else if (period === 'month') dateThreshold = startOfMonth(new Date());

            let query = supabase
                .from('live_alerts')
                .select('goal_ht_result, over15_result, custom_odd_ht, custom_odd_o15, is_discarded, is_ht_discarded, is_o15_discarded, variation_id, created_at')
                .in('variation_id', activeRobotIds);

            if (period !== 'all') {
                if (period === 'yesterday') {
                    const yesterdayEnd = startOfToday();
                    query = query.gte('created_at', dateThreshold.toISOString()).lt('created_at', yesterdayEnd.toISOString());
                } else {
                    query = query.gte('created_at', dateThreshold.toISOString());
                }
            }

            const { data } = await query;

            if (data) {
                let total = 0;
                let greens = 0;
                let profit = 0;

                data.forEach(a => {
                    let gameUsedAtLeastOnce = false;

                    // HT Metric
                    if (!a.is_ht_discarded && (a.goal_ht_result === 'green' || a.goal_ht_result === 'red')) {
                        total++;
                        gameUsedAtLeastOnce = true;
                        if (a.goal_ht_result === 'green') {
                            greens++;
                            profit += 0.7;
                        } else {
                            profit -= 1;
                        }
                    }

                    // O1.5 Metric
                    if (!a.is_o15_discarded && (a.over15_result === 'green' || a.over15_result === 'red')) {
                        total++;
                        gameUsedAtLeastOnce = true;
                        if (a.over15_result === 'green') {
                            greens++;
                            profit += 0.6;
                        } else {
                            profit -= 1;
                        }
                    }
                });

                setTodayStats({ total, greens, profit });
            }
        } finally {
            setIsLoadingStats(false);
        }
    };

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 min-h-screen selection:bg-emerald-500/30">
            {/* HUD Cockpit Header */}
            <div className="relative overflow-hidden rounded-3xl bg-zinc-900/20 border border-zinc-800/50 p-6 backdrop-blur-xl">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-emerald-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-blue-500/5 blur-[100px] pointer-events-none" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-2">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3"
                        >
                            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                <Activity className="w-6 h-6 text-emerald-500 animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black tracking-tighter text-white uppercase leading-none">
                                    Terminal <span className="text-emerald-500">Robô</span>
                                </h2>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                    Motor de Análise Ativo • 24/7
                                </p>
                            </div>
                        </motion.div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap items-center gap-4"
                    >
                        {/* Period Selector */}
                        <div className="flex items-center gap-2 bg-zinc-950/80 p-1.5 rounded-2xl border border-zinc-800/50 backdrop-blur-md">
                            <Select value={period} onValueChange={setPeriod}>
                                <SelectTrigger className="w-[140px] h-9 bg-zinc-900 border-zinc-800 text-xs font-bold uppercase tracking-tighter ring-0 focus:ring-0">
                                    <Calendar className="w-3.5 h-3.5 mr-2 text-primary" />
                                    <SelectValue placeholder="Período" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                    <SelectItem value="today" className="text-xs uppercase font-bold tracking-tighter">Hoje</SelectItem>
                                    <SelectItem value="yesterday" className="text-xs uppercase font-bold tracking-tighter">Ontem</SelectItem>
                                    <SelectItem value="7d" className="text-xs uppercase font-bold tracking-tighter">Últimos 7 dias</SelectItem>
                                    <SelectItem value="30d" className="text-xs uppercase font-bold tracking-tighter">Últimos 30 dias</SelectItem>
                                    <SelectItem value="month" className="text-xs uppercase font-bold tracking-tighter">Este Mês</SelectItem>
                                    <SelectItem value="all" className="text-xs uppercase font-bold tracking-tighter">Todo Período</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex bg-zinc-950/80 p-1.5 rounded-2xl border border-zinc-800/50 backdrop-blur-md relative overflow-hidden">
                            {isLoadingStats && (
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-10">
                                    <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                                </div>
                            )}
                            <div className="px-5 py-3 border-r border-zinc-800/50 text-center">
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Entradas</p>
                                <p className="text-2xl font-black text-white font-mono leading-none">{todayStats.total}</p>
                            </div>
                            <div className="px-5 py-3 border-r border-zinc-800/50 text-center">
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Winrate</p>
                                <p className="text-2xl font-black text-emerald-500 font-mono leading-none">
                                    {todayStats.total > 0 ? Math.round((todayStats.greens / todayStats.total) * 100) : 0}%
                                </p>
                            </div>
                            <div className="px-5 py-3 text-center">
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Profit Líquido</p>
                                <div className="flex items-center justify-center gap-1.5">
                                    <p className={cn("text-2xl font-black font-mono leading-none", todayStats.profit >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                        {todayStats.profit >= 0 ? '+' : ''}{todayStats.profit.toFixed(2)}
                                    </p>
                                    <span className="text-[10px] font-bold text-zinc-600 uppercase">u</span>
                                </div>
                            </div>
                        </div>

                        <div className="hidden sm:flex flex-col gap-2">
                            <Badge variant="outline" className="bg-emerald-500/5 text-emerald-400 border-emerald-500/10 h-7 px-3 font-bold uppercase tracking-tighter shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                <Zap className="w-3.5 h-3.5 mr-1.5 fill-emerald-500" /> Latência: 45ms
                            </Badge>
                            <Badge variant="outline" className="bg-blue-500/5 text-blue-400 border-blue-500/10 h-7 px-3 font-bold uppercase tracking-tighter">
                                <Activity className="w-3.5 h-3.5 mr-1.5" /> Estabilidade: 99.9%
                            </Badge>
                        </div>
                    </motion.div>
                </div>
            </div>

            <Tabs defaultValue="alerts" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                <div className="relative sticky top-0 z-30 py-2 bg-[#020203]/80 backdrop-blur-md">
                    <TabsList className="bg-zinc-900/40 border border-zinc-800/80 p-1.5 h-14 rounded-2xl w-full lg:w-auto overflow-x-auto justify-start lg:justify-center">
                        {[
                            { id: 'alerts', icon: Zap, label: 'Radar Ao Vivo', color: 'text-amber-500' },
                            { id: 'performance', icon: TrendingUp, label: 'Performance', color: 'text-emerald-500' },
                            { id: 'reports', icon: BarChart3, label: 'Deep Intelligence', color: 'text-blue-500' },
                            { id: 'settings', icon: Settings2, label: 'Engine Setup', color: 'text-zinc-400' }
                        ].map((t) => (
                            <TabsTrigger
                                key={t.id}
                                value={t.id}
                                className={cn(
                                    "flex-1 lg:flex-none font-black uppercase tracking-tighter text-xs px-8 h-full rounded-xl transition-all duration-300",
                                    "data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:ring-1 data-[state=active]:ring-zinc-700",
                                    "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <t.icon className={cn("w-4 h-4 mr-2", activeTab === t.id ? t.color : "text-current")} />
                                {t.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="outline-none focus:outline-none"
                    >
                        <TabsContent value="alerts" className="mt-0 focus:outline-none border-none">
                            <RoboAlerts />
                        </TabsContent>

                        <TabsContent value="performance" className="mt-0 focus:outline-none border-none">
                            <RoboPerformance />
                        </TabsContent>

                        <TabsContent value="reports" className="mt-0 focus:outline-none border-none">
                            <RoboReports />
                        </TabsContent>

                        <TabsContent value="settings" className="mt-0 focus:outline-none border-none">
                            <div className="space-y-12 pb-20">
                                <section>
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <CopyPlus className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Estratégias de Gatilho</h3>
                                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Algoritmos de detecção de pressão</p>
                                            </div>
                                        </div>
                                    </div>
                                    <RoboVariations />
                                </section>

                                <div className="space-y-12 pt-10 border-t border-zinc-800/50">
                                    <section className="bg-zinc-900/20 p-8 rounded-[2rem] border border-zinc-800/40 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl pointer-events-none" />
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                                                <ShieldX className="w-6 h-6 text-rose-500" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-white tracking-tighter uppercase">Filtro de Ligas Block (Global)</h3>
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Gestão central de ligas ignoradas por todos os robôs</p>
                                            </div>
                                        </div>
                                        <RoboBlockedLeagues />
                                    </section>

                                    <section className="bg-zinc-900/20 p-8 rounded-[2rem] border border-zinc-800/40 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl pointer-events-none" />
                                        <div className="flex items-center gap-4 mb-8 text-left">
                                            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)] text-left">
                                                <ListFilter className="w-6 h-6 text-blue-500" />
                                            </div>
                                            <div className="text-left">
                                                <h3 className="text-xl font-black text-white tracking-tighter uppercase">Logs de Execução (Engine)</h3>
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Diagnóstico técnico das avaliações em tempo real</p>
                                            </div>
                                        </div>
                                        <RoboLogs />
                                    </section>
                                </div>
                            </div>
                        </TabsContent>
                    </motion.div>
                </AnimatePresence>
            </Tabs>
        </div>
    );
}
