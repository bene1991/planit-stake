import React from 'react';
import { DominanceResult } from '@/hooks/useDominanceAnalysis';
import { LdiSnapshot } from '@/hooks/useLdiHistory';
import { NormalizedStats } from '@/hooks/useFixtureCache';
import { cn } from '@/lib/utils';
import { Shield, Target, Flag, CircleAlert, PieChart } from 'lucide-react';
import { MomentumPoint } from '@/hooks/useFixtureCache';

interface LiveMatchGraphicsProps {
    dominance: DominanceResult;
    ldiHistory: LdiSnapshot[];
    momentumSeries?: MomentumPoint[];
    stats?: NormalizedStats;
    homeTeam: string;
    awayTeam: string;
    homeRedCards?: number;
    awayRedCards?: number;
}

export const LiveMatchGraphics = ({
    dominance,
    ldiHistory,
    momentumSeries,
    stats,
    homeTeam,
    awayTeam,
    homeRedCards = 0,
    awayRedCards = 0
}: LiveMatchGraphicsProps) => {
    const { dominanceIndex, homeLdi, awayLdi } = dominance;

    // Pressure Chart Points (SVG)
    const renderPressureChart = () => {
        // Convert momentumSeries to snapshots if history is too short
        let effectiveHistory = [...ldiHistory];

        if (effectiveHistory.length < 2 && momentumSeries && momentumSeries.length >= 2) {
            // Convert MomentumPoint { m: number, home: number, away: number } 
            // to LdiSnapshot { minute: number, ldi: number }
            effectiveHistory = momentumSeries.map(p => {
                // Calculate LDI similar to useDominanceAnalysis: 
                // homeSum / (homeSum + awaySum) * 100
                // For momentum points, we can use (home - away) or a ratio.
                // The backend momentum points are already "weights".
                const total = p.home + p.away;
                const score = total > 0 ? (p.home / total) * 100 : 50;
                return { minute: p.m, ldi: score };
            });
        }

        if (effectiveHistory.length < 2) {
            return (
                <div className="h-32 flex items-center justify-center border border-dashed border-white/5 rounded-lg bg-black/20">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-40 text-center px-4">Aguardando dados de pressão suficientes...</span>
                </div>
            );
        }

        const width = 400;
        const height = 120;
        const padding = 10;
        const chartW = width - padding * 2;
        const chartH = height - padding * 2;

        const minutes = effectiveHistory.map(h => h.minute);
        const minMin = Math.min(...minutes);
        const maxMin = Math.max(...minutes);
        const range = Math.max(maxMin - minMin, 1);

        const getX = (m: number) => padding + ((m - minMin) / range) * chartW;
        const getY = (v: number) => padding + ((100 - v) / 100) * chartH;

        const baselineY = getY(50);

        // Helper to generate smoothed Bezier path
        const getBezierPath = (pts: { x: number, y: number }[]) => {
            if (pts.length < 2) return "";
            let d = `M ${pts[0].x},${pts[0].y}`;
            for (let i = 0; i < pts.length - 1; i++) {
                const curr = pts[i];
                const next = pts[i + 1];
                const c1x = curr.x + (next.x - curr.x) / 2.5;
                const c2x = curr.x + (next.x - curr.x) / 1.5;
                d += ` C ${c1x},${curr.y} ${c2x},${next.y} ${next.x},${next.y}`;
            }
            return d;
        };

        const chartPts = effectiveHistory.map(d => ({ x: getX(d.minute), y: getY(d.ldi) }));
        const pointsStr = getBezierPath(chartPts);

        // Fill areas (closed paths)
        const homeAreaPath = pointsStr + ` L ${getX(maxMin)},${baselineY} L ${getX(minMin)},${baselineY} Z`;
        const awayAreaPath = pointsStr + ` L ${getX(maxMin)},${baselineY} L ${getX(minMin)},${baselineY} Z`;
        // Actually for separate shading we need to clip or create separate segments. 
        // For simplicity and "wow" factor, we'll use gradients that only show above/below baseline via CSS clip or mask, 
        // but a simpler way is just two separate poly-areas for the fill.

        const homeAreaPoints = `${getX(minMin)},${baselineY} ` +
            effectiveHistory.map(d => `${getX(d.minute)},${Math.min(getY(d.ldi), baselineY)}`).join(' ') +
            ` ${getX(maxMin)},${baselineY}`;

        const awayAreaPoints = `${getX(minMin)},${baselineY} ` +
            effectiveHistory.map(d => `${getX(d.minute)},${Math.max(getY(d.ldi), baselineY)}`).join(' ') +
            ` ${getX(maxMin)},${baselineY}`;

        return (
            <div className="relative w-full h-32 mt-4 bg-[#0a0f16] rounded-xl border border-white/5 overflow-hidden shadow-inner group">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full preserve-3d">
                    <defs>
                        <linearGradient id="homeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="awayGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
                        </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <line x1={padding} y1={getY(25)} x2={width - padding} y2={getY(25)} stroke="white" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.05" />
                    <line x1={padding} y1={getY(75)} x2={width - padding} y2={getY(75)} stroke="white" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.05" />

                    {/* Central Baseline */}
                    <line x1={padding} y1={baselineY} x2={width - padding} y2={baselineY} stroke="white" strokeWidth="1.5" opacity="0.3" />

                    {/* Shaded Areas with Clipping/Masking for exact Bezier matching */}
                    <defs>
                        <clipPath id="clipHome">
                            <rect x="0" y="0" width={width} height={baselineY} />
                        </clipPath>
                        <clipPath id="clipAway">
                            <rect x="0" y={baselineY} width={width} height={height - baselineY} />
                        </clipPath>
                    </defs>

                    <path
                        d={`${pointsStr} L ${getX(maxMin)},${baselineY} L ${getX(minMin)},${baselineY} Z`}
                        fill="url(#homeGradient)"
                        clipPath="url(#clipHome)"
                    />
                    <path
                        d={`${pointsStr} L ${getX(maxMin)},${baselineY} L ${getX(minMin)},${baselineY} Z`}
                        fill="url(#awayGradient)"
                        clipPath="url(#clipAway)"
                    />

                    {/* Main Line */}
                    <path
                        d={pointsStr}
                        fill="none"
                        stroke="url(#lineGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] transition-all duration-700"
                    />

                    <defs>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="45%" stopColor="#10b981" />
                            <stop offset="50%" stopColor="#ffffff" />
                            <stop offset="55%" stopColor="#ef4444" />
                            <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                    </defs>

                    {/* Current position dot */}
                    <circle
                        cx={getX(maxMin)}
                        cy={getY(effectiveHistory[effectiveHistory.length - 1].ldi)}
                        r="3"
                        fill={effectiveHistory[effectiveHistory.length - 1].ldi >= 50 ? "#10b981" : "#ef4444"}
                        className="animate-pulse"
                    />
                </svg>

                {/* Legend/Labels */}
                <div className="absolute top-1/2 left-3 -translate-y-1/2 flex flex-col gap-1.5 opacity-40">
                    <div className="w-[1px] h-6 bg-gradient-to-b from-emerald-500 via-transparent to-red-500" />
                </div>

                <div className="absolute top-2 left-3 flex items-center gap-1.5 pointer-events-none">
                    <span className="text-[8px] font-bold uppercase text-emerald-500/60 tracking-widest">Ataque Casa</span>
                </div>
                <div className="absolute bottom-2 left-3 flex items-center gap-1.5 pointer-events-none">
                    <span className="text-[8px] font-bold uppercase text-red-500/60 tracking-widest">Ataque Fora</span>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-white/20 font-black uppercase tracking-[0.25em] pointer-events-none drop-shadow-[0_0_5px_rgba(255,255,255,0.05)]">
                    Equilíbrio
                </div>

                <div className="absolute top-1/2 right-3 -translate-y-1/2 text-[9px] text-white/40 font-mono bg-black/40 px-1 rounded border border-white/10">
                    {maxMin}'
                </div>
            </div>
        );
    };

    return (
        <div className="w-full space-y-3 py-1">
            {/* 1. Integrated Header with Percentages */}
            <div className="flex justify-between items-center px-1">
                <div className="flex flex-col">
                    <span className="text-[12px] font-bold truncate max-w-[140px] flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                        {homeTeam}
                    </span>
                    <span className="text-[10px] font-black text-emerald-500/80 uppercase tracking-tighter ml-3">
                        {homeLdi ?? 50}% Pressão
                    </span>
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-[12px] font-bold truncate max-w-[140px] flex items-center justify-end gap-1.5">
                        {awayTeam}
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                    </span>
                    <span className="text-[10px] font-black text-red-500/80 uppercase tracking-tighter mr-3">
                        {awayLdi ?? 50}% Pressão
                    </span>
                </div>
            </div>

            {/* 2. Momentum Graph */}
            {renderPressureChart()}

            {/* 3. Stats Boxes */}
            <div className="grid grid-cols-2 gap-3 mt-4">
                {/* Home Box */}
                <div className="bg-[#1a212c]/40 border border-white/5 rounded-xl p-3 space-y-3 relative overflow-hidden group hover:bg-[#1a212c]/60 transition-colors">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50" />
                    <div className="flex items-center justify-between text-emerald-500">
                        <Shield className="w-4 h-4 opacity-70" />
                        <span className="text-xs font-black uppercase tracking-widest">{stats?.home.possession ?? 0}%</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                            <span className="text-[18px] font-black leading-none">{stats?.home.shots_on ?? 0}</span>
                            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">No Alvo</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-[18px] font-black leading-none text-white/60">{stats?.home.shots_off ?? 0}</span>
                            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">Fora</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <Flag className="w-3 h-3 text-emerald-500/60" />
                            <span>{stats?.home.corners ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <CircleAlert className="w-3 h-3 text-red-500/60" />
                            <span>{homeRedCards}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <PieChart className="w-3 h-3 text-yellow-500/60" />
                            <span>{stats?.home.attacks_dangerous ?? 0}</span>
                        </div>
                    </div>
                </div>

                {/* Away Box */}
                <div className="bg-[#1a212c]/40 border border-white/5 rounded-xl p-3 space-y-3 relative overflow-hidden group hover:bg-[#1a212c]/60 transition-colors text-right">
                    <div className="absolute top-0 right-0 w-1 h-full bg-red-500/50" />
                    <div className="flex items-center justify-between text-red-500 flex-row-reverse">
                        <Shield className="w-4 h-4 opacity-70" />
                        <span className="text-xs font-black uppercase tracking-widest">{stats?.away.possession ?? 0}%</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col text-left">
                            <span className="text-[18px] font-black leading-none text-white/60">{stats?.away.shots_off ?? 0}</span>
                            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">Fora</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[18px] font-black leading-none">{stats?.away.shots_on ?? 0}</span>
                            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">No Alvo</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 flex-row-reverse">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <Flag className="w-3 h-3 text-red-500/60" />
                            <span>{stats?.away.corners ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <CircleAlert className="w-3 h-3 text-red-500/60" />
                            <span>{awayRedCards}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <PieChart className="w-3 h-3 text-yellow-500/60" />
                            <span>{stats?.away.attacks_dangerous ?? 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
