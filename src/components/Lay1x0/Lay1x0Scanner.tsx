import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Loader2, ChevronDown, TrendingUp, Trash2, Calendar, Send, BarChart3, Settings2 } from 'lucide-react';
import { FixtureDetailPanel } from '@/components/PreMatchAnalysis/FixtureDetailPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { useLay1x0Analyses } from '@/hooks/useLay1x0Analyses';
import { useLay0x1BlockedLeagues } from '@/hooks/useLay0x1BlockedLeagues';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { Lay1x0ScoreCard } from './Lay1x0ScoreCard';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { getNowInBrasilia } from '@/utils/timezone';

interface AnalysisResult {
    fixture_id: string;
    home_team: string;
    away_team: string;
    home_team_logo?: string;
    away_team_logo?: string;
    league: string;
    date: string;
    time: string;
    approved: boolean;
    score_value: number;
    classification: string;
    criteria: any;
    reasons: string[];
    final_score_home?: number;
    final_score_away?: number;
    fixture_status?: string;
    is_backtest: boolean;
}

const CACHE_KEY_PREFIX = 'lay1x0_results_';
const CACHE_META_PREFIX = 'lay1x0_meta_';

function getCachedResults(date: string): AnalysisResult[] | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY_PREFIX + date);
        if (!raw) return null;
        return JSON.parse(raw).data;
    } catch { return null; }
}

function setCachedResults(date: string, results: AnalysisResult[], meta?: any) {
    try {
        localStorage.setItem(CACHE_KEY_PREFIX + date, JSON.stringify({ data: results, ts: Date.now() }));
        if (meta) localStorage.setItem(CACHE_META_PREFIX + date, JSON.stringify({ data: meta, ts: Date.now() }));
    } catch {
        // Storage full
    }
}

function getCachedMeta(date: string): any {
    try {
        const raw = localStorage.getItem(CACHE_META_PREFIX + date);
        if (!raw) return null;
        return JSON.parse(raw).data;
    } catch { return null; }
}

interface Lay1x0Weights {
    min_away_goals_avg: number;
    min_home_conceded_avg: number;
    max_home_odd: number;
    min_over15_combined: number;
    max_h2h_1x0: number;
}

const DEFAULT_WEIGHTS: Lay1x0Weights = {
    min_away_goals_avg: 1.2,
    min_home_conceded_avg: 1.0,
    max_home_odd: 5.0,
    min_over15_combined: 65,
    max_h2h_1x0: 1,
};

export const Lay1x0Scanner = () => {
    const { analyses, saveAnalysis } = useLay1x0Analyses();
    const { blockedNames, blockLeague } = useLay0x1BlockedLeagues();
    const { games, addGame } = useSupabaseGames();
    const { settings } = useSettings();
    const [results, setResults] = useState<AnalysisResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [sendingTelegram, setSendingTelegram] = useState(false);
    const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
    const isMobile = useIsMobile();
    const todayStr = useMemo(() => format(getNowInBrasilia(), 'yyyy-MM-dd'), []);
    const isAnalyzingRef = useRef(false);

    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [sendingPlanningId, setSendingPlanningId] = useState<string | null>(null);
    const [meta, setMeta] = useState<any>(null);
    const [weights, setWeights] = useState<Lay1x0Weights>(DEFAULT_WEIGHTS);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const handleWeightChange = (key: keyof Lay1x0Weights, value: number) => {
        setWeights(prev => ({ ...prev, [key]: value }));
    };

    const planningFixtureIds = useMemo(() =>
        new Set(games.map(g => g.api_fixture_id).filter(Boolean)),
        [games]
    );

    const isBacktest = selectedDate < todayStr;

    // Load from cache on date change
    useEffect(() => {
        if (isAnalyzingRef.current) return;
        const cached = getCachedResults(selectedDate);
        if (cached !== null) {
            setResults(cached);
            setMeta(getCachedMeta(selectedDate));
        } else {
            setResults([]);
            setMeta(null);
        }
    }, [selectedDate]);

    const clearCache = useCallback(() => {
        localStorage.removeItem(CACHE_KEY_PREFIX + selectedDate);
        localStorage.removeItem(CACHE_META_PREFIX + selectedDate);
        setResults([]);
        setMeta(null);
        toast.success('Cache limpo para ' + selectedDate);
    }, [selectedDate]);

    // Backtest stats
    const backtestStats = useMemo(() => {
        if (!isBacktest || results.length === 0) return null;
        const approved = results.filter(r => r.approved);
        const finished = approved.filter(r => r.fixture_status && ['FT', 'AET', 'PEN'].includes(r.fixture_status));
        const greens = finished.filter(r => !(r.final_score_home === 1 && r.final_score_away === 0));
        const reds = finished.filter(r => r.final_score_home === 1 && r.final_score_away === 0);
        const winRate = finished.length > 0 ? (greens.length / finished.length) * 100 : 0;
        return { total: approved.length, finished: finished.length, greens: greens.length, reds: reds.length, winRate };
    }, [isBacktest, results]);

    const analyzeGames = useCallback(async () => {
        setLoading(true);
        isAnalyzingRef.current = true;
        setResults([]);
        setMeta(null);
        try {
            const { data: session } = await supabase.auth.getSession();
            if (!session?.session) {
                toast.error('Faça login para usar o scanner');
                return;
            }

            const res = await supabase.functions.invoke('analyze-lay1x0', {
                body: { date: selectedDate, is_backtest: isBacktest, weights },
            });

            if (res.error) {
                toast.error('Erro na análise');
                console.error(res.error);
                return;
            }

            const analysisResults: AnalysisResult[] = res.data?.results || [];
            const resMeta = {
                total_fixtures: res.data?.total_fixtures || 0,
                pre_filtered: res.data?.pre_filtered || 0,
                analyzed: res.data?.analyzed || 0,
            };

            setResults(analysisResults);
            setMeta(resMeta);
            setCachedResults(selectedDate, analysisResults, resMeta);

            if (!isBacktest) {
                const approvedResults = analysisResults.filter(r => r.approved);
                const existingFixtureIds = new Set(analyses.map(a => a.fixture_id));
                const toSave = approvedResults.filter(r => !existingFixtureIds.has(r.fixture_id));

                let savedCount = 0;
                for (const r of toSave) {
                    const result = await saveAnalysis({
                        fixture_id: r.fixture_id,
                        home_team: r.home_team,
                        away_team: r.away_team,
                        home_team_logo: r.home_team_logo,
                        away_team_logo: r.away_team_logo,
                        league: r.league,
                        date: r.date,
                        score_value: r.score_value,
                        classification: r.classification,
                        criteria_snapshot: r.criteria,
                        weights_snapshot: weights,
                        source_list: 'lista_padrao',
                    }, true);
                    if (result) savedCount++;
                }

                if (savedCount > 0) {
                    toast.success(`${savedCount} jogo(s) aprovado(s) salvo(s)`);
                } else if (approvedResults.length > 0) {
                    toast.info(`${approvedResults.length} aprovado(s) já estavam salvos`);
                } else {
                    toast.success(`${resMeta.total_fixtures} jogos analisados → 0 aprovados`);
                }
            } else {
                const approved = analysisResults.filter(r => r.approved).length;
                toast.success(`Backtest: ${resMeta.total_fixtures} jogos → ${approved} aprovados`);
            }
        } catch (err) {
            console.error(err);
            toast.error('Erro na análise');
        } finally {
            setLoading(false);
            setTimeout(() => { isAnalyzingRef.current = false; }, 500);
        }
    }, [selectedDate, analyses, saveAnalysis, isBacktest, weights]);

    const handleSave = async (result: AnalysisResult) => {
        setSavingId(result.fixture_id);
        await saveAnalysis({
            fixture_id: result.fixture_id,
            home_team: result.home_team,
            away_team: result.away_team,
            league: result.league,
            date: result.date,
            score_value: result.score_value,
            classification: result.classification,
            criteria_snapshot: result.criteria,
            weights_snapshot: weights,
            is_backtest: result.is_backtest,
            source_list: 'lista_padrao',
        });

        if (!result.is_backtest) {
            await handleSendToPlanning(result);
        }

        toast.success('Análise salva no Dashboard Lay 1x0!');
        setSavingId(null);
    };

    const handleSendToPlanning = async (result: AnalysisResult) => {
        setSendingPlanningId(result.fixture_id);
        try {
            const { data: userMethods } = await supabase
                .from('methods')
                .select('id, name')
                .ilike('name', '%lay 1x0 sistema%')
                .limit(1);

            // Fallback: if exact name not found, try any method with lay + 1x0
            let methodId = userMethods?.[0]?.id;
            if (!methodId) {
                const { data: fallback } = await supabase
                    .from('methods')
                    .select('id, name')
                    .ilike('name', '%lay%1x0%')
                    .limit(1);
                methodId = fallback?.[0]?.id;
            }

            const methodOps = methodId
                ? [{ methodId, operationType: 'Lay' as const }]
                : [];

            await addGame({
                date: result.date,
                time: result.time || '00:00',
                league: result.league,
                homeTeam: result.home_team,
                awayTeam: result.away_team,
                homeTeamLogo: result.home_team_logo,
                awayTeamLogo: result.away_team_logo,
                api_fixture_id: result.fixture_id,
                methodOperations: methodOps,
            });
            toast.success('Jogo enviado para o planejamento!');
        } catch {
            toast.error('Erro ao enviar para planejamento');
        } finally {
            setSendingPlanningId(null);
        }
    };

    // Telegram
    const handleSendTelegram = useCallback(async () => {
        if (!settings?.telegram_bot_token || !settings?.telegram_chat_id) {
            toast.error('Configure o Telegram em Conta → Configurações');
            return;
        }
        const approved = results.filter(r => r.approved);
        if (approved.length === 0) return;

        setSendingTelegram(true);
        try {
            let msg = '📊 LAY 1x0 — JOGOS APROVADOS\n';
            msg += `📅 ${selectedDate}\n`;
            approved.forEach((g, i) => {
                msg += `\n${i + 1}. 🏟 ${g.home_team} x ${g.away_team}`;
                msg += `\n📍 ${g.league}`;
                if (g.time) msg += ` • ⏰ ${g.time}`;
                msg += `\n🎯 Score: ${g.score_value} (${g.classification})`;
                msg += `\n💰 Odd casa: ${g.criteria?.home_odd?.toFixed(2) || '—'}`;
                msg += '\n';
            });
            msg += '\n⚙️ Entrada somente com jogo em 0x0';

            const teleRes = await fetch(`https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: settings.telegram_chat_id, text: msg, parse_mode: 'HTML' }),
            });

            if (teleRes.ok) toast.success('Enviado para o Telegram!');
            else toast.error('Erro ao enviar para o Telegram');
        } catch {
            toast.error('Erro ao enviar para o Telegram');
        } finally {
            setSendingTelegram(false);
        }
    }, [results, settings, selectedDate]);

    // Filter out blocked leagues
    const filteredResults = useMemo(() =>
        results.filter(r => !blockedNames.includes(r.league)),
        [results, blockedNames]
    );

    const approvedResults = filteredResults.filter(r => r.approved);
    const rejectedResults = filteredResults.filter(r => !r.approved);

    const getBacktestResult = (r: AnalysisResult) => {
        if (!isBacktest || r.final_score_home === undefined || r.final_score_away === undefined) return undefined;
        return {
            scoreHome: r.final_score_home,
            scoreAway: r.final_score_away,
            was1x0: r.final_score_home === 1 && r.final_score_away === 0,
        };
    };

    const groupByLeague = (items: AnalysisResult[]) => {
        const sorted = [...items].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        const map = new Map<string, AnalysisResult[]>();
        sorted.forEach(r => {
            const arr = map.get(r.league) || [];
            arr.push(r);
            map.set(r.league, arr);
        });
        return Array.from(map.entries()).sort((a, b) => {
            const timeA = a[1][0]?.time || '';
            const timeB = b[1][0]?.time || '';
            return timeA.localeCompare(timeB);
        });
    };

    return (
        <div className={cn('grid gap-4', !isMobile && 'grid-cols-[1fr_380px]')}>
            <div className="space-y-4">
                {/* Controls */}
                <Card>
                    <CardContent className="p-3 space-y-3">
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="flex-1 text-sm"
                            />
                            <Button onClick={analyzeGames} disabled={loading} size="sm" className="gap-2">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                {loading ? 'Analisando...' : isBacktest ? 'Backtest' : 'Analisar'}
                            </Button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(todayStr)} className="text-xs h-7">
                                <Calendar className="w-3 h-3 mr-1" /> Hoje
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(format(subDays(getNowInBrasilia(), 1), 'yyyy-MM-dd'))} className="text-xs h-7">
                                Ontem
                            </Button>
                            <div className="flex-1" />
                            {results.length > 0 && (
                                <>
                                    <Button variant="ghost" size="sm" onClick={clearCache} className="text-xs h-7 text-muted-foreground">
                                        <Trash2 className="w-3 h-3 mr-1" /> Limpar
                                    </Button>
                                    {approvedResults.length > 0 && (
                                        <Button variant="ghost" size="sm" onClick={handleSendTelegram} disabled={sendingTelegram} className="text-xs h-7 text-blue-400">
                                            <Send className="w-3 h-3 mr-1" /> Telegram
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Loading */}
                {loading && (
                    <Card>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">Analisando jogos Lay 1x0...</span>
                            </div>
                            <Progress value={50} className="h-1" />
                        </CardContent>
                    </Card>
                )}

                {/* Meta info */}
                {meta && !loading && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground px-1">
                        <span>{meta.total_fixtures} jogos</span>
                        <span>→ {meta.pre_filtered} pré-filtrados</span>
                        <span>→ {meta.analyzed} analisados</span>
                        <span className="text-emerald-400 font-semibold">
                            {approvedResults.length} aprovados
                        </span>
                    </div>
                )}

                {/* Backtest Stats */}
                {backtestStats && (
                    <Card className="border-yellow-500/30">
                        <CardContent className="p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="w-4 h-4 text-yellow-400" />
                                <span className="text-sm font-semibold text-yellow-400">
                                    Backtest {selectedDate}
                                </span>
                            </div>
                            <div className="grid grid-cols-5 gap-2 text-center text-xs">
                                <div>
                                    <p className="text-muted-foreground">Total</p>
                                    <p className="font-bold">{backtestStats.total}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Finalizados</p>
                                    <p className="font-bold">{backtestStats.finished}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Greens</p>
                                    <p className="font-bold text-emerald-400">{backtestStats.greens}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Reds</p>
                                    <p className="font-bold text-red-400">{backtestStats.reds}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Win Rate</p>
                                    <p className="font-bold">{backtestStats.winRate.toFixed(1)}%</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Criteria Settings */}
                <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground">
                            <span className="flex items-center gap-2"><Settings2 className="w-4 h-4" /> Ajustar Critérios</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <Card>
                            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs">Mín. gols visitante (fora): {weights.min_away_goals_avg}</Label>
                                    <Slider value={[weights.min_away_goals_avg]} min={0.5} max={3} step={0.1}
                                        onValueChange={([v]) => handleWeightChange('min_away_goals_avg', v)} />
                                </div>
                                <div>
                                    <Label className="text-xs">Mín. gols sofridos mandante (casa): {weights.min_home_conceded_avg}</Label>
                                    <Slider value={[weights.min_home_conceded_avg]} min={0.5} max={3} step={0.1}
                                        onValueChange={([v]) => handleWeightChange('min_home_conceded_avg', v)} />
                                </div>
                                <div>
                                    <Label className="text-xs">Máx. odd casa: {weights.max_home_odd}</Label>
                                    <Slider value={[weights.max_home_odd]} min={1.5} max={8} step={0.1}
                                        onValueChange={([v]) => handleWeightChange('max_home_odd', v)} />
                                </div>
                                <div>
                                    <Label className="text-xs">Mín. Over 1.5 combinado: {weights.min_over15_combined}%</Label>
                                    <Slider value={[weights.min_over15_combined]} min={30} max={150} step={5}
                                        onValueChange={([v]) => handleWeightChange('min_over15_combined', v)} />
                                </div>
                                <div>
                                    <Label className="text-xs">Máx. 1x0 no H2H: {weights.max_h2h_1x0}</Label>
                                    <Slider value={[weights.max_h2h_1x0]} min={0} max={3} step={1}
                                        onValueChange={([v]) => handleWeightChange('max_h2h_1x0', v)} />
                                </div>
                                <div className="sm:col-span-2 p-2 rounded bg-muted/50">
                                    <p className="text-xs text-muted-foreground">
                                        ⚡ <strong>Critério fixo:</strong> Odd do visitante sempre deve ser menor que a da casa (pré-filtro automático)
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </CollapsibleContent>
                </Collapsible>

                {/* Results */}
                {!loading && results.length > 0 && (
                    <>
                        {approvedResults.length > 0 && (
                            <div className="space-y-1">
                                <h3 className="text-sm font-semibold text-emerald-400 mb-2">
                                    ✅ Aprovados ({approvedResults.length})
                                </h3>
                                {groupByLeague(approvedResults).map(([leagueName, leagueResults]) => (
                                    <div key={leagueName}>
                                        <div className="flex items-center gap-2 px-1 py-1.5">
                                            <span className="text-xs font-semibold text-muted-foreground">{leagueName}</span>
                                            <div className="flex-1 h-px bg-border/30" />
                                        </div>
                                        <div className="space-y-1">
                                            {leagueResults.map(r => (
                                                <Lay1x0ScoreCard
                                                    key={r.fixture_id}
                                                    homeTeam={r.home_team}
                                                    awayTeam={r.away_team}
                                                    league={r.league}
                                                    time={r.time}
                                                    scoreValue={r.score_value}
                                                    classification={r.classification}
                                                    approved={r.approved}
                                                    criteria={r.criteria}
                                                    reasons={r.reasons}
                                                    onSave={!isBacktest ? () => handleSave(r) : undefined}
                                                    saving={savingId === r.fixture_id}
                                                    backtestResult={getBacktestResult(r)}
                                                    onBlockLeague={(name) => blockLeague(name, 'nao_disponivel')}
                                                    onSendToPlanning={!isBacktest ? () => handleSendToPlanning(r) : undefined}
                                                    sendingToPlanning={sendingPlanningId === r.fixture_id}
                                                    alreadyInPlanning={planningFixtureIds.has(r.fixture_id)}
                                                    homeOdd={r.criteria?.home_odd}
                                                    drawOdd={r.criteria?.draw_odd}
                                                    awayOdd={r.criteria?.away_odd}
                                                    homeTeamLogo={r.home_team_logo}
                                                    awayTeamLogo={r.away_team_logo}
                                                    onSelect={() => setSelectedResult(r)}
                                                    isSelected={selectedResult?.fixture_id === r.fixture_id}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {rejectedResults.length > 0 && (
                            <Collapsible>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground">
                                        <span>❌ Reprovados ({rejectedResults.length})</span>
                                        <ChevronDown className="w-4 h-4" />
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="space-y-1 mt-2">
                                        {groupByLeague(rejectedResults).map(([leagueName, leagueResults]) => (
                                            <div key={leagueName}>
                                                <div className="flex items-center gap-2 px-1 py-1.5">
                                                    <span className="text-xs font-semibold text-muted-foreground">{leagueName}</span>
                                                    <div className="flex-1 h-px bg-border/30" />
                                                </div>
                                                <div className="space-y-1">
                                                    {leagueResults.map(r => (
                                                        <Lay1x0ScoreCard
                                                            key={r.fixture_id}
                                                            homeTeam={r.home_team}
                                                            awayTeam={r.away_team}
                                                            league={r.league}
                                                            time={r.time}
                                                            scoreValue={r.score_value}
                                                            classification={r.classification}
                                                            approved={r.approved}
                                                            criteria={r.criteria}
                                                            reasons={r.reasons}
                                                            backtestResult={getBacktestResult(r)}
                                                            onForceAdd={() => handleSave(r)}
                                                            forceAdding={savingId === r.fixture_id}
                                                            onBlockLeague={(name) => blockLeague(name, 'nao_disponivel')}
                                                            homeOdd={r.criteria?.home_odd}
                                                            drawOdd={r.criteria?.draw_odd}
                                                            awayOdd={r.criteria?.away_odd}
                                                            homeTeamLogo={r.home_team_logo}
                                                            awayTeamLogo={r.away_team_logo}
                                                            onSelect={() => setSelectedResult(r)}
                                                            isSelected={selectedResult?.fixture_id === r.fixture_id}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}
                    </>
                )}

                {/* Empty state */}
                {!loading && results.length === 0 && (
                    <Card className="border-dashed border-muted-foreground/30">
                        <CardContent className="p-6 text-center space-y-3">
                            <Search className="w-8 h-8 mx-auto text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground">
                                Nenhuma busca salva para <strong>{selectedDate}</strong>
                            </p>
                            <Button onClick={analyzeGames} disabled={loading} size="sm" className="gap-2">
                                <Search className="w-4 h-4" />
                                {isBacktest ? 'Rodar Backtest' : 'Analisar Jogos do Dia'}
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* RIGHT COLUMN - Detail panel (desktop only) */}
            {!isMobile && (
                <div className="border border-border/50 rounded-lg overflow-hidden bg-card h-full">
                    {selectedResult?.fixture_id ? (
                        <FixtureDetailPanel
                            fixtureId={selectedResult.fixture_id}
                            homeTeam={selectedResult.home_team}
                            awayTeam={selectedResult.away_team}
                            homeTeamLogo={selectedResult.home_team_logo}
                            awayTeamLogo={selectedResult.away_team_logo}
                            league={selectedResult.league}
                            time={selectedResult.time}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                            <BarChart3 className="h-12 w-12 opacity-30" />
                            <p className="text-sm">Selecione um jogo para ver a análise</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
