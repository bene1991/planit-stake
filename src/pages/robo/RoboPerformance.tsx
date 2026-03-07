import React, { useState, useEffect } from 'react';
import { useAIDiagnosticReport, type DiagnosticInput } from '@/hooks/useAIDiagnosticReport';
import { AIDiagnosticReport } from '@/components/AIDiagnosticReport';
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    BarChart3,
    TrendingUp,
    Target,
    ChevronDown,
    ChevronRight,
    Calendar,
    Clock,
    Globe,
    DollarSign,
    PlusCircle,
    Ban,
    TrendingDown,
    Pencil,
    Save,
    X,
    RotateCcw,
    Eye,
    EyeOff,
    ShieldX,
    ArrowUpDown,
    Brain,
    Trophy,
    Check,
    History,
    Settings2,
    Trash2,
    Edit2,
    Zap,
    Filter,
    LayoutGrid,
    Table as TableIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine
} from 'recharts';
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";

interface LeagueStat {
    league_name: string;
    league_id: string;
    total: number;
    ht_greens: number;
    ht_reds: number;
    o15_greens: number;
    o15_reds: number;
    ht_profit: number;
    o15_profit: number;
}

interface PerformanceRow {
    variation_id: string;
    variation_name: string;
    total_alerts: number;
    ht_total_stakes: number;
    ht_greens: number;
    ht_reds: number;
    ht_profit: number;
    ht_roi: number;
    o15_total_stakes: number;
    o15_greens: number;
    o15_reds: number;
    o15_profit: number;
    o15_roi: number;
    total_profit: number;
    active: boolean;
    games: any[];
    leagues: Record<string, LeagueStat>;
    min_minute?: number | null;
    max_minute?: number | null;
    min_expected_goals?: number | null;
    min_corners?: number | null;
    min_shots_insidebox?: number | null;
    min_shots_on_target?: number | null;
    min_combined_shots?: number | null;
    min_possession?: number | null;
    min_lambda_total?: number | null;
    min_over15_pre?: number | null;
}

const DEFAULT_ODD_HT = 1.7;
const DEFAULT_ODD_O15 = 1.6;
const STAKE = 100;

export default function RoboPerformance() {
    const isMobile = useIsMobile();
    const [stats, setStats] = useState<PerformanceRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
    const [editingAlert, setEditingAlert] = useState<any>(null);
    const [editHtOdd, setEditHtOdd] = useState<string>("");
    const [editO15Odd, setEditO15Odd] = useState<string>("");
    const [showDiscarded, setShowDiscarded] = useState(false);
    const [isRankingModalOpen, setIsRankingModalOpen] = useState(false);
    const [selectedVariationForRanking, setSelectedVariationForRanking] = useState<PerformanceRow | null>(null);
    const [selectedVariationForChart, setSelectedVariationForChart] = useState<PerformanceRow | null>(null);
    const [isChartModalOpen, setIsChartModalOpen] = useState(false);
    const [isBlocking, setIsBlocking] = useState<string | null>(null);
    const [hideInactive, setHideInactive] = useState(false);
    const [hideEmpty, setHideEmpty] = useState(false);
    const [sortField, setSortField] = useState<keyof PerformanceRow | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [isByMatch, setIsByMatch] = useState(false);
    const [onlyActive, setOnlyActive] = useState(false);
    const [matchStats, setMatchStats] = useState<any[]>([]);
    const [aiVariationId, setAiVariationId] = useState<string | null>(null);
    const { report: aiReport, loading: aiLoading, error: aiError, generateReport, clearReport } = useAIDiagnosticReport();

    useEffect(() => {
        fetchPerformance();
    }, [onlyActive]);

    const fetchPerformance = async () => {
        try {
            setLoading(true);

            const { data: variationsData, error: variationsError } = await supabase
                .from('robot_variations')
                .select('id, name, active, min_minute, max_minute, min_expected_goals, min_corners, min_shots_insidebox, min_shots_on_target, min_combined_shots, min_possession, min_lambda_total, min_over15_pre');

            if (variationsError) throw variationsError;

            const { data: alertsData, error: alertsError } = await supabase
                .from('live_alerts')
                .select('*')
                .order('created_at', { ascending: false });

            if (alertsError) throw alertsError;

            if (variationsData && alertsData) {
                const grouped: Record<string, PerformanceRow> = {};

                (variationsData as any[]).forEach(v => {
                    grouped[v.id] = {
                        variation_id: v.id,
                        variation_name: v.name,
                        active: v.active ?? true,
                        total_alerts: 0,
                        ht_total_stakes: 0,
                        ht_greens: 0,
                        ht_reds: 0,
                        ht_profit: 0,
                        ht_roi: 0,
                        o15_total_stakes: 0,
                        o15_greens: 0,
                        o15_reds: 0,
                        o15_profit: 0,
                        o15_roi: 0,
                        total_profit: 0,
                        games: [],
                        leagues: {},
                        min_minute: v.min_minute,
                        max_minute: v.max_minute,
                        min_expected_goals: v.min_expected_goals,
                        min_corners: v.min_corners,
                        min_shots_insidebox: v.min_shots_insidebox,
                        min_shots_on_target: v.min_shots_on_target,
                        min_combined_shots: v.min_combined_shots,
                        min_possession: v.min_possession,
                        min_lambda_total: v.min_lambda_total,
                        min_over15_pre: v.min_over15_pre,
                    };
                });

                alertsData.forEach((alert: any) => {
                    const variationId = alert.variation_id;
                    if (grouped[variationId]) {
                        const row = grouped[variationId];

                        let htProfit = 0;
                        let o15Profit = 0;

                        if (alert.goal_ht_result === 'green') htProfit += 0.7 * STAKE;
                        else if (alert.goal_ht_result === 'red') htProfit -= STAKE;

                        if (alert.over15_result === 'green') o15Profit += 0.6 * STAKE;
                        else if (alert.over15_result === 'red') o15Profit -= STAKE;

                        row.games.push({
                            ...alert,
                            htProfit,
                            o15Profit,
                            totalProfit: (alert.is_ht_discarded ? 0 : htProfit) + (alert.is_o15_discarded ? 0 : o15Profit)
                        });

                        if (!alert.is_discarded) {
                            if (!alert.is_ht_discarded) {
                                row.ht_total_stakes++;

                                if (alert.goal_ht_result === 'green' || alert.goal_ht_result === 'red') {
                                    row.total_alerts++;
                                }

                                if (alert.goal_ht_result === 'green') {
                                    row.ht_greens++;
                                    row.ht_profit += 0.7 * STAKE;
                                } else if (alert.goal_ht_result === 'red') {
                                    row.ht_reds++;
                                    row.ht_profit -= STAKE;
                                }
                            }

                            if (!alert.is_o15_discarded) {
                                row.o15_total_stakes++;

                                if (alert.is_ht_discarded && (alert.over15_result === 'green' || alert.over15_result === 'red')) {
                                    row.total_alerts++;
                                }

                                if (alert.over15_result === 'green') {
                                    row.o15_greens++;
                                    row.o15_profit += 0.6 * STAKE;
                                } else if (alert.over15_result === 'red') {
                                    row.o15_reds++;
                                    row.o15_profit -= STAKE;
                                }
                            }

                            row.total_profit += (alert.is_ht_discarded ? 0 : htProfit) + (alert.is_o15_discarded ? 0 : o15Profit);

                            const lName = alert.league_name || 'Desconhecida';
                            const lId = alert.league_id || '0';
                            if (!row.leagues[lName]) {
                                row.leagues[lName] = {
                                    league_name: lName,
                                    league_id: lId,
                                    total: 0,
                                    ht_greens: 0,
                                    ht_reds: 0,
                                    o15_greens: 0,
                                    o15_reds: 0,
                                    ht_profit: 0,
                                    o15_profit: 0
                                };
                            }
                            const lStat = row.leagues[lName];
                            lStat.total++;

                            if (!alert.is_ht_discarded) {
                                lStat.ht_profit += htProfit;
                                if (alert.goal_ht_result === 'green') lStat.ht_greens++;
                                if (alert.goal_ht_result === 'red') lStat.ht_reds++;
                            }

                            if (!alert.is_o15_discarded) {
                                lStat.o15_profit += o15Profit;
                                if (alert.over15_result === 'green') lStat.o15_greens++;
                                if (alert.over15_result === 'red') lStat.o15_reds++;
                            }
                        }
                    }
                });

                const groupedByMatch: Record<string, any> = {};

                alertsData.forEach((alert: any) => {
                    const fixtureId = alert.api_fixture_id || alert.id;
                    const variation = variationsData?.find(v => v.id === alert.variation_id);

                    // Filter by active robots if enabled
                    if (onlyActive && variation && !variation.active) return;
                    if (!variation) return; // Ignore alerts from deleted variations

                    if (!groupedByMatch[fixtureId]) {
                        groupedByMatch[fixtureId] = {
                            fixture_id: fixtureId,
                            home_team: alert.home_team,
                            away_team: alert.away_team,
                            league_name: alert.league_name,
                            league_id: alert.league_id,
                            created_at: alert.created_at,
                            final_score: alert.final_score,
                            minute: alert.minute,
                            total_profit: 0,
                            alerts: [],
                            result_summary: {
                                ht_greens: 0,
                                ht_reds: 0,
                                o15_greens: 0,
                                o15_reds: 0
                            }
                        };
                    }

                    const match = groupedByMatch[fixtureId];
                    let htProfit = 0;
                    let o15Profit = 0;

                    if (alert.goal_ht_result === 'green') htProfit += 0.7 * STAKE;
                    else if (alert.goal_ht_result === 'red') htProfit -= STAKE;

                    if (alert.over15_result === 'green') o15Profit += 0.6 * STAKE;
                    else if (alert.over15_result === 'red') o15Profit -= STAKE;

                    const totalAlertProfit = (alert.is_ht_discarded ? 0 : htProfit) + (alert.is_o15_discarded ? 0 : o15Profit);

                    match.alerts.push({
                        ...alert,
                        variation_name: variation.name,
                        htProfit,
                        o15Profit,
                        totalProfit: totalAlertProfit
                    });

                    if (!alert.is_discarded) {
                        match.total_profit += totalAlertProfit;
                        if (!alert.is_ht_discarded) {
                            if (alert.goal_ht_result === 'green') match.result_summary.ht_greens++;
                            if (alert.goal_ht_result === 'red') match.result_summary.ht_reds++;
                        }
                        if (!alert.is_o15_discarded) {
                            if (alert.over15_result === 'green') match.result_summary.o15_greens++;
                            if (alert.over15_result === 'red') match.result_summary.o15_reds++;
                        }
                    }
                });

                const finalMatchStats = Object.values(groupedByMatch).sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                setMatchStats(finalMatchStats);

                const finalStats = Object.values(grouped).map(row => {
                    const htInvested = row.ht_total_stakes * STAKE;
                    const o15Invested = row.o15_total_stakes * STAKE;

                    row.ht_roi = htInvested > 0 ? (row.ht_profit / htInvested) * 100 : 0;
                    row.o15_roi = o15Invested > 0 ? (row.o15_profit / o15Invested) * 100 : 0;

                    return row;
                });

                setStats(finalStats.sort((a, b) => {
                    if (a.active !== b.active) return a.active ? -1 : 1;
                    return b.total_profit - a.total_profit;
                }));
            }
        } catch (error: any) {
            toast.error('Erro ao buscar estatísticas', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleDiscard = async (alertId: string) => {
        try {
            const { data: alertData } = await supabase
                .from('live_alerts')
                .select('fixture_id')
                .eq('id', alertId)
                .single();

            if (!alertData?.fixture_id) throw new Error('Alerta não encontrado');

            const { error } = await supabase
                .from('live_alerts')
                .update({ is_discarded: true } as any)
                .eq('fixture_id', alertData.fixture_id);

            if (error) throw error;
            toast.success('Jogo descartado em todas as variações');
            fetchPerformance();
        } catch (error: any) {
            toast.error('Erro ao descartar jogo', { description: error.message });
        }
    };

    const handleUpdateOdds = async (alertId: string) => {
        try {
            const ht = parseFloat(editHtOdd);
            const o15 = parseFloat(editO15Odd);

            if (isNaN(ht) || isNaN(o15)) {
                toast.error("Por favor, insira valores válidos para as odds");
                return;
            }

            const { data: alertData } = await supabase
                .from('live_alerts')
                .select('fixture_id')
                .eq('id', alertId)
                .single();

            if (!alertData?.fixture_id) throw new Error('Alerta não encontrado');

            const { error } = await supabase
                .from('live_alerts')
                .update({
                    custom_odd_ht: ht,
                    custom_odd_o15: o15
                } as any)
                .eq('fixture_id', alertData.fixture_id);

            if (error) throw error;
            toast.success('Odds atualizadas em todas as variações');
            setEditingAlertId(null);
            fetchPerformance();
        } catch (error: any) {
            toast.error('Erro ao atualizar odds', { description: error.message });
        }
    };

    const startEditing = (alert: any) => {
        setEditingAlertId(alert.id);
        setEditingAlert(alert);
        setEditHtOdd((alert.custom_odd_ht || DEFAULT_ODD_HT).toString());
        setEditO15Odd((alert.custom_odd_o15 || DEFAULT_ODD_O15).toString());
    };

    const handleRestore = async (alertId: string) => {
        try {
            const { data: alertData } = await supabase
                .from('live_alerts')
                .select('fixture_id')
                .eq('id', alertId)
                .single();

            if (!alertData?.fixture_id) throw new Error('Alerta não encontrado');

            const { error } = await supabase
                .from('live_alerts')
                .update({
                    is_discarded: false,
                    is_ht_discarded: false,
                    is_o15_discarded: false
                } as any)
                .eq('fixture_id', alertData.fixture_id);

            if (error) throw error;
            toast.success('Jogo restaurado em todas as variações');
            fetchPerformance();
        } catch (error: any) {
            toast.error('Erro ao restaurar jogo', { description: error.message });
        }
    };

    const handleToggleMethodDiscard = async (alertId: string, method: 'ht' | 'o15', currentState: boolean) => {
        try {
            const { data: alertData } = await supabase
                .from('live_alerts')
                .select('fixture_id')
                .eq('id', alertId)
                .single();

            if (!alertData?.fixture_id) throw new Error('Alerta não encontrado');

            const update = method === 'ht'
                ? { is_ht_discarded: !currentState }
                : { is_o15_discarded: !currentState };

            const { error } = await supabase
                .from('live_alerts')
                .update(update as any)
                .eq('fixture_id', alertData.fixture_id);

            if (error) throw error;
            toast.success(`${method === 'ht' ? 'HT' : 'O1.5'} ${!currentState ? 'desativado' : 'ativado'} em todas as variações`);
            fetchPerformance();
        } catch (error: any) {
            toast.error('Erro ao atualizar método', { description: error.message });
        }
    };

    const handleBlockLeague = async (leagueId: string, leagueName: string) => {
        if (!leagueId || leagueId === '0') {
            toast.error('ID da liga não encontrado para bloqueio');
            return;
        }

        try {
            setIsBlocking(leagueId);

            const { data: existing } = await supabase
                .from('robot_blocked_leagues')
                .select('id')
                .eq('league_id', leagueId)
                .maybeSingle();

            if (existing) {
                toast.warning('Esta liga já está bloqueada para o robô.');
                return;
            }

            const { error } = await supabase
                .from('robot_blocked_leagues')
                .insert([{
                    league_id: leagueId,
                    league_name: leagueName
                }]);

            if (error) throw error;
            toast.success(`Liga ${leagueName} bloqueada para o robô.`);
        } catch (error: any) {
            toast.error('Erro ao bloquear liga', { description: error.message });
        } finally {
            setIsBlocking(null);
        }
    };

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getRates = (greens: number, reds: number) => {
        const total = greens + reds;
        const rate = total > 0 ? Math.round((greens / total) * 100) : 0;
        return { total, rate };
    };

    const groupGamesByDate = (games: any[]) => {
        const groups: Record<string, any[]> = {};
        games.forEach(g => {
            const date = format(parseISO(g.created_at), 'yyyy-MM-dd');
            if (!groups[date]) groups[date] = [];
            groups[date].push(g);
        });
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    };

    const handleSort = (field: keyof PerformanceRow) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const SortIcon = ({ field }: { field: keyof PerformanceRow }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20 inline-block" />;
        return <ArrowUpDown className={cn("w-3 h-3 ml-1 inline-block", sortField === field ? "text-primary opacity-100" : "opacity-20")} />;
    };

    const filteredStats = stats
        .filter(row => {
            if (hideInactive && !row.active) return false;
            if (hideEmpty && row.total_alerts === 0) return false;
            return true;
        })
        .sort((a, b) => {
            if (!sortField) return (a.active === b.active) ? (b.total_profit - a.total_profit) : (a.active ? -1 : 1);
            const aValue = a[sortField];
            const bValue = b[sortField];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }

            const valA = (aValue as number) || 0;
            const valB = (bValue as number) || 0;
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });

    return (
        <div className="space-y-6 pb-20">
            {/* HUD Header - Glassmorphism & Neon */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 md:p-8"
            >
                {/* Background Glows */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] -z-10" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/10 blur-[100px] -z-10" />

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 rounded-2xl bg-primary/20 border border-primary/30 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
                                <BarChart3 className="w-6 h-6 text-primary animate-pulse" />
                            </div>
                            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/70 tracking-tight">
                                PERFORMANCE <span className="text-primary italic">PRO MAX</span>
                            </h1>
                        </div>
                        <p className="text-zinc-400 font-medium max-w-lg leading-relaxed">
                            Métricas avançadas de inteligência artificial aplicadas às estratégias do robô em tempo real.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 bg-white/5 backdrop-blur-md rounded-2xl p-2 border border-white/10 shadow-inner">
                        <div className="flex items-center space-x-3 px-3">
                            <Switch
                                id="hide-inactive"
                                checked={hideInactive}
                                onCheckedChange={setHideInactive}
                                className="data-[state=checked]:bg-primary"
                            />
                            <Label htmlFor="hide-inactive" className="text-[10px] font-black text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">Ocultar Inativos</Label>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="flex items-center space-x-3 px-3">
                            <Switch
                                id="hide-empty"
                                checked={hideEmpty}
                                onCheckedChange={setHideEmpty}
                                className="data-[state=checked]:bg-primary"
                            />
                            <Label htmlFor="hide-empty" className="text-[10px] font-black text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">Ocultar sem Jogos</Label>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* AI Diagnostic Report - Global */}
            <AIDiagnosticReport
                report={aiReport}
                loading={aiLoading}
                error={aiError}
                onClear={() => { clearReport(); setAiVariationId(null); }}
                tabLabel="Robô Ao Vivo"
                onGenerate={() => {
                    const targetVariation = aiVariationId
                        ? stats.find(s => s.variation_id === aiVariationId)
                        : stats.find(s => s.total_alerts > 0 && s.active);

                    if (!targetVariation) {
                        toast.error('Nenhuma variação com dados encontrada');
                        return;
                    }

                    setAiVariationId(targetVariation.variation_id);

                    const allGames = targetVariation.games.filter((g: any) => !g.is_discarded);
                    const totalGreens = targetVariation.ht_greens + targetVariation.o15_greens;
                    const totalReds = targetVariation.ht_reds + targetVariation.o15_reds;
                    const totalOps = totalGreens + totalReds;

                    const redGames = allGames.filter((g: any) =>
                        g.goal_ht_result === 'red' || g.over15_result === 'red'
                    );

                    const leagueEntries = Object.values(targetVariation.leagues) as LeagueStat[];

                    const dayMap: Record<string, { greens: number; reds: number; profit: number }> = {};
                    allGames.forEach((g: any) => {
                        const d = g.created_at ? format(parseISO(g.created_at), 'yyyy-MM-dd') : '';
                        if (!d) return;
                        if (!dayMap[d]) dayMap[d] = { greens: 0, reds: 0, profit: 0 };
                        if (!g.is_ht_discarded && g.goal_ht_result === 'green') dayMap[d].greens++;
                        if (!g.is_ht_discarded && g.goal_ht_result === 'red') dayMap[d].reds++;
                        if (!g.is_o15_discarded && g.over15_result === 'green') dayMap[d].greens++;
                        if (!g.is_o15_discarded && g.over15_result === 'red') dayMap[d].reds++;
                        dayMap[d].profit += (g.totalProfit || 0) / STAKE;
                    });

                    const input: DiagnosticInput = {
                        tab: 'robo',
                        variationName: targetVariation.variation_name,
                        metrics: {
                            total: totalOps,
                            greens: totalGreens,
                            reds: totalReds,
                            winRate: totalOps > 0 ? (totalGreens / totalOps) * 100 : 0,
                            profit: targetVariation.total_profit / STAKE,
                            avgOdd: 0,
                        },
                        methodBreakdown: {
                            ht: {
                                greens: targetVariation.ht_greens,
                                reds: targetVariation.ht_reds,
                                profit: targetVariation.ht_profit / STAKE,
                                roi: targetVariation.ht_roi,
                            },
                            o15: {
                                greens: targetVariation.o15_greens,
                                reds: targetVariation.o15_reds,
                                profit: targetVariation.o15_profit / STAKE,
                                roi: targetVariation.o15_roi,
                            },
                        },
                        redAnalysis: redGames.slice(0, 15).map((g: any) => ({
                            game: `${g.home_team || '?'} vs ${g.away_team || '?'}`,
                            league: g.league_name || 'Desconhecida',
                            score: `HT:${g.goal_ht_result || '-'} O15:${g.over15_result || '-'}`,
                            criteria: {
                                ht_result: g.goal_ht_result,
                                o15_result: g.over15_result,
                                minute: g.minute_entered,
                                pressure_score: g.pressure_score,
                            },
                            date: g.created_at ? format(parseISO(g.created_at), 'yyyy-MM-dd') : '',
                        })),
                        leagueBreakdown: leagueEntries.map(l => ({
                            name: l.league_name,
                            total: l.total,
                            greens: l.ht_greens + l.o15_greens,
                            reds: l.ht_reds + l.o15_reds,
                            winRate: (() => {
                                const t = (l.ht_greens + l.o15_greens + l.ht_reds + l.o15_reds);
                                return t > 0 ? ((l.ht_greens + l.o15_greens) / t) * 100 : 0;
                            })(),
                            profit: l.ht_profit + l.o15_profit,
                        })),
                        paramSnapshot: {
                            min_minute: targetVariation.min_minute,
                            max_minute: targetVariation.max_minute,
                            min_expected_goals: targetVariation.min_expected_goals,
                            min_corners: targetVariation.min_corners,
                            min_shots_insidebox: targetVariation.min_shots_insidebox,
                            min_shots_on_target: targetVariation.min_shots_on_target,
                            min_combined_shots: targetVariation.min_combined_shots,
                            min_possession: targetVariation.min_possession,
                            min_lambda_total: targetVariation.min_lambda_total,
                            min_over15_pre: targetVariation.min_over15_pre,
                        },
                        oddRangeStats: [],
                        recentTrend: Object.entries(dayMap)
                            .sort(([a], [b]) => b.localeCompare(a))
                            .slice(0, 10)
                            .map(([date, d]) => ({ date, ...d })),
                    };

                    generateReport(input);
                }}
            />

            {/* Main Content Area */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-[#0a0a0c]/80 backdrop-blur-3xl shadow-2xl">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="w-[60px]"></TableHead>
                            <TableHead
                                className="text-zinc-400 font-black text-[10px] uppercase tracking-widest cursor-pointer hover:text-white transition-colors"
                                onClick={() => handleSort('variation_name')}
                            >
                                <div className="flex items-center gap-1">ESTRATÉGIA <SortIcon field="variation_name" /></div>
                            </TableHead>

                            <TableHead
                                className="text-center cursor-pointer hover:text-white transition-colors"
                                onClick={() => handleSort('ht_profit')}
                            >
                                <div className="flex items-center justify-center gap-1 text-zinc-500 font-black text-[10px] uppercase tracking-tighter">
                                    Métrica HT <SortIcon field="ht_profit" />
                                </div>
                            </TableHead>

                            <TableHead
                                className="text-center cursor-pointer hover:text-white transition-colors"
                                onClick={() => handleSort('o15_profit')}
                            >
                                <div className="flex items-center justify-center gap-1 text-zinc-500 font-black text-[10px] uppercase tracking-tighter">
                                    Métrica OVER 1.5 <SortIcon field="o15_profit" />
                                </div>
                            </TableHead>

                            <TableHead className="text-center">
                                <span className="text-zinc-500 font-black text-[10px] uppercase tracking-tighter">STAKES (LUCRO / TOTAL)</span>
                            </TableHead>

                            {!isMobile && (
                                <TableHead
                                    className="text-center cursor-pointer hover:text-white transition-colors"
                                    onClick={() => handleSort('total_profit')}
                                >
                                    <div className="flex items-center justify-center gap-1 text-zinc-400 font-black text-[10px] uppercase tracking-widest">
                                        LUCRO TOTAL <SortIcon field="total_profit" />
                                    </div>
                                </TableHead>
                            )}

                            <TableHead className="text-center text-zinc-400 font-black text-[10px] uppercase tracking-widest">Ações</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {loading ? (
                            <TableRow className="border-white/5">
                                <TableCell colSpan={7} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center gap-4 text-zinc-500 font-black uppercase italic animate-pulse">
                                        <div className="relative">
                                            <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                            <div className="absolute inset-0 blur-xl bg-primary/20 rounded-full animate-pulse" />
                                        </div>
                                        Sincronizando Banco de Dados...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredStats.length === 0 ? (
                            <TableRow className="border-white/5">
                                <TableCell colSpan={7} className="h-40 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 opacity-30 grayscale">
                                        <Zap className="w-12 h-12 mb-2" />
                                        <p className="text-sm font-black uppercase italic tracking-widest">Nenhum rastro de operação detectado</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredStats.map((row) => {
                                const isExpanded = expandedRows[row.variation_id];
                                const ht = getRates(row.ht_greens, row.ht_reds);
                                const o15 = getRates(row.o15_greens, row.o15_reds);

                                return (
                                    <React.Fragment key={row.variation_id}>
                                        <TableRow
                                            className={cn(
                                                "border-white/5 group transition-all duration-500 ease-out h-20",
                                                isExpanded ? "bg-white/[0.03]" : "hover:bg-white/[0.02]",
                                                !row.active && "opacity-50"
                                            )}
                                            onClick={() => toggleRow(row.variation_id)}
                                        >
                                            <TableCell className="text-center">
                                                <motion.div
                                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                                >
                                                    <ChevronRight className={cn("w-5 h-5 transition-colors", isExpanded ? "text-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" : "text-zinc-600")} />
                                                </motion.div>
                                            </TableCell>

                                            <TableCell>
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "w-1.5 h-10 rounded-full shadow-lg",
                                                        row.total_profit >= 0 ? "bg-emerald-500 shadow-emerald-500/20" : "bg-red-500 shadow-red-500/20",
                                                        !row.active && "bg-zinc-700"
                                                    )} />
                                                    <div>
                                                        <h3 className="font-black text-white text-lg tracking-tighter uppercase leading-none mb-1 group-hover:text-primary transition-colors">
                                                            {row.variation_name}
                                                        </h3>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className={cn(
                                                                "text-[8px] font-black tracking-widest uppercase py-0 px-1.5 h-4 border-white/10",
                                                                row.active ? "text-emerald-400 bg-emerald-400/5" : "text-zinc-500 bg-zinc-500/5"
                                                            )}>
                                                                {row.active ? 'Ativo' : 'Inativo'}
                                                            </Badge>
                                                            <span className="text-[10px] font-bold text-zinc-500 tracking-tighter">
                                                                {row.total_alerts} OPERAÇÕES
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* HT METRICS */}
                                            <TableCell className="text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <div className={cn(
                                                        "text-xs font-black px-3 py-1 rounded-full mb-1 border",
                                                        row.ht_profit >= 0
                                                            ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                                                            : "text-red-400 bg-red-500/5 border-red-500/10"
                                                    )}>
                                                        <span className="mr-1">{(row.ht_profit / STAKE).toFixed(2)} STK |</span>
                                                        <span className="opacity-70 text-[9px]">{row.ht_roi.toFixed(1)}% ROI</span>
                                                    </div>
                                                    <div className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">
                                                        {row.ht_greens}W / {row.ht_reds}L
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* O1.5 METRICS */}
                                            <TableCell className="text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <div className={cn(
                                                        "text-xs font-black px-3 py-1 rounded-full mb-1 border",
                                                        row.o15_profit >= 0
                                                            ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                                                            : "text-red-400 bg-red-500/5 border-red-500/10"
                                                    )}>
                                                        <span className="mr-1">{(row.o15_profit / STAKE).toFixed(2)} STK |</span>
                                                        <span className="opacity-70 text-[9px]">{row.o15_roi.toFixed(1)}% ROI</span>
                                                    </div>
                                                    <div className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">
                                                        {row.o15_greens}W / {row.o15_reds}L
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* GENERAL STAKES METRICS */}
                                            <TableCell className="text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <div className={cn(
                                                        "text-xs font-black px-3 py-1 rounded-full mb-1 border",
                                                        row.total_profit >= 0
                                                            ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                                                            : "text-red-400 bg-red-500/5 border-red-500/10"
                                                    )}>
                                                        <span className="mr-1">{(row.total_profit / STAKE).toFixed(2)} STK |</span>
                                                        <span className="opacity-70 text-[9px]">{row.ht_total_stakes + row.o15_total_stakes} ENTRADAS</span>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {!isMobile && (
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className={cn(
                                                            "text-xl font-black italic tracking-tighter",
                                                            row.total_profit >= 0 ? "text-emerald-400" : "text-red-400"
                                                        )}>
                                                            {row.total_profit >= 0 ? '+' : ''}{(row.total_profit / STAKE).toFixed(2)}<span className="text-[10px] ml-0.5">UNITS</span>
                                                        </span>
                                                        <div className="w-16 h-1 rounded-full bg-white/5 mt-1 overflow-hidden">
                                                            <div
                                                                className={cn("h-full transition-all duration-1000", row.total_profit >= 0 ? "bg-emerald-500" : "bg-red-500")}
                                                                style={{ width: `${Math.min(Math.abs(row.total_profit / 500), 1) * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            )}

                                            <TableCell>
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAiVariationId(row.variation_id);
                                                            // Triggering AI report is handled via AIDiagnosticReport's onGenerate
                                                            // We'll just scroll to top where the report is located
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                        className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 hover:text-white transition-all duration-300"
                                                    >
                                                        <Brain className="w-5 h-5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedVariationForChart(row);
                                                            setIsChartModalOpen(true);
                                                        }}
                                                        className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-white transition-all duration-300"
                                                    >
                                                        <TrendingUp className="w-5 h-5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedVariationForRanking(row);
                                                            setIsRankingModalOpen(true);
                                                        }}
                                                        className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:text-white transition-all duration-300"
                                                    >
                                                        <Trophy className="w-5 h-5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded Row - Game History Cards */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <TableRow className="border-white/5 bg-black/40 hover:bg-black/40">
                                                    <TableCell colSpan={7} className="p-0 border-none">
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            transition={{ duration: 0.5, ease: [0.04, 0.62, 0.23, 0.98] }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="p-8 space-y-8">
                                                                {groupGamesByDate(row.games).map(([date, dateGames]) => (
                                                                    <div key={date} className="relative">
                                                                        <div className="flex items-center gap-4 mb-4">
                                                                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                                                            <Badge variant="outline" className="text-[10px] font-black bg-white/5 border-white/10 text-zinc-400 uppercase tracking-[0.2em] px-3 py-1">
                                                                                <Calendar className="w-3 h-3 mr-2" />
                                                                                {format(parseISO(date), "dd 'DE' MMMM", { locale: ptBR })}
                                                                            </Badge>
                                                                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                                                        </div>

                                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                            {dateGames.map((game: any) => (
                                                                                <motion.div
                                                                                    key={game.id}
                                                                                    whileHover={{ scale: 1.02, y: -5 }}
                                                                                    className={cn(
                                                                                        "relative group overflow-hidden rounded-2xl border transition-all duration-300",
                                                                                        game.is_discarded
                                                                                            ? "bg-zinc-900/40 border-white/5 opacity-50 grayscale"
                                                                                            : "bg-[#141416] border-white/10 hover:border-white/20",
                                                                                        !game.is_discarded && (
                                                                                            game.totalProfit > 0
                                                                                                ? "shadow-[0_0_30px_rgba(16,185,129,0.05)]"
                                                                                                : game.totalProfit < 0
                                                                                                    ? "shadow-[0_0_30px_rgba(239,68,68,0.05)]"
                                                                                                    : ""
                                                                                        )
                                                                                    )}
                                                                                >
                                                                                    {/* Condition Overlay Gradient */}
                                                                                    {!game.is_discarded && (
                                                                                        <div className={cn(
                                                                                            "absolute inset-0 opacity-[0.03] transition-opacity group-hover:opacity-[0.08] pointer-events-none",
                                                                                            game.totalProfit > 0 ? "bg-emerald-500" : game.totalProfit < 0 ? "bg-red-500" : "bg-zinc-500"
                                                                                        )} />
                                                                                    )}

                                                                                    <div className="p-5 h-full flex flex-col justify-between z-10 relative">
                                                                                        <div>
                                                                                            {/* Card Header: League & Time */}
                                                                                            <div className="flex justify-between items-start mb-4">
                                                                                                <div className="flex items-center gap-1.5 max-w-[70%]">
                                                                                                    <Globe className="w-3 h-3 text-zinc-600 shrink-0" />
                                                                                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter truncate">
                                                                                                        {game.league_name}
                                                                                                    </span>
                                                                                                </div>
                                                                                                <div className="text-[9px] font-bold text-zinc-600 flex items-center gap-1">
                                                                                                    <Clock className="w-3 h-3" />
                                                                                                    {format(parseISO(game.created_at), 'HH:mm')}
                                                                                                </div>
                                                                                            </div>

                                                                                            {/* Teams & Score */}
                                                                                            <div className="space-y-1 mb-4 text-center">
                                                                                                <div className="text-xs font-black text-white/90 truncate uppercase tracking-tighter">
                                                                                                    {game.home_team}
                                                                                                </div>
                                                                                                <div className="flex items-center justify-center gap-2">
                                                                                                    <div className="h-px w-8 bg-white/5" />
                                                                                                    <div className="text-xl font-black text-primary px-3 py-1 rounded-lg bg-white/5 border border-white/5 shadow-inner leading-none italic">
                                                                                                        {game.final_score || '—'}
                                                                                                    </div>
                                                                                                    <div className="h-px w-8 bg-white/5" />
                                                                                                </div>
                                                                                                <div className="text-xs font-black text-white/90 truncate uppercase tracking-tighter">
                                                                                                    {game.away_team}
                                                                                                </div>
                                                                                            </div>

                                                                                            {/* Results / Methods */}
                                                                                            <div className="grid grid-cols-2 gap-2 mb-4">
                                                                                                <div className={cn(
                                                                                                    "p-2 rounded-xl border flex flex-col items-center justify-center transition-all",
                                                                                                    game.is_ht_discarded
                                                                                                        ? "bg-black/20 border-white/5 opacity-40"
                                                                                                        : "bg-white/[0.03] border-white/10"
                                                                                                )}>
                                                                                                    <span className="text-[8px] font-black text-zinc-600 uppercase mb-1 tracking-widest">HT @{game.custom_odd_ht || 1.7}</span>
                                                                                                    <div className="flex items-center gap-1.5">
                                                                                                        {game.goal_ht_result === 'green' ? <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> : game.goal_ht_result === 'red' ? <div className="w-2 h-2 rounded-full bg-red-500" /> : <div className="w-2 h-2 rounded-full bg-zinc-700" />}
                                                                                                        <span className={cn(
                                                                                                            "text-[10px] font-black uppercase tracking-tighter",
                                                                                                            game.goal_ht_result === 'green' ? "text-emerald-400" : game.goal_ht_result === 'red' ? "text-red-400" : "text-zinc-600"
                                                                                                        )}>
                                                                                                            {game.goal_ht_result || 'Pendente'}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className={cn(
                                                                                                    "p-2 rounded-xl border flex flex-col items-center justify-center transition-all",
                                                                                                    game.is_o15_discarded
                                                                                                        ? "bg-black/20 border-white/5 opacity-40"
                                                                                                        : "bg-white/[0.03] border-white/10"
                                                                                                )}>
                                                                                                    <span className="text-[8px] font-black text-zinc-600 uppercase mb-1 tracking-widest">O15 @{game.custom_odd_o15 || 1.6}</span>
                                                                                                    <div className="flex items-center gap-1.5">
                                                                                                        {game.over15_result === 'green' ? <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> : game.over15_result === 'red' ? <div className="w-2 h-2 rounded-full bg-red-500" /> : <div className="w-2 h-2 rounded-full bg-zinc-700" />}
                                                                                                        <span className={cn(
                                                                                                            "text-[10px] font-black uppercase tracking-tighter",
                                                                                                            game.over15_result === 'green' ? "text-emerald-400" : game.over15_result === 'red' ? "text-red-400" : "text-zinc-600"
                                                                                                        )}>
                                                                                                            {game.over15_result || 'Pendente'}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Card Footer: Actions */}
                                                                                        <div className="flex items-center justify-between gap-2 pt-4 border-t border-white/5">
                                                                                            <div className="flex gap-1.5">
                                                                                                <Button
                                                                                                    variant="ghost"
                                                                                                    size="icon"
                                                                                                    onClick={() => startEditing(game)}
                                                                                                    className="h-8 w-8 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
                                                                                                >
                                                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                                                </Button>
                                                                                                <Button
                                                                                                    variant="ghost"
                                                                                                    size="icon"
                                                                                                    onClick={() => handleBlockLeague(game.league_id, game.league_name)}
                                                                                                    disabled={isBlocking === game.league_id}
                                                                                                    className="h-8 w-8 rounded-lg text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                                                                                >
                                                                                                    {isBlocking === game.league_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldX className="w-3.5 h-3.5" />}
                                                                                                </Button>
                                                                                            </div>

                                                                                            <div className="flex gap-1.5">
                                                                                                <Button
                                                                                                    variant="ghost"
                                                                                                    className={cn(
                                                                                                        "text-[10px] font-black h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all",
                                                                                                        game.is_discarded
                                                                                                            ? "text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10"
                                                                                                            : "text-red-500 bg-red-500/5 hover:bg-red-500/10"
                                                                                                    )}
                                                                                                    onClick={() => game.is_discarded ? handleRestore(game.id) : handleDiscard(game.id)}
                                                                                                >
                                                                                                    {game.is_discarded ? <><RotateCcw className="w-3 h-3" /> RESTAURAR</> : <><Trash2 className="w-3 h-3" /> DESCARTAR</>}
                                                                                                </Button>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Profit Indicator */}
                                                                                        {!game.is_discarded && (
                                                                                            <div className={cn(
                                                                                                "absolute top-0 right-0 px-2 py-0.5 rounded-bl-xl text-[8px] font-black tracking-tighter",
                                                                                                game.totalProfit > 0 ? "bg-emerald-500/20 text-emerald-400" : game.totalProfit < 0 ? "bg-red-500/20 text-red-400" : "bg-zinc-800 text-zinc-500"
                                                                                            )}>
                                                                                                {game.totalProfit >= 0 ? '+' : ''}{(game.totalProfit / STAKE).toFixed(2)}U
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </motion.div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </AnimatePresence>
                                    </React.Fragment>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* MODALS - Design Upgrade */}
            {/* Ranking Modal */}
            <Dialog open={isRankingModalOpen} onOpenChange={setIsRankingModalOpen}>
                <DialogContent className="max-w-4xl bg-[#0a0a0c]/90 backdrop-blur-3xl border-white/10 rounded-[2rem] p-8">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic tracking-tighter text-white flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-amber-500" />
                            TOP LIGAS: <span className="text-primary">{selectedVariationForRanking?.variation_name}</span>
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500">
                            Desempenho analítico detalhado por liga para identificar padrões de lucro.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-6 rounded-2xl border border-white/5 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-white/5">
                                <TableRow className="border-white/5 hover:bg-transparent text-[9px] font-black uppercase tracking-widest text-zinc-500">
                                    <TableHead>LIGA</TableHead>
                                    <TableHead className="text-center">JOGOS</TableHead>
                                    <TableHead className="text-center">HT RESULTS</TableHead>
                                    <TableHead className="text-center">O15 RESULTS</TableHead>
                                    <TableHead className="text-right">LUCRO TOTAL</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedVariationForRanking && Object.values(selectedVariationForRanking.leagues)
                                    .sort((a, b) => (b.ht_profit + b.o15_profit) - (a.ht_profit + a.o15_profit))
                                    .map((l, i) => {
                                        const profit = l.ht_profit + l.o15_profit;
                                        return (
                                            <TableRow key={l.league_id + i} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                                                <TableCell className="font-bold text-white text-xs">{l.league_name}</TableCell>
                                                <TableCell className="text-center text-xs font-mono text-zinc-500">{l.total}</TableCell>
                                                <TableCell className="text-center">
                                                    <span className="text-[10px] font-black text-emerald-500/80 mr-1">{l.ht_greens}W</span>
                                                    <span className="text-[10px] font-black text-red-500/80">{l.ht_reds}L</span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="text-[10px] font-black text-emerald-500/80 mr-1">{l.o15_greens}W</span>
                                                    <span className="text-[10px] font-black text-red-500/80">{l.o15_reds}L</span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={cn("font-mono font-black", profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                                                        {profit >= 0 ? '+' : ''}{(profit / STAKE).toFixed(2)}u
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                }
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Chart Modal */}
            <Dialog open={isChartModalOpen} onOpenChange={setIsChartModalOpen}>
                <DialogContent className="max-w-5xl h-[80vh] bg-[#0a0a0c]/90 backdrop-blur-3xl border-white/10 rounded-[2rem] p-8">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic tracking-tighter text-white flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-emerald-500" />
                            CURVA DE EQUIDADE: <span className="text-primary">{selectedVariationForChart?.variation_name}</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 mt-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={(() => {
                                if (!selectedVariationForChart) return [];
                                let currentProfit = 0;
                                return [...selectedVariationForChart.games]
                                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                                    .map((g, i) => {
                                        currentProfit += (g.totalProfit || 0) / STAKE;
                                        return {
                                            index: i + 1,
                                            profit: parseFloat(currentProfit.toFixed(2)),
                                            game: `${g.home_team} vs ${g.away_team}`
                                        };
                                    });
                            })()}>
                                <defs>
                                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis
                                    dataKey="index"
                                    stroke="#ffffff20"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#ffffff20"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `${val}u`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0a0a0c',
                                        borderColor: '#ffffff10',
                                        borderRadius: '16px',
                                        fontSize: '12px',
                                        fontWeight: '900',
                                        color: '#fff'
                                    }}
                                    itemStyle={{ color: '#10b981' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="profit"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorProfit)"
                                    animationDuration={2000}
                                />
                                <ReferenceLine y={0} stroke="#ffffff10" strokeWidth={1} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Odds Modal */}
            <Dialog open={!!editingAlertId} onOpenChange={(open) => !open && setEditingAlertId(null)}>
                <DialogContent className="max-w-md bg-[#0a0a0c]/90 backdrop-blur-3xl border-white/10 rounded-[2rem] p-8">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black italic tracking-tighter text-white flex items-center gap-2">
                            <Edit2 className="w-5 h-5 text-primary" />
                            AJUSTAR ODDS REAIS
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500">
                            {editingAlert?.home_team} vs {editingAlert?.away_team}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Odd HT Real</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={editHtOdd}
                                onChange={(e) => setEditHtOdd(e.target.value)}
                                className="bg-white/5 border-white/10 rounded-xl focus:ring-primary focus:border-primary text-white font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Odd O1.5 Real</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={editO15Odd}
                                onChange={(e) => setEditO15Odd(e.target.value)}
                                className="bg-white/5 border-white/10 rounded-xl focus:ring-primary focus:border-primary text-white font-mono"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <Button
                            variant="ghost"
                            className="flex-1 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-white font-black"
                            onClick={() => setEditingAlertId(null)}
                        >
                            CANCELAR
                        </Button>
                        <Button
                            className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-black font-black shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]"
                            onClick={() => editingAlertId && handleUpdateOdds(editingAlertId)}
                        >
                            SALVAR ODDS
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
