import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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

const playSuccessSound = () => {
    try {
        const audio = new Audio('/sounds/notification-success.mp3');
        audio.play().catch(e => console.warn('Audio play blocked:', e));
    } catch (e) {
        console.warn('Audio play failed:', e);
    }
};

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

    const [monthFilter, setMonthFilter] = useState<string>("all");
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

    const filteredAnalyses = useMemo(() => {
        return analyses.filter(a => {
            const analysisDate = a.date ? parseISO(a.date) : parseISO(a.created_at);
            if (monthFilter !== "all") {
                const [year, month] = monthFilter.split('-').map(Number);
                const filterStart = startOfMonth(new Date(year, month - 1));
                const filterEnd = endOfMonth(new Date(year, month - 1));
                if (!isWithinInterval(analysisDate, { start: filterStart, end: filterEnd })) return false;
            }
            if (selectedDate) {
                if (!isSameDay(analysisDate, selectedDate)) return false;
            }
            return true;
        });
    }, [analyses, monthFilter, selectedDate]);

    const monthOptions = useMemo(() => {
        const months = new Set<string>();
        analyses.forEach(a => {
            const date = a.date ? parseISO(a.date) : parseISO(a.created_at);
            months.add(format(date, 'yyyy-MM'));
        });
        return Array.from(months).sort().reverse();
    }, [analyses]);

    const groupedResolved = useMemo(() => {
        const res = filteredAnalyses.filter(a => a.result);
        const groups: Record<string, typeof res> = {};
        res.forEach(a => {
            const dateStr = a.date || a.created_at.split('T')[0];
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(a);
        });
        return Object.entries(groups).sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
    }, [filteredAnalyses]);

    const prevGreensRef = useRef<number>(0);
    useEffect(() => {
        const currentGreens = analyses.filter(a => a.result === 'Green').length;
        if (currentGreens > prevGreensRef.current && prevGreensRef.current > 0) {
            playSuccessSound();
            toast.success('Novo GOL detectado em um jogo do planejamento!');
        }
        prevGreensRef.current = currentGreens;
    }, [analyses]);

    const pendingAnalyses = useMemo(() => filteredAnalyses.filter(a => !a.result), [filteredAnalyses]);
    const totalProfit = filteredAnalyses.reduce((sum, a) => sum + (a.profit || 0), 0);

    const handleUpdateOdd = async (id: string) => {
        const val = oddInputs[id];
        if (!val) return;
        const odd = parseFloat(val.replace(',', '.'));
        if (isNaN(odd) || odd <= 1) { toast.error('ODD inválida'); return; }
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
            await Promise.all(batch.map(async (analysis) => {
                try {
                    const res = await supabase.functions.invoke('api-football', {
                        body: { endpoint: 'fixtures', params: { id: analysis.fixture_id } },
                    });
                    const fixture = res.data?.response?.[0];
                    if (!fixture) { skippedCount++; return; }
                    const status = fixture?.fixture?.status?.short;
                    const homeGoals = fixture.goals?.home ?? 0;
                    const awayGoals = fixture.goals?.away ?? 0;
                    if (['FT', 'AET', 'PEN', 'AWD', 'WO', 'ABD', 'CANC'].includes(status)) {
                        await resolveAnalysis(analysis.id, homeGoals, awayGoals);
                        resolvedCount++;
                    } else { skippedCount++; }
                } catch (err) { skippedCount++; }
                setResolveProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }));
        }
        setAutoResolving(false);
        if (resolvedCount > 0) { toast.success(`${resolvedCount} resolvido(s)`); refetch(); }
        else if (skippedCount > 0) { toast.info(`Nenhum jogo terminou (${skippedCount} pendentes)`); }
    }, [pendingAnalyses, resolveAnalysis, refetch]);

    if (loading && analyses.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <Card className="bg-secondary/20 border-border/40">
                <CardContent className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex-1 min-w-[140px]">
                            <Select value={monthFilter} onValueChange={setMonthFilter}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Filtrar por mês" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Meses</SelectItem>
                                    {monthOptions.map(m => (
                                        <SelectItem key={m} value={m}>{format(parseISO(`${m}-01`), 'MMMM yyyy', { locale: ptBR })}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className={cn("h-9 text-xs justify-start text-left font-normal w-[140px]", !selectedDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Filtrar por dia"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus locale={ptBR} />
                            </PopoverContent>
                        </Popover>

                        <div className="flex items-center gap-1">
                            {(monthFilter !== "all" || selectedDate) && (
                                <Button variant="ghost" size="sm" className="h-9 px-2 text-xs text-muted-foreground hover:text-primary" onClick={() => { setMonthFilter("all"); setSelectedDate(undefined); }}>
                                    <FilterX className="mr-2 h-3.5 w-3.5" /> Limpar
                                </Button>
                            )}
                            <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => refetch()} disabled={loading} title="Atualizar dados">
                                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className={cn("grid gap-2", isMobile ? "grid-cols-2" : "grid-cols-4")}>
                <Card><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground uppercase truncate">Total</p><p className="text-xl font-bold truncate">{metrics.total}</p></CardContent></Card>
                <Card><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground uppercase truncate">Pendentes</p><p className="text-xl font-bold text-yellow-400 truncate">{metrics.pending}</p></CardContent></Card>
                <Card><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground uppercase truncate">Win Rate</p><p className={`text-xl font-bold truncate ${metrics.winRate >= 70 ? 'text-emerald-400' : metrics.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{metrics.winRate}%</p></CardContent></Card>
                <Card><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground uppercase truncate">Lucro</p><p className={`text-xl font-bold truncate ${metrics.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{metrics.totalProfit >= 0 ? '+' : ''}{metrics.totalProfit.toFixed(0)}</p></CardContent></Card>
            </div>

            <AIDiagnosticReport
                report={aiReport} loading={aiLoading} error={aiError} onClear={clearReport} tabLabel="Lay 1x0"
                onGenerate={() => {
                    const resolvedList = filteredAnalyses.filter(a => a.result);
                    const redList = resolvedList.filter(a => a.result === 'Red');
                    const leagueMap: Record<string, any> = {};
                    resolvedList.forEach(a => {
                        const l = a.league || 'Desconhecida';
                        if (!leagueMap[l]) leagueMap[l] = { total: 0, greens: 0, reds: 0, profit: 0 };
                        leagueMap[l].total++;
                        if (a.result === 'Green') leagueMap[l].greens++; else leagueMap[l].reds++;
                        leagueMap[l].profit += (a.profit || 0) / 1000;
                    });
                    generateReport({
                        tab: 'lay1x0',
                        metrics: { ...metrics, profit: metrics.totalProfit / 1000, avgOdd: 0 },
                        redAnalysis: redList.map(a => ({ game: `${a.home_team} vs ${a.away_team}`, league: a.league, score: `${a.final_score_home ?? '?'}-${a.final_score_away ?? '?'}`, criteria: a.criteria_snapshot || {}, date: a.date || '' })),
                        leagueBreakdown: Object.entries(leagueMap).map(([name, d]: [string, any]) => ({ name, ...d, winRate: d.total > 0 ? (d.greens / d.total) * 100 : 0 })),
                        paramSnapshot: resolvedList[0]?.weights_snapshot || {},
                        oddRangeStats: [],
                        recentTrend: []
                    } as any);
                }}
            />

            {pendingAnalyses.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold">Pendentes ({pendingAnalyses.length})</h3>
                        <Button size="sm" variant="outline" className="gap-2 text-xs" disabled={autoResolving} onClick={handleAutoResolve}>
                            <RefreshCw className={`w-3.5 h-3.5 ${autoResolving ? 'animate-spin' : ''}`} />
                            {autoResolving ? `Resolvendo...` : 'Resolver Todos'}
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {pendingAnalyses.map(a => (
                            <Card key={a.id} className="hover:border-primary/50 transition-colors">
                                <CardContent className="p-3 flex flex-col gap-2">
                                    <p className="text-sm font-medium truncate">{a.home_team} vs {a.away_team}</p>
                                    <p className="text-xs text-muted-foreground">{a.league} • {a.date}</p>
                                    <div className="flex items-center gap-1.5">
                                        <Input placeholder="Odd" className="w-14 h-8 text-center text-xs" value={oddInputs[a.id] || a.odd_used || ''} onChange={e => setOddInputs(prev => ({ ...prev, [a.id]: e.target.value }))} onBlur={() => handleUpdateOdd(a.id)} />
                                        <Input placeholder="H" className="w-10 h-8 text-center text-xs" value={scoreInputs[a.id]?.home || ''} onChange={e => setScoreInputs(prev => ({ ...prev, [a.id]: { ...prev[a.id], home: e.target.value } }))} />
                                        <Input placeholder="A" className="w-10 h-8 text-center text-xs" value={scoreInputs[a.id]?.away || ''} onChange={e => setScoreInputs(prev => ({ ...prev, [a.id]: { ...prev[a.id], away: e.target.value } }))} />
                                        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={resolvingId === a.id} onClick={() => handleResolve(a.id)}>OK</Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => deleteAnalysis(a.id)}><Trash2 className="w-3.5 h-3.5 hover:text-red-400" /></Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {groupedResolved.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> Histórico de Resultados</h3>
                    <div className="space-y-6">
                        {groupedResolved.map(([date, items]) => (
                            <div key={date} className="space-y-2">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-0.5 bg-secondary/50 rounded-full border">{format(parseISO(date), "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
                                <div className="space-y-1">
                                    {items.map(a => (
                                        <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-border/40 text-xs">
                                            <span className="truncate font-medium">{a.home_team} x {a.away_team}</span>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={cn("text-[10px]", a.result === 'Green' ? 'text-emerald-400' : 'text-red-400')}>{a.result}</Badge>
                                                <span className="font-mono font-bold">{a.final_score_home}-{a.final_score_away}</span>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => unresolveAnalysis(a.id)}><Undo2 className="w-3.5 h-3.5" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
