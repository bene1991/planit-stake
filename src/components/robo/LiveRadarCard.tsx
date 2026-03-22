import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Clock, Trophy, MapPin, Activity, Zap, Target, DollarSign, Globe } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GoalEvent {
    minute: number;
    team: string;
    player: string;
    type: string;
    extra?: number;
}

interface VariationTrigger {
    id: string;
    name: string;
    minute: number;
    result_ht?: string;
    result_o15?: string;
    totalProfit: number;
}

interface LiveRadarCardProps {
    fixtureId: string;
    leagueName: string;
    homeTeam: string;
    awayTeam: string;
    scoreHome: number;
    scoreAway: number;
    currentMinute: number;
    status: string;
    triggers: VariationTrigger[];
    totalGreens: number;
    totalReds: number;
    totalProfit: number;
    createdAt: string;
    goalEvents?: GoalEvent[];
}

export const LiveRadarCard: React.FC<LiveRadarCardProps> = ({
    fixtureId,
    leagueName,
    homeTeam,
    awayTeam,
    scoreHome,
    scoreAway,
    currentMinute,
    status,
    triggers,
    totalGreens,
    totalReds,
    totalProfit,
    createdAt,
    goalEvents = []
}) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -5 }}
            className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/40 backdrop-blur-xl transition-all duration-500 hover:border-primary/30 hover:bg-zinc-900/60 shadow-2xl"
        >
            {/* Match Header */}
            <div className="p-6 border-b border-white/5 bg-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -z-10" />
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                            <Globe className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-[11px] font-black text-white/60 uppercase tracking-widest truncate max-w-[180px]">
                            {leagueName}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 shadow-inner">
                            <Activity className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[11px] font-black text-primary font-mono uppercase">
                                {status === 'FT' ? 'Fim' : status === 'HT' ? 'Intervalo' : `${currentMinute}'`}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/10 shadow-inner">
                            <Clock className="w-3.5 h-3.5 text-primary/80" />
                            <span className="text-[11px] font-bold text-zinc-300 font-mono">
                                {format(parseISO(createdAt), 'HH:mm')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/5">
                        <span className="text-sm font-black text-white uppercase tracking-tight truncate flex-1">{homeTeam}</span>
                        <span className="text-lg font-black text-primary ml-4 italic tabular-nums leading-none">
                            {scoreHome}
                        </span>
                    </div>
                    <div className="flex justify-between items-center bg-white/[0.02] p-2 rounded-xl border border-white/5">
                        <span className="text-sm font-black text-white/70 uppercase tracking-tight truncate flex-1">{awayTeam}</span>
                        <span className="text-lg font-black text-primary/70 ml-4 italic tabular-nums leading-none">
                            {scoreAway}
                        </span>
                    </div>
                </div>
            </div>

            {/* Match Goals Section */}
            {goalEvents && goalEvents.length > 0 && (
                <div className="px-6 pb-4">
                    <div className="flex items-center justify-between mb-3 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                        GOLS DA PARTIDA
                        <div className="h-px flex-1 bg-white/10 ml-4" />
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                        {goalEvents.sort((a: any, b: any) => a.minute - b.minute).map((goal: any, idx: number) => {
                            const isHome = goal.team === homeTeam;
                            return (
                                <div key={idx} className={cn(
                                    "flex items-center gap-2 group/goal",
                                    isHome ? "flex-row" : "flex-row-reverse"
                                )}>
                                    <div className={cn(
                                        "flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
                                        isHome ? "bg-emerald-500/5 text-emerald-400" : "bg-zinc-500/5 text-zinc-400"
                                    )}>
                                        <span className="font-mono text-[9px] font-black opacity-50">
                                            {goal.minute}{goal.extra ? `+${goal.extra}` : ""}'
                                        </span>
                                        <div className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                                        <span className="text-[10px] font-bold truncate max-w-[120px]">
                                            {goal.player || "GOL"}
                                        </span>
                                    </div>
                                    <div className="flex-1" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Triggered Strategies */}
            <div className="p-6 space-y-5">
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">ROBÔS DISPARADOS ({triggers.length})</p>
                        <div className="h-px flex-1 bg-white/10 ml-4" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {triggers.map((alert) => (
                            <Badge
                                key={alert.id}
                                variant="outline"
                                className={cn(
                                    "text-[9px] font-black uppercase tracking-tighter py-1 px-2.5 border-white/10 shadow-sm transition-all group-hover:border-white/20",
                                    alert.totalProfit > 0 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                                        alert.totalProfit < 0 ? "bg-rose-500/20 text-rose-400 border-rose-500/30" : "bg-white/5 text-zinc-400"
                                )}
                            >
                                <Zap className="w-2.5 h-2.5 mr-1 text-inherit" />
                                {alert.name} <span className="ml-1 opacity-50">({alert.minute}')</span>
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Result Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="group/stat p-4 rounded-2xl bg-black/40 border border-white/5 transition-all hover:bg-emerald-500/5 hover:border-emerald-500/20">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[8px] font-black text-emerald-500/60 uppercase tracking-widest">GREEN</p>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <p className="text-2xl font-black text-emerald-500 tabular-nums leading-none">
                            {totalGreens}
                        </p>
                    </div>
                    <div className="group/stat p-4 rounded-2xl bg-black/40 border border-white/5 transition-all hover:bg-rose-500/5 hover:border-rose-500/20">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[8px] font-black text-rose-500/60 uppercase tracking-widest">RED</p>
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        </div>
                        <p className="text-2xl font-black text-rose-500 tabular-nums leading-none">
                            {totalReds}
                        </p>
                    </div>
                </div>
            </div>

            {/* Card Footer: Match Profit */}
            <div className={cn(
                "p-6 flex justify-between items-center border-t border-white/10 shadow-inner relative overflow-hidden",
                totalProfit > 0 ? "bg-emerald-500/10" : totalProfit < 0 ? "bg-rose-500/10" : "bg-white/5"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-xl shadow-lg",
                        totalProfit >= 0 ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"
                    )}>
                        <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">BALANÇO TOTAL</p>
                        <p className="text-[10px] font-bold text-zinc-400">Lucro do Evento</p>
                    </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                    <span className={cn(
                        "text-3xl font-black italic tracking-tighter tabular-nums drop-shadow-[0_0_15px_rgba(var(--profit-rgb),0.5)]",
                        totalProfit >= 0 ? "text-emerald-400 [--profit-rgb:16,185,129]" : "text-rose-400 [--profit-rgb:239,68,68]"
                    )}>
                        {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}
                    </span>
                    <span className="text-xs font-black text-zinc-600 tracking-tighter uppercase">uni</span>
                </div>
            </div>

            {/* Link decoration */}
            <div className={cn(
                "absolute bottom-0 left-0 right-0 h-1",
                totalProfit >= 0 ? "bg-emerald-500" : "bg-rose-500"
            )} />
        </motion.div>
    );
};
