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
    Edit2
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
    ht_greens: number;
    ht_reds: number;
    ht_profit: number;
    ht_roi: number;
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

const DEFAULT_ODD_HT = 2.0;
const DEFAULT_ODD_O15 = 1.6;
const STAKE = 100;

export default function RoboPerformance() {
    const isMobile = useIsMobile();
    const [stats, setStats] = useState<PerformanceRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
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
    const [aiVariationId, setAiVariationId] = useState<string | null>(null);
    const { report: aiReport, loading: aiLoading, error: aiError, generateReport, clearReport } = useAIDiagnosticReport();

    useEffect(() => {
        fetchPerformance();
    }, []);

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
                        ht_greens: 0,
                        ht_reds: 0,
                        ht_profit: 0,
                        ht_roi: 0,
                        o15_greens: 0,
                        o15_reds: 0,
                        o15_profit: 0,
                        o15_roi: 0,
                        total_profit: 0,
                        games: [],
                        leagues: {},
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

                        // Calculate individual profit for the game card display
                        let htProfit = 0;
                        let o15Profit = 0;

                        if (alert.goal_ht_result === 'green') htProfit += ((alert.custom_odd_ht || DEFAULT_ODD_HT) - 1) * STAKE;
                        else if (alert.goal_ht_result === 'red') htProfit -= STAKE;

                        if (alert.over15_result === 'green') o15Profit += ((alert.custom_odd_o15 || DEFAULT_ODD_O15) - 1) * STAKE;
                        else if (alert.over15_result === 'red') o15Profit -= STAKE;

                        row.games.push({
                            ...alert,
                            htProfit,
                            o15Profit,
                            totalProfit: (alert.is_ht_discarded ? 0 : htProfit) + (alert.is_o15_discarded ? 0 : o15Profit)
                        });

                        // Only include non-discarded alerts in the main performance stats
                        if (!alert.is_discarded) {

                            // HT calculation
                            if (!alert.is_ht_discarded) {
                                if (alert.goal_ht_result === 'green' || alert.goal_ht_result === 'red') {
                                    row.total_alerts++; // Increment total alerts if at least one method is active
                                }

                                if (alert.goal_ht_result === 'green') {
                                    row.ht_greens++;
                                    row.ht_profit += ((alert.custom_odd_ht || DEFAULT_ODD_HT) - 1) * STAKE;
                                } else if (alert.goal_ht_result === 'red') {
                                    row.ht_reds++;
                                    row.ht_profit -= STAKE;
                                }
                            }

                            // O1.5 calculation
                            if (!alert.is_o15_discarded) {
                                if (!alert.is_ht_discarded && (alert.over15_result === 'green' || alert.over15_result === 'red')) {
                                    // already incremented? no, total_alerts should count the alert if ANY method is active
                                } else if (alert.is_ht_discarded && (alert.over15_result === 'green' || alert.over15_result === 'red')) {
                                    row.total_alerts++;
                                }

                                if (alert.over15_result === 'green') {
                                    row.o15_greens++;
                                    row.o15_profit += ((alert.custom_odd_o15 || DEFAULT_ODD_O15) - 1) * STAKE;
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

                const finalStats = Object.values(grouped).map(row => {
                    const htInvested = (row.ht_greens + row.ht_reds) * STAKE;
                    const o15Invested = (row.o15_greens + row.o15_reds) * STAKE;

                    row.ht_roi = htInvested > 0 ? (row.ht_profit / htInvested) * 100 : 0;
                    row.o15_roi = o15Invested > 0 ? (row.o15_profit / o15Invested) * 100 : 0;

                    return row;
                });

                setStats(finalStats.sort((a, b) => {
                    // Always put inactive variations at the end
                    if (a.active !== b.active) {
                        return a.active ? -1 : 1;
                    }
                    // For same active status, sort by profit
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
            // First get the fixture_id to sync across all variations
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

            // Get fixture_id to sync odds across all variations
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
        setEditHtOdd((alert.custom_odd_ht || DEFAULT_ODD_HT).toString());
        setEditO15Odd((alert.custom_odd_o15 || DEFAULT_ODD_O15).toString());
    };

    const handleRestore = async (alertId: string) => {
        try {
            // Get fixture_id to sync restore across all variations
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
            // Get fixture_id to sync method toggle across all variations
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

    const formatGameMinute = (minute: number | undefined) => {
        if (minute === undefined || minute === null) return '';
        return ` • ${minute}'`;
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

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center text-white">
                <div>
                    <h3 className="text-xl font-medium flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                        Desempenho por Método
                    </h3>
                    <p className="text-sm text-zinc-500">Lucros e ROI calculados separadamente por HT (@2.0) e Over 1.5 (@1.60).</p>
                </div>

                <div className="flex gap-4 items-center bg-[#1e2333] px-4 py-2 rounded-lg border border-[#2a3142]">
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="hide-inactive"
                            checked={hideInactive}
                            onCheckedChange={setHideInactive}
                        />
                        <Label htmlFor="hide-inactive" className="text-xs font-bold text-zinc-400 cursor-pointer">OCULTAR INATIVOS</Label>
                    </div>
                    <div className="flex items-center space-x-2 border-l border-zinc-700 pl-4">
                        <Switch
                            id="hide-empty"
                            checked={hideEmpty}
                            onCheckedChange={setHideEmpty}
                        />
                        <Label htmlFor="hide-empty" className="text-xs font-bold text-zinc-400 cursor-pointer">OCULTAR SEM JOGOS</Label>
                    </div>
                </div>
            </div>

            {/* AI Diagnostic Report Section */}
            <AIDiagnosticReport
                report={aiReport}
                loading={aiLoading}
                error={aiError}
                onClear={() => { clearReport(); setAiVariationId(null); }}
                tabLabel="Robô Ao Vivo"
                onGenerate={() => {
                    // Use first active variation with data, or aggregate all
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

                    // Red games
                    const redGames = allGames.filter((g: any) =>
                        g.goal_ht_result === 'red' || g.over15_result === 'red'
                    );

                    // League breakdown
                    const leagueEntries = Object.values(targetVariation.leagues) as LeagueStat[];

                    // Recent trend by day
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

            <div className="rounded-md border border-[#2a3142] overflow-hidden">
                <Table>
                    <TableHeader className="bg-[#1e2333]/50">
                        <TableRow className="border-[#2a3142] hover:bg-transparent">
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead
                                className="text-[#a1a1aa] font-black text-[10px] uppercase cursor-pointer hover:text-white"
                                onClick={() => handleSort('variation_name')}
                            >
                                Variação / Método <SortIcon field="variation_name" />
                            </TableHead>
                            <TableHead
                                className="text-[#a1a1aa] font-black text-[10px] uppercase text-center cursor-pointer hover:text-white"
                                onClick={() => handleSort('ht_roi')}
                            >
                                Retorno (ROI) HT <SortIcon field="ht_roi" />
                            </TableHead>
                            <TableHead
                                className="text-[#a1a1aa] font-black text-[10px] uppercase text-center cursor-pointer hover:text-white"
                                onClick={() => handleSort('ht_profit')}
                            >
                                Lucro HT <SortIcon field="ht_profit" />
                            </TableHead>
                            <TableHead
                                className="text-[#a1a1aa] font-black text-[10px] uppercase text-center cursor-pointer hover:text-white"
                                onClick={() => handleSort('o15_roi')}
                            >
                                Retorno (ROI) Over 1.5 <SortIcon field="o15_roi" />
                            </TableHead>
                            <TableHead
                                className="text-[#a1a1aa] font-black text-[10px] uppercase text-center cursor-pointer hover:text-white"
                                onClick={() => handleSort('o15_profit')}
                            >
                                Lucro O1.5 <SortIcon field="o15_profit" />
                            </TableHead>
                            {!isMobile && (
                                <TableHead
                                    className="text-[#a1a1aa] font-black text-[10px] uppercase text-center cursor-pointer hover:text-white"
                                    onClick={() => handleSort('total_profit')}
                                >
                                    Lucro Total <SortIcon field="total_profit" />
                                </TableHead>
                            )}
                            <TableHead className="text-[#a1a1aa] font-black text-[10px] uppercase text-center">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="bg-[#1a1f2d]">
                        {loading ? (
                            <TableRow className="border-[#2a3142]">
                                <TableCell colSpan={7} className="h-24 text-center">
                                    <div className="flex items-center justify-center text-muted-foreground font-bold italic">
                                        <Loader2 className="w-6 h-6 animate-spin mr-2 text-primary" />
                                        Calculando métricas de performance...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : stats.length === 0 ? (
                            <TableRow className="border-[#2a3142]">
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground font-black uppercase italic tracking-tighter opacity-50">
                                    Nenhum alerta encontrado no histórico.
                                </TableCell>
                            </TableRow>
                        ) : (
                            stats
                                .filter(row => {
                                    if (hideInactive && !row.active) return false;
                                    if (hideEmpty && row.total_alerts === 0) return false;
                                    return true;
                                })
                                .sort((a, b) => {
                                    if (!sortField) return 0;
                                    const aValue = a[sortField];
                                    const bValue = b[sortField];

                                    if (typeof aValue === 'string' && typeof bValue === 'string') {
                                        return sortDirection === 'asc'
                                            ? aValue.localeCompare(bValue)
                                            : bValue.localeCompare(aValue);
                                    }

                                    const valA = (aValue as number) || 0;
                                    const valB = (bValue as number) || 0;

                                    return sortDirection === 'asc'
                                        ? valA - valB
                                        : valB - valA;
                                })
                                .map((row) => {
                                    const ht = getRates(row.ht_greens, row.ht_reds);
                                    const o15 = getRates(row.o15_greens, row.o15_reds);
                                    const isExpanded = expandedRows[row.variation_id];

                                    return (
                                        <React.Fragment key={row.variation_id}>
                                            <TableRow
                                                className="border-[#2a3142] cursor-pointer hover:bg-[#1e2333]/50 transition-colors h-14"
                                                onClick={() => toggleRow(row.variation_id)}
                                            >
                                                <TableCell>
                                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                                                </TableCell>
                                                <TableCell className="font-bold text-white">
                                                    <div className="flex items-center">
                                                        <Target className="w-4 h-4 mr-2 text-zinc-500" />
                                                        {row.variation_name}
                                                    </div>
                                                </TableCell>

                                                {/* HT ROI */}
                                                <TableCell className="text-center font-mono">
                                                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", row.ht_roi >= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10")}>
                                                        {row.ht_roi.toFixed(1)}%
                                                    </span>
                                                    <div className="text-[9px] text-zinc-500 mt-0.5">{row.ht_greens}/{ht.total}</div>
                                                </TableCell>

                                                {/* HT Profit */}
                                                <TableCell className="text-center">
                                                    <span className={cn("font-mono font-black", row.ht_profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                                                        {row.ht_profit >= 0 ? '+' : ''}{(row.ht_profit / STAKE).toFixed(2)}u
                                                    </span>
                                                </TableCell>

                                                {/* O1.5 ROI */}
                                                <TableCell className="text-center font-mono">
                                                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", row.o15_roi >= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10")}>
                                                        {row.o15_roi.toFixed(1)}%
                                                    </span>
                                                    <div className="text-[9px] text-zinc-500 mt-0.5">{row.o15_greens}/{o15.total}</div>
                                                </TableCell>

                                                {/* O1.5 Profit */}
                                                <TableCell className="text-center">
                                                    <span className={cn("font-mono font-black", row.o15_profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                                                        {row.o15_profit >= 0 ? '+' : ''}{(row.o15_profit / STAKE).toFixed(2)}u
                                                    </span>
                                                </TableCell>

                                                {!isMobile && (
                                                    <TableCell className="text-center">
                                                        <span className={cn("font-mono font-bold text-xs opacity-60", row.total_profit >= 0 ? "text-emerald-500" : "text-red-500")}>
                                                            {(row.total_profit / STAKE).toFixed(2)}u
                                                        </span>
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-violet-400 hover:text-violet-300 hover:bg-violet-400/10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setAiVariationId(row.variation_id);

                                                                // Trigger generation immediately for this variation
                                                                const allGames = row.games.filter((g: any) => !g.is_discarded);
                                                                const totalGreens = row.ht_greens + row.o15_greens;
                                                                const totalReds = row.ht_reds + row.o15_reds;
                                                                const totalOps = totalGreens + totalReds;

                                                                const redGames = allGames.filter((g: any) =>
                                                                    g.goal_ht_result === 'red' || g.over15_result === 'red'
                                                                );

                                                                const leagueEntries = Object.values(row.leagues) as LeagueStat[];

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
                                                                    variationName: row.variation_name,
                                                                    metrics: {
                                                                        total: totalOps,
                                                                        greens: totalGreens,
                                                                        reds: totalReds,
                                                                        winRate: totalOps > 0 ? (totalGreens / totalOps) * 100 : 0,
                                                                        profit: row.total_profit / STAKE,
                                                                        avgOdd: 0,
                                                                    },
                                                                    methodBreakdown: {
                                                                        ht: {
                                                                            greens: row.ht_greens,
                                                                            reds: row.ht_reds,
                                                                            profit: row.ht_profit / STAKE,
                                                                            roi: row.ht_roi,
                                                                        },
                                                                        o15: {
                                                                            greens: row.o15_greens,
                                                                            reds: row.o15_reds,
                                                                            profit: row.o15_profit / STAKE,
                                                                            roi: row.o15_roi,
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
                                                                        min_minute: row.min_minute,
                                                                        max_minute: row.max_minute,
                                                                        min_expected_goals: row.min_expected_goals,
                                                                        min_corners: row.min_corners,
                                                                        min_shots_insidebox: row.min_shots_insidebox,
                                                                        min_shots_on_target: row.min_shots_on_target,
                                                                        min_combined_shots: row.min_combined_shots,
                                                                        min_possession: row.min_possession,
                                                                        min_lambda_total: row.min_lambda_total,
                                                                        min_over15_pre: row.min_over15_pre,
                                                                    },
                                                                    oddRangeStats: [],
                                                                    recentTrend: Object.entries(dayMap)
                                                                        .sort(([a], [b]) => b.localeCompare(a))
                                                                        .slice(0, 10)
                                                                        .map(([date, d]) => ({ date, ...d })),
                                                                };

                                                                generateReport(input);
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            title="Gerar Diagnóstico AI"
                                                        >
                                                            <Brain className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedVariationForChart(row);
                                                                setIsChartModalOpen(true);
                                                            }}
                                                            title="Ver Gráfico de Evolução"
                                                        >
                                                            <TrendingUp className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedVariationForRanking(row);
                                                                setIsRankingModalOpen(true);
                                                            }}
                                                            title="Ver Ranking de Ligas"
                                                        >
                                                            <Trophy className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {isExpanded && (
                                                <TableRow className="border-[#2a3142] bg-[#141824]/50">
                                                    <TableCell colSpan={7} className="p-6">
                                                        <div className="space-y-8">
                                                            {/* ROI Cards Separated by Method */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                {/* HT Panel */}
                                                                <div className="bg-[#1e2333] border border-[#2a3142]/80 p-5 rounded-xl space-y-4">
                                                                    <div className="flex items-center justify-between border-b border-[#2a3142] pb-3">
                                                                        <div className="text-xs uppercase font-black text-emerald-400 tracking-tighter">MÉTODO: GOL HT</div>
                                                                        <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-500 bg-emerald-500/5">ODD 2.00</Badge>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <div className="text-[9px] uppercase text-zinc-500 font-bold mb-1">Lucro HT</div>
                                                                            <div className={cn("text-2xl font-black font-mono", row.ht_profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                                                                                {row.ht_profit >= 0 ? '+' : ''}{(row.ht_profit / STAKE).toFixed(2)}u
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-[9px] uppercase text-zinc-500 font-bold mb-1">Retorno (ROI) HT</div>
                                                                            <div className={cn("text-2xl font-black font-mono", row.ht_roi >= 0 ? "text-blue-400" : "text-red-400")}>
                                                                                {row.ht_roi.toFixed(1)}%
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-[10px] text-zinc-500 flex justify-between">
                                                                        <span>Volume: {ht.total} entradas</span>
                                                                        <span className="font-bold text-zinc-300">WR: {ht.rate}%</span>
                                                                    </div>
                                                                </div>

                                                                {/* O1.5 Panel */}
                                                                <div className="bg-[#1e2333] border border-[#2a3142]/80 p-5 rounded-xl space-y-4">
                                                                    <div className="flex items-center justify-between border-b border-[#2a3142] pb-3">
                                                                        <div className="text-xs uppercase font-black text-blue-400 tracking-tighter">MÉTODO: OVER 1.5</div>
                                                                        <Badge variant="outline" className="text-[10px] font-mono border-blue-500/30 text-blue-500 bg-blue-500/5">ODD 1.60</Badge>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <div className="text-[9px] uppercase text-zinc-500 font-bold mb-1">Lucro O1.5</div>
                                                                            <div className={cn("text-2xl font-black font-mono", row.o15_profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                                                                                {row.o15_profit >= 0 ? '+' : ''}{(row.o15_profit / STAKE).toFixed(2)}u
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-[9px] uppercase text-zinc-500 font-bold mb-1">Retorno (ROI) Over 1.5</div>
                                                                            <div className={cn("text-2xl font-black font-mono", row.o15_roi >= 0 ? "text-blue-400" : "text-red-400")}>
                                                                                {row.o15_roi.toFixed(1)}%
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-[10px] text-zinc-500 flex justify-between">
                                                                        <span>Volume: {o15.total} entradas</span>
                                                                        <span className="font-bold text-zinc-300">WR: {o15.rate}%</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Leagues summary with separation */}
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                                                        <Globe className="w-4 h-4 mr-2" /> Top Ligas por Método
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedVariationForRanking(row);
                                                                            setIsRankingModalOpen(true);
                                                                        }}
                                                                        className="text-[10px] font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-tighter"
                                                                    >
                                                                        Ver Todas
                                                                    </button>
                                                                </div>
                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                    {/* Best HT Leagues */}
                                                                    <div className="rounded border border-[#2a3142] overflow-hidden">
                                                                        <div className="bg-[#1e2333] px-3 py-1.5 text-[9px] font-black text-emerald-400 border-b border-[#2a3142]">TOP LIGAS - HT</div>
                                                                        <div className="p-2 space-y-1">
                                                                            {Object.values(row.leagues).sort((a, b) => b.ht_profit - a.ht_profit).slice(0, 3).map(l => (
                                                                                <div key={l.league_name} className="flex justify-between items-center text-[10px] h-6 px-1 hover:bg-white/5 rounded">
                                                                                    <span className="text-zinc-400 truncate max-w-[150px]">{l.league_name}</span>
                                                                                    <span className={cn("font-mono font-bold", l.ht_profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                                                                                        {l.ht_profit >= 0 ? '+' : ''}{(l.ht_profit / STAKE).toFixed(1)}u
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    {/* Best O1.5 Leagues */}
                                                                    <div className="rounded border border-[#2a3142] overflow-hidden">
                                                                        <div className="bg-[#1e2333] px-3 py-1.5 text-[9px] font-black text-blue-400 border-b border-[#2a3142]">TOP LIGAS - OVER 1.5</div>
                                                                        <div className="p-2 space-y-1">
                                                                            {Object.values(row.leagues).sort((a, b) => b.o15_profit - a.o15_profit).slice(0, 3).map(l => (
                                                                                <div key={l.league_name} className="flex justify-between items-center text-[10px] h-6 px-1 hover:bg-white/5 rounded">
                                                                                    <span className="text-zinc-400 truncate max-w-[150px]">{l.league_name}</span>
                                                                                    <span className={cn("font-mono font-bold", l.o15_profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                                                                                        {l.o15_profit >= 0 ? '+' : ''}{(l.o15_profit / STAKE).toFixed(1)}u
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Full History */}
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
                                                                        <Clock className="w-4 h-4 mr-2" /> Histórico de Entradas
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setShowDiscarded(!showDiscarded)}
                                                                        className={cn(
                                                                            "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-colors border",
                                                                            showDiscarded
                                                                                ? "bg-zinc-100 text-zinc-900 border-zinc-200"
                                                                                : "bg-[#1e2333] text-zinc-500 border-[#2a3142] hover:text-zinc-300"
                                                                        )}
                                                                    >
                                                                        {showDiscarded ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                                                        {showDiscarded ? "OCULTAR DESCARTADOS" : "VER DESCARTADOS"}
                                                                    </button>
                                                                </div>
                                                                {groupGamesByDate(row.games.filter(g => showDiscarded || !g.is_discarded)).map(([date, games]) => (
                                                                    <div key={date} className="space-y-2">
                                                                        <div className="flex items-center text-[10px] font-bold text-zinc-400 uppercase border-l-2 border-primary pl-2">
                                                                            {format(parseISO(date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                            {games.map(g => (
                                                                                <div key={g.id} className={cn(
                                                                                    "bg-[#1e2333]/40 border rounded-lg p-3 flex flex-col gap-2 relative group hover:border-[#3b82f6]/30 transition-all",
                                                                                    g.is_discarded ? "opacity-50 grayscale border-dashed border-red-500/30" : "border-[#2a3142]"
                                                                                )}>
                                                                                    <div className="flex justify-between items-start">
                                                                                        <span className="text-[9px] text-zinc-500 font-bold">
                                                                                            {format(parseISO(g.created_at), 'HH:mm')}
                                                                                            {formatGameMinute(g.minute_at_alert)}
                                                                                            {g.is_discarded && " (DESCARTADO)"}
                                                                                        </span>
                                                                                        <div className="flex gap-2 items-center">
                                                                                            {!g.is_discarded && (
                                                                                                <button
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        if (editingAlertId === g.id) {
                                                                                                            setEditingAlertId(null);
                                                                                                        } else {
                                                                                                            startEditing(g);
                                                                                                        }
                                                                                                    }}
                                                                                                    className={cn(
                                                                                                        "opacity-0 group-hover:opacity-100 transition-all p-1",
                                                                                                        editingAlertId === g.id ? "text-primary" : "text-zinc-600 hover:text-white"
                                                                                                    )}
                                                                                                    title="Editar odds deste alerta"
                                                                                                >
                                                                                                    {editingAlertId === g.id ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                                                                                                </button>
                                                                                            )}

                                                                                            {g.is_discarded ? (
                                                                                                <button
                                                                                                    onClick={(e) => { e.stopPropagation(); handleRestore(g.id); }}
                                                                                                    className="text-emerald-500 hover:text-emerald-400 transition-all p-1"
                                                                                                    title="Restaurar este alerta"
                                                                                                >
                                                                                                    <RotateCcw className="w-3 h-3" />
                                                                                                </button>
                                                                                            ) : (
                                                                                                <button
                                                                                                    onClick={(e) => { e.stopPropagation(); handleDiscard(g.id); }}
                                                                                                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1"
                                                                                                    title="Descartar este alerta"
                                                                                                >
                                                                                                    <Ban className="w-3 h-3" />
                                                                                                </button>
                                                                                            )}
                                                                                            <div className="flex gap-1">
                                                                                                {g.goal_ht_result === 'green' && <Badge className="bg-emerald-500 text-[8px] h-3 px-1 rounded-sm">HT</Badge>}
                                                                                                {g.over15_result === 'green' && <Badge className="bg-blue-500 text-[8px] h-3 px-1 rounded-sm">O1.5</Badge>}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-xs font-black text-white truncate uppercase tracking-tight">{g.home_team} x {g.away_team}</div>

                                                                                    {editingAlertId === g.id ? (
                                                                                        <div className="flex flex-col gap-2 bg-[#141824] p-2 rounded border border-[#3b82f6]/30 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                                <div>
                                                                                                    <label className="text-[7px] text-zinc-500 uppercase font-bold block mb-1">Odd HT</label>
                                                                                                    <input
                                                                                                        type="number"
                                                                                                        step="0.01"
                                                                                                        value={editHtOdd}
                                                                                                        onChange={(e) => setEditHtOdd(e.target.value)}
                                                                                                        className="w-full bg-[#1e2333] border border-[#2a3142] rounded px-1.5 py-1 text-[10px] text-white focus:outline-none focus:border-primary/50"
                                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                                    />
                                                                                                </div>
                                                                                                <div>
                                                                                                    <label className="text-[7px] text-zinc-500 uppercase font-bold block mb-1">Odd O1.5</label>
                                                                                                    <input
                                                                                                        type="number"
                                                                                                        step="0.01"
                                                                                                        value={editO15Odd}
                                                                                                        onChange={(e) => setEditO15Odd(e.target.value)}
                                                                                                        className="w-full bg-[#1e2333] border border-[#2a3142] rounded px-1.5 py-1 text-[10px] text-white focus:outline-none focus:border-primary/50"
                                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                                    />
                                                                                                </div>
                                                                                            </div>
                                                                                            <button
                                                                                                onClick={(e) => { e.stopPropagation(); handleUpdateOdds(g.id); }}
                                                                                                className="w-full bg-primary hover:bg-primary/90 text-[9px] font-black py-1 rounded flex items-center justify-center gap-1 transition-colors"
                                                                                            >
                                                                                                <Save className="w-3 h-3" /> SALVAR ODDS
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="flex gap-2 mt-1">
                                                                                            <div className={cn("flex flex-col relative", g.is_ht_discarded && "opacity-30")}>
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <span className="text-[7px] text-zinc-500 uppercase font-bold">HT</span>
                                                                                                    <button
                                                                                                        onClick={(e) => { e.stopPropagation(); handleToggleMethodDiscard(g.id, 'ht', !!g.is_ht_discarded); }}
                                                                                                        className="text-zinc-600 hover:text-zinc-400 p-0.5"
                                                                                                        title={g.is_ht_discarded ? "Ativar HT" : "Desativar HT"}
                                                                                                    >
                                                                                                        {g.is_ht_discarded ? <Eye className="w-2 h-2" /> : <EyeOff className="w-2 h-2" />}
                                                                                                    </button>
                                                                                                </div>
                                                                                                <span className={cn("text-[10px] font-mono font-bold", g.is_ht_discarded ? "text-zinc-500 line-through" : "text-emerald-400")}>
                                                                                                    @{(g.custom_odd_ht || DEFAULT_ODD_HT).toFixed(2)}
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className={cn("flex flex-col border-l border-[#2a3142] pl-2", g.is_o15_discarded && "opacity-30")}>
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <span className="text-[7px] text-zinc-500 uppercase font-bold">O1.5</span>
                                                                                                    <button
                                                                                                        onClick={(e) => { e.stopPropagation(); handleToggleMethodDiscard(g.id, 'o15', !!g.is_o15_discarded); }}
                                                                                                        className="text-zinc-600 hover:text-zinc-400 p-0.5"
                                                                                                        title={g.is_o15_discarded ? "Ativar O1.5" : "Desativar O1.5"}
                                                                                                    >
                                                                                                        {g.is_o15_discarded ? <Eye className="w-2 h-2" /> : <EyeOff className="w-2 h-2" />}
                                                                                                    </button>
                                                                                                </div>
                                                                                                <span className={cn("text-[10px] font-mono font-bold", g.is_o15_discarded ? "text-zinc-500 line-through" : "text-blue-400")}>
                                                                                                    @{(g.custom_odd_o15 || DEFAULT_ODD_O15).toFixed(2)}
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    <div className="flex justify-between items-center mt-1 border-t border-[#2a3142] pt-2">
                                                                                        <div className="flex flex-col">
                                                                                            <span className="text-[8px] text-zinc-500 truncate max-w-[80px] uppercase font-bold">{g.league_name}</span>
                                                                                            <span className="text-[9px] font-mono text-zinc-400 font-black">{g.final_score || '0x0'}</span>
                                                                                        </div>
                                                                                        <div className="text-right">
                                                                                            <div className={cn("text-[10px] font-mono font-black", g.totalProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                                                                                                {g.totalProfit >= 0 ? '+' : ''}{(g.totalProfit / STAKE).toFixed(2)}u
                                                                                            </div>
                                                                                            <div className="text-[8px] text-zinc-600">Lucro {g.is_ht_discarded || g.is_o15_discarded ? 'Ajustado' : 'Total'}</div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Equity Curve Chart Modal */}
            <Dialog open={isChartModalOpen} onOpenChange={setIsChartModalOpen}>
                <DialogContent className="bg-[#141824] border-[#2a3142] text-white max-w-4xl h-[80vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                            Curva de Patrimônio - {selectedVariationForChart?.variation_name}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 text-xs">
                            Evolução do lucro acumulado (unidades) ao longo do tempo para esta variação.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 p-6 pt-2">
                        {selectedVariationForChart && (
                            <div className="h-full w-full bg-[#1e2333]/50 rounded-xl border border-[#2a3142] p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={(() => {
                                            let currentProfit = 0;
                                            const sortedGames = [...selectedVariationForChart.games]
                                                .filter(g => !g.is_discarded)
                                                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                                            return [
                                                { date: 'Início', profit: 0 },
                                                ...sortedGames.map(g => {
                                                    currentProfit += (g.totalProfit || 0) / STAKE;
                                                    return {
                                                        date: format(parseISO(g.created_at), 'dd/MM HH:mm'),
                                                        profit: Number(currentProfit.toFixed(2))
                                                    };
                                                })
                                            ];
                                        })()}
                                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#71717a"
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                            minTickGap={30}
                                        />
                                        <YAxis
                                            stroke="#71717a"
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}u`}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e2333', borderColor: '#2a3142', fontSize: '12px' }}
                                            itemStyle={{ color: '#60a5fa' }}
                                            formatter={(value: number) => [`${value > 0 ? '+' : ''}${value} units`, 'Lucro Acumulado']}
                                        />
                                        <ReferenceLine y={0} stroke="#4b5563" strokeWidth={1} />
                                        <Area
                                            type="monotone"
                                            dataKey="profit"
                                            stroke="#60a5fa"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorProfit)"
                                            animationDuration={1000}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
