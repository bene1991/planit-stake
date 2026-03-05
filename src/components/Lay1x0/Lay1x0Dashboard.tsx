import { useMemo, useState, useCallback } from 'react';
import { useAIDiagnosticReport, type DiagnosticInput } from '@/hooks/useAIDiagnosticReport';
import { AIDiagnosticReport } from '@/components/AIDiagnosticReport';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
    TrendingUp, TrendingDown, Target, BarChart3,
    DollarSign, RefreshCw, Trash2, Ban, Undo2, Calendar as CalendarIcon, FilterX
} from 'lucide-react';
import { useLay1x0Analyses } from '@/hooks/useLay1x0Analyses';
import { useLay0x1BlockedLeagues } from '@/hooks/useLay0x1BlockedLeagues';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, isSameDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export const Lay1x0Dashboard = () => {
    const isMobile = useIsMobile();
    const { analyses, metrics, loading, resolveAnalysis, unresolveAnalysis, updateOdd, deleteAnalysis, refetch } = useLay1x0Analyses();
    const { blockLeague, isBlocked } = useLay0x1BlockedLeagues();
    const { report: aiReport, loading: aiLoading, error: aiError, generateReport, clearReport } = useAIDiagnosticReport();

    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [scoreInputs, setScoreInputs] = useState<Record<string, { home: string; away: string }>>({});
    const [oddInputs, setOddInputs] = useState<Record<string, string>>({});
    const [autoResolving, setAutoResolving] = useState(false);
    const [resolveProgress, setResolveProgress] = useState({ current: 0, total: 0 });

    // Filters State
    const [monthFilter, setMonthFilter] = useState<string>("all");
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

    const filteredAnalyses = useMemo(() => {
        return analyses.filter(a => {
            const analysisDate = a.date ? parseISO(a.date) : parseISO(a.created_at);

            // Filter by Month
            if (monthFilter !== "all") {
                const [year, month] = monthFilter.split('-').map(Number);
                const filterStart = startOfMonth(new Date(year, month - 1));
                const filterEnd = endOfMonth(new Date(year, month - 1));
                if (!isWithinInterval(analysisDate, { start: filterStart, end: filterEnd })) {
                    return false;
                }
            }

            // Filter by Day
            if (selectedDate) {
                if (!isSameDay(analysisDate, selectedDate)) {
                    return false;
                }
            }

            return true;
        });
    }, [analyses, monthFilter, selectedDate]);

    // Generate Month Options from unique months in analyses
    const monthOptions = useMemo(() => {
        const months = new Set<string>();
        analyses.forEach(a => {
            const date = a.date ? parseISO(a.date) : parseISO(a.created_at);
            months.add(format(date, 'yyyy-MM'));
        });
        return Array.from(months).sort().reverse();
    }, [analyses]);

    const groupedResolved = useMemo(() => {
        const resolved = filteredAnalyses.filter(a => a.result);
        const groups: Record<string, typeof resolved> = {};

        resolved.forEach(a => {
            const dateStr = a.date || a.created_at.split('T')[0];
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(a);
        });

        return Object.entries(groups)
            .sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
    }, [analyses]);

    const pendingAnalyses = useMemo(() =>
        filteredAnalyses.filter(a => !a.result),
        [filteredAnalyses]
    );

    const resolved = filteredAnalyses.filter(a => a.result);
    const greens = resolved.filter(a => a.result === 'Green').length;
    const reds = resolved.filter(a => a.result === 'Red').length;
    const winRate = resolved.length > 0 ? (greens / resolved.length) * 100 : 0;
    const totalProfit = filteredAnalyses.reduce((sum, a) => sum + (a.profit || 0), 0);

    const calculatedMetrics = {
        total: filteredAnalyses.length,
        resolved: resolved.length,
        pending: filteredAnalyses.length - resolved.length,
        greens,
        reds,
        winRate: Math.round(winRate * 10) / 10,
        totalProfit: Math.round(totalProfit * 100) / 100,
    };

    const handleUpdateOdd = async (id: string) => {
        const val = oddInputs[id];
        if (!val) return;
        const odd = parseFloat(val.replace(',', '.'));
        if (isNaN(odd) || odd <= 1) {
            toast.error('ODD inválida');
            return;
        }
        await updateOdd(id, odd);
    };

    const handleResolve = async (id: string) => {
        const input = scoreInputs[id];
        if (!input?.home || !input?.away) { toast.error('Informe o placar'); return; }
        setResolvingId(id);
        const err = await resolveAnalysis(id, parseInt(input.home), parseInt(input.away));
        if (!err) toast.success('Resultado registrado!');
        else toast.error('Erro ao registrar');
        setResolvingId(null);
    };

    const handleAutoResolve = useCallback(async () => {
        if (pendingAnalyses.length === 0) return;
        setAutoResolving(true);
        setResolveProgress({ current: 0, total: pendingAnalyses.length });
        let resolvedCount = 0, skippedCount = 0;
        const BATCH_SIZE = 5;

        for (let i = 0; i < pendingAnalyses.length; i += BATCH_SIZE) {
            const batch = pendingAnalyses.slice(i, i + BATCH_SIZE);
            console.log(`[Lay 1x0] Resolvendo lote ${i / BATCH_SIZE + 1}. Tamanho: ${batch.length}`);

            await Promise.all(batch.map(async (analysis) => {
                try {
                    console.log(`[Lay 1x0] Checando fixture ${analysis.fixture_id} (${analysis.home_team} x ${analysis.away_team})`);
                    const res = await supabase.functions.invoke('api-football', {
                        body: { endpoint: 'fixtures', params: { id: analysis.fixture_id } },
                    });

                    const fixture = res.data?.response?.[0];
                    if (!fixture) {
                        console.warn(`[Lay 1x0] Fixture ${analysis.fixture_id} não encontrada na API`);
                        skippedCount++;
                        return;
                    }

                    const status = fixture?.fixture?.status?.short;
                    const homeGoals = fixture.goals?.home ?? 0;
                    const awayGoals = fixture.goals?.away ?? 0;

                    console.log(`[Lay 1x0] Status fixture ${analysis.fixture_id}: ${status} | Placar: ${homeGoals}-${awayGoals}`);

                    // Accept regular final statuses plus awarded/walkover
                    if (['FT', 'AET', 'PEN', 'AWD', 'WO', 'ABD', 'CANC'].includes(status)) {
                        await resolveAnalysis(analysis.id, homeGoals, awayGoals);
                        resolvedCount++;
                        console.log(`[Lay 1x0] ✅ Resolvido: ${analysis.id}`);
                    } else {
                        console.log(`[Lay 1x0] ⏳ Jogo ainda em andamento ou outro status: ${status}`);
                        skippedCount++;
                    }
                } catch (err) {
                    console.error(`[Lay 1x0] Erro ao processar ${analysis.fixture_id}:`, err);
                    skippedCount++;
                }
                setResolveProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }));
        }

        setAutoResolving(false);
        if (resolvedCount > 0) {
            toast.success(`${resolvedCount} resolvido(s)${skippedCount > 0 ? ` • ${skippedCount} pendentes` : ''}`);
            refetch();
        } else if (skippedCount > 0) {
            toast.info(`Nenhum jogo terminou (${skippedCount} pendentes)`);
        }
    }, [pendingAnalyses, resolveAnalysis, refetch]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <Card className="bg-secondary/20 border-border/40">
                <CardContent className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex-1 min-w-[140px]">
                            <Select value={monthFilter} onValueChange={setMonthFilter}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Filtrar por mês" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Meses</SelectItem>
                                    {monthOptions.map(m => (
                                        <SelectItem key={m} value={m}>
                                            {format(parseISO(`${m}-01`), 'MMMM yyyy', { locale: ptBR })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-9 text-xs justify-start text-left font-normal w-[140px]",
                                        !selectedDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Filtrar por dia"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    initialFocus
                                    locale={ptBR}
                                />
                            </PopoverContent>
                        </Popover>

                        {(monthFilter !== "all" || selectedDate) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 px-2 text-xs text-muted-foreground hover:text-primary"
                                onClick={() => {
                                    setMonthFilter("all");
                                    setSelectedDate(undefined);
                                }}
                            >
                                <FilterX className="mr-2 h-3.5 w-3.5" />
                                Limpar
                            </Button>
                        )}

                        {filteredAnalyses.length !== analyses.length && (
                            <div className="ml-auto">
                                <Badge variant="secondary" className="text-[10px] py-0 h-5">
                                    Mostrando {filteredAnalyses.length} de {analyses.length}
                                </Badge>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className={cn(
                "grid gap-2",
                isMobile ? "grid-cols-2" : "grid-cols-4"
            )}>
                <Card>
                    <CardContent className="p-2 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase truncate">Total</p>
                        <p className="text-xl font-bold truncate">{calculatedMetrics.total}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-2 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase truncate">Pendentes</p>
                        <p className="text-xl font-bold text-yellow-400 truncate">{calculatedMetrics.pending}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-2 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase truncate">Win Rate</p>
                        <p className={`text-xl font-bold truncate ${calculatedMetrics.winRate >= 70 ? 'text-emerald-400' : calculatedMetrics.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {calculatedMetrics.winRate}%
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-2 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase truncate">Lucro</p>
                        <p className={`text-xl font-bold truncate ${calculatedMetrics.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {calculatedMetrics.totalProfit >= 0 ? '+' : ''}{calculatedMetrics.totalProfit.toFixed(0)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Green/Red Split */}
            <div className="grid grid-cols-2 gap-3">
                <Card className="border-emerald-500/20">
                    <CardContent className="p-3 flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-emerald-400" />
                        <div>
                            <p className="text-xs text-muted-foreground">Greens</p>
                            <p className="text-xl font-bold text-emerald-400">{calculatedMetrics.greens}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-red-500/20">
                    <CardContent className="p-3 flex items-center gap-3">
                        <TrendingDown className="w-8 h-8 text-red-400" />
                        <div>
                            <p className="text-xs text-muted-foreground">Reds</p>
                            <p className="text-xl font-bold text-red-400">{calculatedMetrics.reds}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* AI Diagnostic Report */}
            <AIDiagnosticReport
                report={aiReport}
                loading={aiLoading}
                error={aiError}
                onClear={clearReport}
                tabLabel="Lay 1x0"
                onGenerate={() => {
                    const resolvedList = filteredAnalyses.filter(a => a.result);
                    const redList = resolvedList.filter(a => a.result === 'Red');

                    const leagueMap: Record<string, { total: number; greens: number; reds: number; profit: number }> = {};
                    resolvedList.forEach(a => {
                        const l = a.league || 'Desconhecida';
                        if (!leagueMap[l]) leagueMap[l] = { total: 0, greens: 0, reds: 0, profit: 0 };
                        leagueMap[l].total++;
                        if (a.result === 'Green') leagueMap[l].greens++;
                        else leagueMap[l].reds++;
                        leagueMap[l].profit += (a.profit || 0) / 1000;
                    });

                    const oddRanges: Record<string, { total: number; greens: number; reds: number; profit: number }> = {};
                    resolvedList.forEach(a => {
                        const odd = a.odd_used || 0;
                        let range = 'Sem odd';
                        if (odd > 0 && odd < 5) range = `${Math.floor(odd)}.00-${Math.floor(odd)}.99`;
                        else if (odd >= 5) range = '5.00+';
                        if (!oddRanges[range]) oddRanges[range] = { total: 0, greens: 0, reds: 0, profit: 0 };
                        oddRanges[range].total++;
                        if (a.result === 'Green') oddRanges[range].greens++;
                        else oddRanges[range].reds++;
                        oddRanges[range].profit += (a.profit || 0) / 1000;
                    });

                    const dayMap: Record<string, { greens: number; reds: number; profit: number }> = {};
                    resolvedList.forEach(a => {
                        const d = a.date || a.created_at?.split('T')[0] || '';
                        if (!dayMap[d]) dayMap[d] = { greens: 0, reds: 0, profit: 0 };
                        if (a.result === 'Green') dayMap[d].greens++;
                        else dayMap[d].reds++;
                        dayMap[d].profit += (a.profit || 0) / 1000;
                    });
                    const recentTrend = Object.entries(dayMap)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .slice(0, 10)
                        .map(([date, d]) => ({ date, ...d }));

                    const oddsUsed = resolvedList.filter(a => a.odd_used && a.odd_used > 0);
                    const avgOdd = oddsUsed.length > 0 ? oddsUsed.reduce((s, a) => s + (a.odd_used || 0), 0) / oddsUsed.length : 0;

                    const input: DiagnosticInput = {
                        tab: 'lay1x0',
                        metrics: {
                            total: resolvedList.length,
                            greens: calculatedMetrics.greens,
                            reds: calculatedMetrics.reds,
                            winRate: calculatedMetrics.winRate,
                            profit: calculatedMetrics.totalProfit / 1000,
                            avgOdd,
                        },
                        redAnalysis: redList.map(a => ({
                            game: `${a.home_team} vs ${a.away_team}`,
                            league: a.league,
                            score: `${a.final_score_home ?? '?'}-${a.final_score_away ?? '?'}`,
                            criteria: a.criteria_snapshot || {},
                            date: a.date || '',
                        })),
                        leagueBreakdown: Object.entries(leagueMap).map(([name, d]) => ({
                            name,
                            ...d,
                            winRate: d.total > 0 ? (d.greens / d.total) * 100 : 0,
                        })),
                        paramSnapshot: resolvedList[0]?.weights_snapshot || {
                            min_away_goals_avg: 1.2,
                            min_home_conceded_avg: 1.0,
                            max_home_odd: 5.0,
                            min_over15_combined: 65,
                            max_h2h_1x0: 1,
                        },
                        oddRangeStats: Object.entries(oddRanges).map(([range, d]) => ({
                            range,
                            ...d,
                            winRate: d.total > 0 ? (d.greens / d.total) * 100 : 0,
                        })),
                        recentTrend,
                    };

                    generateReport(input);
                }}
            />

            {/* Pending Section */}
            {pendingAnalyses.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold">Pendentes ({pendingAnalyses.length})</h3>
                        <Button size="sm" variant="outline" className="gap-2 text-xs" disabled={autoResolving} onClick={handleAutoResolve}>
                            <RefreshCw className={`w-3.5 h-3.5 ${autoResolving ? 'animate-spin' : ''}`} />
                            {autoResolving ? `Resolvendo ${resolveProgress.current}/${resolveProgress.total}...` : 'Resolver Todos'}
                        </Button>
                    </div>
                    {autoResolving && (
                        <Progress value={(resolveProgress.current / resolveProgress.total) * 100} className="h-1.5 mb-2" />
                    )}
                    <div className="space-y-2">
                        {pendingAnalyses.map(a => (
                            <Card key={a.id} className="cursor-pointer hover:border-primary/50 transition-colors">
                                <CardContent className="p-3 flex flex-col gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{a.home_team} vs {a.away_team}</p>
                                        <p className="text-xs text-muted-foreground">{a.league} • {a.date} • Score: {a.score_value}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <div className={cn(
                                            "flex items-center gap-1",
                                            !isMobile && "border-r pr-2"
                                        )}>
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Odd</span>
                                            <Input placeholder="0.00" className="w-14 h-8 text-center text-xs bg-emerald-500/5 border-emerald-500/20"
                                                value={oddInputs[a.id] || a.odd_used || ''}
                                                onChange={(e) => setOddInputs(prev => ({ ...prev, [a.id]: e.target.value }))}
                                                onBlur={() => handleUpdateOdd(a.id)}
                                            />
                                        </div>
                                        {isMobile && <div className="w-full h-0" />}
                                        <div className="flex items-center gap-1.5">
                                            <Input placeholder="H" className="w-10 h-8 text-center text-xs"
                                                value={scoreInputs[a.id]?.home || ''}
                                                onChange={(e) => setScoreInputs(prev => ({ ...prev, [a.id]: { ...prev[a.id], home: e.target.value } }))} />
                                            <span className="text-xs text-muted-foreground">x</span>
                                            <Input placeholder="A" className="w-10 h-8 text-center text-xs"
                                                value={scoreInputs[a.id]?.away || ''}
                                                onChange={(e) => setScoreInputs(prev => ({ ...prev, [a.id]: { ...prev[a.id], away: e.target.value } }))} />
                                            <Button size="sm" variant="outline" className="h-8 text-xs px-2"
                                                disabled={resolvingId === a.id} onClick={() => handleResolve(a.id)}>
                                                {resolvingId === a.id ? '...' : 'OK'}
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 w-10 p-0"
                                                onClick={() => deleteAnalysis(a.id)}>
                                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Resolved Grouped by Date */}
            {groupedResolved.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        Histórico de Resultados
                    </h3>
                    <div className="space-y-6">
                        {groupedResolved.map(([date, items]) => (
                            <div key={date} className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-[1px] flex-1 bg-border/50" />
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-0.5 bg-secondary/50 rounded-full border border-border/50">
                                        {format(parseISO(date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                                    </span>
                                    <div className="h-[1px] flex-1 bg-border/50" />
                                </div>
                                <div className="space-y-1">
                                    {items.map(a => (
                                        <div key={a.id} className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors hover:bg-secondary/20 ${a.result === 'Green' ? 'border-emerald-500/10 bg-emerald-500/5' : 'border-red-500/10 bg-red-500/5'}`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Badge variant="outline" className={`text-[10px] px-1 h-4 ${a.result === 'Green' ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>
                                                    {a.result}
                                                </Badge>
                                                <span className="truncate font-medium">{a.home_team} x {a.away_team}</span>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="flex items-center gap-2">
                                                    {a.final_score_home != null && (
                                                        <span className="font-mono font-bold opacity-70">{a.final_score_home}-{a.final_score_away}</span>
                                                    )}
                                                    {a.profit !== undefined && a.profit !== null && (
                                                        <span className={`font-mono font-bold ${a.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {a.profit >= 0 ? '+' : ''}{Math.round(a.profit)}
                                                        </span>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 hover:text-primary transition-colors"
                                                    title="Desfazer resolução"
                                                    onClick={() => unresolveAnalysis(a.id)}
                                                >
                                                    <Undo2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {analyses.length === 0 || filteredAnalyses.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="p-6 text-center space-y-2">
                        <Target className="w-8 h-8 mx-auto text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                            {analyses.length > 0 ? 'Nenhuma análise corresponde aos filtros' : 'Nenhuma análise Lay 1x0 registrada'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {analyses.length > 0 ? 'Tente ajustar os filtros de data' : 'Use o Scanner para analisar jogos'}
                        </p>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
};
