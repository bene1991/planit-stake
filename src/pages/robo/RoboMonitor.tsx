import React from 'react';
import { useRoboMonitor, MonitoredFixture } from '@/hooks/useRoboMonitor';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    Activity,
    Clock,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    BarChart2,
    Zap,
    ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RoboMonitor() {
    const { monitoredFixtures, loading } = useRoboMonitor();

    if (loading && monitoredFixtures.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-emerald-500" />
                <p>Iniciando monitoramento em tempo real...</p>
            </div>
        );
    }

    if (monitoredFixtures.length === 0) {
        return (
            <Card className="border-[#2a3142] bg-[#1a1f2d]/50 border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <Activity className="w-12 h-12 text-zinc-700 mb-4" />
                    <h3 className="text-xl font-medium text-zinc-400">Nenhum jogo sendo monitorado agora</h3>
                    <p className="text-zinc-500 max-w-md mt-2">
                        O robô monitora jogos entre o minuto 15' e 30' do primeiro tempo.
                        Aguardando o próximo ciclo de execução...
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-medium text-white flex items-center">
                        <Activity className="w-5 h-5 mr-2 text-emerald-400 animate-pulse" />
                        Radar de Análise (Real-time)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Jogos sendo processados pela IA na janela de 10 minutos.
                    </p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3">
                    {monitoredFixtures.length} jogos ativos
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {monitoredFixtures.map((fixture) => (
                    <FixtureMonitorCard key={fixture.fixture_id} fixture={fixture} />
                ))}
            </div>
        </div>
    );
}

function FixtureMonitorCard({ fixture }: { fixture: MonitoredFixture }) {
    const stats = fixture.current_stats;
    const delta = fixture.delta_10;
    const lastExec = fixture.last_execution;

    const isSent = lastExec?.stage === 'ALERT_SENT';
    const isCooldown = lastExec?.stage === 'ALERT_COOLDOWN';
    const isDiscarded = lastExec?.stage === 'DISCARDED_PRE_FILTER';

    return (
        <Card className="border-[#2a3142] bg-[#1a1f2d] hover:border-[#3a4152] transition-all overflow-hidden relative group">
            {isSent && (
                <div className="absolute top-0 right-0 p-2">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Alertado
                    </Badge>
                </div>
            )}

            <CardContent className="p-5 space-y-4">
                {/* Header: Teams & Time */}
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white truncate max-w-[200px]">
                                {fixture.home_team || 'Time da Casa'} vs {fixture.away_team || 'Visitante'}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">#{fixture.fixture_id}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span className="flex items-center text-emerald-400 font-mono">
                                <Clock className="w-3 h-3 mr-1" /> {fixture.minute || '??'}'
                            </span>
                            <span>•</span>
                            <span className="truncate max-w-[150px]">{fixture.league_name || 'Liga desconhecida'}</span>
                        </div>
                    </div>
                    <div className="text-xl font-black text-white/20 font-mono group-hover:text-white/40 transition-colors">
                        {fixture.score || '0x0'}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 bg-black/20 p-3 rounded-lg border border-white/5">
                    <div className="space-y-2 border-r border-white/10 pr-2">
                        <div className="text-[10px] uppercase font-bold text-zinc-500 flex items-center justify-between">
                            <span>Posse</span>
                            <span className="text-zinc-300 font-mono">{stats?.h?.possession}% / {stats?.a?.possession}%</span>
                        </div>
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden flex">
                            <div
                                className="h-full bg-blue-500"
                                style={{ width: `${stats?.h?.possession || 50}%` }}
                            />
                            <div
                                className="h-full bg-orange-500"
                                style={{ width: `${stats?.a?.possession || 50}%` }}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 pl-2">
                        <div className="text-[10px] uppercase font-bold text-zinc-500 flex items-center justify-between">
                            <span>Ataques Perig.</span>
                            <span className="text-zinc-300 font-mono">{stats?.h?.attacks} / {stats?.a?.attacks}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500"
                                    style={{ width: `${Math.min(100, (stats?.h?.attacks || 0) * 2)}%` }}
                                />
                            </div>
                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500"
                                    style={{ width: `${Math.min(100, (stats?.a?.attacks || 0) * 2)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Window 10m Delta */}
                {delta && (
                    <div className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-emerald-400" />
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Janela 10 min</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono">
                            <div className="flex flex-col items-center">
                                <span className="text-zinc-500 text-[8px] uppercase">Ataques</span>
                                <span className="text-emerald-400">+{delta.h.attacks} / +{delta.a.attacks}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-zinc-500 text-[8px] uppercase">Chutes</span>
                                <span className="text-emerald-400">{delta.h.shots} / {delta.a.shots}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status / Reason */}
                <div className="pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500 flex items-center italic">
                            {lastExec ? (
                                <>
                                    <Activity className="w-3 h-3 mr-1 opacity-50" />
                                    Última varredura: {format(new Date(lastExec.time), 'HH:mm:ss')}
                                </>
                            ) : 'Aguardando primeira execução...'}
                        </span>

                        {lastExec && (
                            <Badge
                                variant="outline"
                                className={cn(
                                    "py-0 h-5 text-[9px]",
                                    isSent ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/5" :
                                        isCooldown ? "text-amber-400 border-amber-400/20 bg-amber-400/5" :
                                            "text-zinc-400 border-zinc-400/20 bg-zinc-400/5"
                                )}
                            >
                                {lastExec.reason}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
