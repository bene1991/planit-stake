import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Loader2, Settings2, ChevronDown, FlaskConical, TrendingUp, Trash2, Calendar, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLay0x1Weights, type Lay0x1Weights } from '@/hooks/useLay0x1Weights';
import { useLay0x1Analyses } from '@/hooks/useLay0x1Analyses';
import { useLay0x1BlockedLeagues } from '@/hooks/useLay0x1BlockedLeagues';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { Lay0x1ScoreCard } from './Lay0x1ScoreCard';
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
}

const CACHE_KEY_PREFIX = 'lay0x1_results_';
const CACHE_META_PREFIX = 'lay0x1_meta_';
const CACHE_CONTEXT_KEY = 'lay0x1_last_context';

function getCachedResults(date: string): AnalysisResult[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + date);
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch { return null; }
}

/** Safe localStorage write with LRU pruning on quota error */
function setCachedResults(date: string, results: AnalysisResult[], meta?: any) {
  const writeData = () => {
    localStorage.setItem(CACHE_KEY_PREFIX + date, JSON.stringify({ data: results, ts: Date.now() }));
    if (meta) localStorage.setItem(CACHE_META_PREFIX + date, JSON.stringify({ data: meta, ts: Date.now() }));
  };
  try {
    writeData();
  } catch {
    // Storage full — prune oldest Lay0x1 caches and retry
    try {
      pruneLay0x1Cache();
      writeData();
    } catch {
      toast.error('Armazenamento local cheio. Limpe caches antigos manualmente.');
    }
  }
}

/** Remove oldest Lay0x1 cache entries to free space */
function pruneLay0x1Cache() {
  const entries: { key: string; ts: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(CACHE_KEY_PREFIX) || key.startsWith(CACHE_META_PREFIX))) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}');
        entries.push({ key, ts: parsed.ts || 0 });
      } catch {
        entries.push({ key, ts: 0 });
      }
    }
  }
  // Sort oldest first and remove up to 10 entries
  entries.sort((a, b) => a.ts - b.ts);
  const toRemove = entries.slice(0, Math.min(10, entries.length));
  toRemove.forEach(e => localStorage.removeItem(e.key));
  if (toRemove.length > 0) {
    toast.info(`Cache antigo limpo automaticamente (${toRemove.length} entradas)`);
  }
}

function getCachedMeta(date: string): any {
  try {
    const raw = localStorage.getItem(CACHE_META_PREFIX + date);
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch { return null; }
}

function saveLastContext(selectedDate: string, rangeMode: RangeMode | null) {
  try {
    localStorage.setItem(CACHE_CONTEXT_KEY, JSON.stringify({ selectedDate, rangeMode, ts: Date.now() }));
  } catch { /* ignore */ }
}

function getLastContext(): { selectedDate: string; rangeMode: RangeMode | null } | null {
  try {
    const raw = localStorage.getItem(CACHE_CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

interface RangeMode {
  label: string;
  days: number;
}

interface AggregatedData {
  results: AnalysisResult[];
  analyzedDays: number;
  totalDays: number;
  missingDates: string[];
}

function getAggregatedResults(days: number): AggregatedData {
  const now = getNowInBrasilia();
  const allResults: AnalysisResult[] = [];
  let analyzedDays = 0;
  const missingDates: string[] = [];

  for (let i = 1; i <= days; i++) {
    const dateStr = format(subDays(now, i), 'yyyy-MM-dd');
    const cached = getCachedResults(dateStr);
    if (cached) {
      allResults.push(...cached);
      analyzedDays++;
    } else {
      missingDates.push(dateStr);
    }
  }

  return { results: allResults, analyzedDays, totalDays: days, missingDates };
}

export const Lay0x1Scanner = () => {
  const { weights, saveWeights } = useLay0x1Weights();
  const { analyses, saveAnalysis } = useLay0x1Analyses();
  const { blockedNames, blockLeague } = useLay0x1BlockedLeagues();
  const { games, addGame } = useSupabaseGames();
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const todayStr = useMemo(() => format(getNowInBrasilia(), 'yyyy-MM-dd'), []);

  // Restore last context on mount
  const lastContext = useMemo(() => getLastContext(), []);
  const [selectedDate, setSelectedDate] = useState(lastContext?.selectedDate || todayStr);
  const [rangeMode, setRangeMode] = useState<RangeMode | null>(lastContext?.rangeMode || null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sendingPlanningId, setSendingPlanningId] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [rangeData, setRangeData] = useState<AggregatedData | null>(null);
  const [analyzingMissing, setAnalyzingMissing] = useState(false);
  const [missingProgress, setMissingProgress] = useState({ current: 0, total: 0 });
  const [savingBacktest, setSavingBacktest] = useState(false);

  // Set of fixture IDs already in planning
  const planningFixtureIds = useMemo(() => 
    new Set(games.map(g => g.api_fixture_id).filter(Boolean)),
    [games]
  );

  const rangeShortcuts = useMemo(() => [
    { label: '7d', days: 7 },
    { label: '15d', days: 15 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
  ], []);

  const isBacktest = !rangeMode && selectedDate < todayStr;

  // Persist context whenever date/range changes
  useEffect(() => {
    saveLastContext(selectedDate, rangeMode);
  }, [selectedDate, rangeMode]);

  // Load from cache on date change (single day mode only)
  // Accept cached !== null (even if empty array) as valid cache
  useEffect(() => {
    if (rangeMode) return;
    const cached = getCachedResults(selectedDate);
    if (cached !== null) {
      setResults(cached);
      setMeta(getCachedMeta(selectedDate));
    } else {
      setResults([]);
      setMeta(null);
    }
  }, [selectedDate, rangeMode]);

  // Load aggregated data when entering range mode
  useEffect(() => {
    if (!rangeMode) {
      setRangeData(null);
      return;
    }
    const data = getAggregatedResults(rangeMode.days);
    setRangeData(data);
    setResults(data.results);
  }, [rangeMode]);

  const handleRangeClick = useCallback((shortcut: { label: string; days: number }) => {
    setRangeMode(shortcut);
  }, []);

  const handleSingleDateClick = useCallback((date: string) => {
    setRangeMode(null);
    setRangeData(null);
    setSelectedDate(date);
  }, []);

  const clearCache = useCallback(() => {
    if (rangeMode) {
      const now = getNowInBrasilia();
      for (let i = 1; i <= rangeMode.days; i++) {
        const dateStr = format(subDays(now, i), 'yyyy-MM-dd');
        localStorage.removeItem(CACHE_KEY_PREFIX + dateStr);
        localStorage.removeItem(CACHE_META_PREFIX + dateStr);
      }
      const data = getAggregatedResults(rangeMode.days);
      setRangeData(data);
      setResults(data.results);
      toast.success(`Cache limpo para últimos ${rangeMode.days} dias`);
    } else {
      localStorage.removeItem(CACHE_KEY_PREFIX + selectedDate);
      localStorage.removeItem(CACHE_META_PREFIX + selectedDate);
      setResults([]);
      setMeta(null);
      toast.success('Cache limpo para ' + selectedDate);
    }
  }, [selectedDate, rangeMode]);

  // Backtest stats (works for both single day and range mode)
  const backtestStats = useMemo(() => {
    const isBacktestContext = rangeMode || isBacktest;
    if (!isBacktestContext || results.length === 0) return null;
    const approved = results.filter(r => r.approved);
    const finished = approved.filter(r => r.fixture_status && ['FT', 'AET', 'PEN'].includes(r.fixture_status));
    const greens = finished.filter(r => !(r.final_score_home === 0 && r.final_score_away === 1));
    const reds = finished.filter(r => r.final_score_home === 0 && r.final_score_away === 1);
    const winRate = finished.length > 0 ? (greens.length / finished.length) * 100 : 0;
    return { total: approved.length, finished: finished.length, greens: greens.length, reds: reds.length, winRate };
  }, [isBacktest, rangeMode, results]);

  const analyzeMissingDays = useCallback(async () => {
    if (!rangeData || rangeData.missingDates.length === 0) return;
    setAnalyzingMissing(true);
    const missing = rangeData.missingDates;
    setMissingProgress({ current: 0, total: missing.length });

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast.error('Faça login para usar o scanner');
        return;
      }

      const PARALLEL_DATES = 5; // Aumentado de 3 para 5 para maior velocidade
      for (let i = 0; i < missing.length; i += PARALLEL_DATES) {
        const batch = missing.slice(i, i + PARALLEL_DATES);
        setMissingProgress({ current: Math.min(i + PARALLEL_DATES, missing.length), total: missing.length });

        const promises = batch.map(dateStr =>
          supabase.functions.invoke('analyze-lay0x1', {
            body: { date: dateStr },
          }).then(res => ({ dateStr, res, error: null }))
            .catch(error => ({ dateStr, res: null, error }))
        );

        const results = await Promise.all(promises);
        for (const { dateStr, res, error } of results) {
          if (error) {
            console.error(`Erro ao analisar ${dateStr}:`, error);
            continue;
          }
          if (res && !res.error && res.data?.results) {
            const analysisResults: AnalysisResult[] = res.data.results;
            const resMeta = {
              total_fixtures: res.data.total_fixtures || 0,
              pre_filtered: res.data.pre_filtered || 0,
              analyzed: res.data.analyzed || 0,
            };
            setCachedResults(dateStr, analysisResults, resMeta);
          }
        }
      }

      // Refresh aggregated data
      if (rangeMode) {
        const data = getAggregatedResults(rangeMode.days);
        setRangeData(data);
        setResults(data.results);
      }

      toast.success(`${missing.length} dia(s) analisado(s) com sucesso`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao analisar dias faltantes');
    } finally {
      setAnalyzingMissing(false);
      setMissingProgress({ current: 0, total: 0 });
    }
  }, [rangeData, rangeMode]);

  const analyzeGames = useCallback(async () => {
    setLoading(true);
    setResults([]);
    setMeta(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast.error('Faça login para usar o scanner');
        return;
      }

      const res = await supabase.functions.invoke('analyze-lay0x1', {
        body: { date: selectedDate },
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
            league: r.league,
            date: r.date,
            score_value: r.score_value,
            classification: r.classification,
            criteria_snapshot: r.criteria,
            weights_snapshot: weights,
          });
          if (result && !result.error) savedCount++;
        }

        const skipped = approvedResults.length - toSave.length;
        if (savedCount > 0) {
          toast.success(`${savedCount} jogo(s) aprovado(s) salvo(s) automaticamente${skipped > 0 ? ` (${skipped} já existiam)` : ''}`);
        } else if (approvedResults.length > 0 && skipped === approvedResults.length) {
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
    }
  }, [selectedDate, weights, analyses, saveAnalysis, isBacktest]);

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
    });
    setResults(prev => {
      const updated = prev.map(r =>
        r.fixture_id === result.fixture_id ? { ...r, approved: true } : r
      );
      // Persist using the correct key:
      // - In single-day mode, use selectedDate (current view context)
      // - In range mode, persist per fixture date to avoid corrupting other days
      if (rangeMode) {
        // Only update the cache for this specific fixture's date
        const dayResults = updated.filter(r => r.date === result.date);
        setCachedResults(result.date, dayResults);
      } else {
        setCachedResults(selectedDate, updated);
      }
      return updated;
    });
    toast.success('Análise salva!');
    setSavingId(null);
  };

  const handleSendToPlanning = async (result: AnalysisResult) => {
    setSendingPlanningId(result.fixture_id);
    try {
      // Find "Lay 0x1" method
      const { data: userMethods } = await supabase
        .from('methods')
        .select('id, name')
        .ilike('name', '%lay%0x1%')
        .limit(1);
      
      const methodOps = userMethods && userMethods.length > 0
        ? [{ methodId: userMethods[0].id, operationType: 'Lay' as const }]
        : [];

      await addGame({
        date: result.date,
        time: result.time || '00:00',
        league: result.league,
        homeTeam: result.home_team,
        awayTeam: result.away_team,
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

  const handleWeightChange = (key: keyof Lay0x1Weights, value: number) => {
    saveWeights({ [key]: value });
  };

  // Filter out blocked leagues from display
  const filteredResults = useMemo(() => 
    results.filter(r => !blockedNames.includes(r.league)),
    [results, blockedNames]
  );

  const approvedResults = filteredResults.filter(r => r.approved);
  const rejectedResults = filteredResults.filter(r => !r.approved);

  // Group results by league for Fulltrader-style rendering
  const groupByLeague = useCallback((items: AnalysisResult[]): [string, AnalysisResult[]][] => {
    const map = new Map<string, AnalysisResult[]>();
    for (const item of items) {
      const key = item.league;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, []);

  const saveBacktestForCalibration = useCallback(async () => {
    const approved = filteredResults.filter(r => r.approved);
    if (approved.length === 0) { toast.info('Nenhum aprovado para salvar'); return; }
    setSavingBacktest(true);
    const existingFixtureIds = new Set(analyses.map(a => a.fixture_id));
    let saved = 0;
    for (const r of approved) {
      if (existingFixtureIds.has(r.fixture_id)) continue;
      
      // Check if game has final score (backtest data)
      const hasResult = r.final_score_home != null && r.final_score_away != null;
      const was0x1 = hasResult ? (r.final_score_home === 0 && r.final_score_away === 1) : undefined;
      const result = hasResult ? (was0x1 ? 'Red' : 'Green') : undefined;

      const res = await saveAnalysis({
        fixture_id: r.fixture_id, home_team: r.home_team, away_team: r.away_team,
        league: r.league, date: r.date, score_value: r.score_value,
        classification: r.classification, criteria_snapshot: r.criteria, weights_snapshot: weights,
        ...(hasResult ? {
          final_score_home: r.final_score_home,
          final_score_away: r.final_score_away,
          was_0x1: was0x1,
          result,
          resolved_at: new Date().toISOString(),
        } : {}),
      });
      if (res && !res.error) saved++;
    }
    
    if (saved > 0) {
      toast.success(`${saved} jogo(s) salvos para calibração${saved > 0 ? ' (com resultado)' : ''}`);
      
      // Check if we should trigger auto-calibration
      const resolvedCount = analyses.filter(a => a.result).length + saved;
      if (resolvedCount > 0 && resolvedCount % 30 === 0) {
        toast.info('🔄 Recalibração automática iniciada...', { duration: 3000 });
        try {
          const calRes = await supabase.functions.invoke('calibrate-lay0x1');
          if (calRes.data?.error) {
            toast.error('Erro na recalibração: ' + calRes.data.error);
          } else {
            const aiUsed = calRes.data?.ai_recommendations ? ' (com IA)' : '';
            toast.success(`✅ Recalibração #${calRes.data?.cycle || '?'} concluída${aiUsed}!`, {
              description: `Taxa geral: ${calRes.data?.general_rate || 0}%${calRes.data?.auto_actions?.length ? ` • ${calRes.data.auto_actions.length} ação(ões) automática(s)` : ''}`,
              duration: 6000,
            });
          }
        } catch {
          toast.error('Erro na recalibração automática');
        }
      }
    } else {
      toast.info('Todos já estavam salvos');
    }
    setSavingBacktest(false);
  }, [filteredResults, analyses, saveAnalysis, weights]);

  const getBacktestResult = (r: AnalysisResult) => {
    if ((!isBacktest && !rangeMode) || r.final_score_home == null || r.final_score_away == null) return undefined;
    return {
      scoreHome: r.final_score_home,
      scoreAway: r.final_score_away,
      was0x1: r.final_score_home === 0 && r.final_score_away === 1,
    };
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          {/* Date shortcuts */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Button
              variant={!rangeMode && selectedDate === format(subDays(getNowInBrasilia(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => handleSingleDateClick(format(subDays(getNowInBrasilia(), 1), 'yyyy-MM-dd'))}
            >
              Ontem
            </Button>
            {rangeShortcuts.map(s => (
              <Button
                key={s.label}
                variant={rangeMode?.days === s.days ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
                onClick={() => handleRangeClick(s)}
              >
                {s.label}
              </Button>
            ))}
            <Button
              variant={!rangeMode && selectedDate === todayStr ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => handleSingleDateClick(todayStr)}
            >
              Hoje
            </Button>
          </div>

          {!rangeMode && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => { setRangeMode(null); setSelectedDate(e.target.value); }}
                className="w-full sm:w-auto"
              />
              <Button onClick={analyzeGames} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isBacktest ? <FlaskConical className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                {loading ? 'Analisando...' : isBacktest ? 'Backtest' : 'Analisar Jogos do Dia'}
              </Button>
              {results.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCache} className="gap-1 text-xs text-muted-foreground">
                  <Trash2 className="w-3 h-3" /> Limpar cache
                </Button>
              )}
            </div>
          )}

          {isBacktest && !rangeMode && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">
                <FlaskConical className="w-3 h-3 mr-1" /> Modo Backtest
              </Badge>
              <span className="text-xs text-muted-foreground">Jogos não serão salvos automaticamente</span>
            </div>
          )}

          {loading && (
            <div className="mt-3 space-y-1">
              <Progress value={undefined} className="h-2" />
              <p className="text-xs text-muted-foreground">Buscando jogos, filtrando por odds e analisando em lotes paralelos... (até 2 min)</p>
            </div>
          )}

          {!loading && !rangeMode && meta && (
            <p className="text-xs text-muted-foreground mt-2">
              {meta.total_fixtures} jogos no dia → {meta.pre_filtered} com odd casa &lt; visitante → {approvedResults.length} aprovados
            </p>
          )}
        </CardContent>
      </Card>

      {/* Range Mode Summary */}
      {rangeMode && rangeData && (
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  Últimos {rangeMode.days} dias
                  <span className="text-muted-foreground font-normal ml-1">
                    ({rangeData.analyzedDays}/{rangeData.totalDays} analisados)
                  </span>
                </h3>
              </div>
              {(rangeData.analyzedDays > 0) && (
                <Button variant="ghost" size="sm" onClick={clearCache} className="gap-1 text-xs text-muted-foreground">
                  <Trash2 className="w-3 h-3" /> Limpar cache
                </Button>
              )}
            </div>

            {rangeData.missingDates.length > 0 && (
              <div className="mb-3">
                <Button
                  onClick={analyzeMissingDays}
                  disabled={analyzingMissing}
                  size="sm"
                  variant="outline"
                  className="gap-2 text-xs"
                >
                  {analyzingMissing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Analisando {missingProgress.current}/{missingProgress.total}...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="w-3 h-3" />
                      Analisar {rangeData.missingDates.length} dia(s) faltante(s)
                    </>
                  )}
                </Button>
                {analyzingMissing && (
                  <Progress value={(missingProgress.current / missingProgress.total) * 100} className="h-1.5 mt-2" />
                )}
              </div>
            )}

            {backtestStats && backtestStats.finished > 0 && (
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold">{backtestStats.total}</p>
                  <p className="text-xs text-muted-foreground">Aprovados</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-400">{backtestStats.greens}</p>
                  <p className="text-xs text-muted-foreground">Green</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-400">{backtestStats.reds}</p>
                  <p className="text-xs text-muted-foreground">Red</p>
                </div>
                <div>
                  <p className={`text-lg font-bold ${backtestStats.winRate >= 70 ? 'text-emerald-400' : backtestStats.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {backtestStats.winRate.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                </div>
              </div>
            )}

            {backtestStats && backtestStats.finished < backtestStats.total && backtestStats.total > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {backtestStats.total - backtestStats.finished} jogo(s) sem placar final disponível
              </p>
            )}

            {rangeData.analyzedDays === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum dia analisado ainda. Clique no botão acima para analisar.</p>
            )}

            {(rangeMode || isBacktest) && approvedResults.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2 text-xs mt-2" disabled={savingBacktest}
                onClick={saveBacktestForCalibration}>
                {savingBacktest ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Salvar para Calibração ({approvedResults.length})
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Single day Backtest Summary */}
      {!rangeMode && isBacktest && backtestStats && backtestStats.finished > 0 && (
        <Card className="border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-semibold">Resultado do Backtest</h3>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-lg font-bold">{backtestStats.total}</p>
                <p className="text-xs text-muted-foreground">Aprovados</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-400">{backtestStats.greens}</p>
                <p className="text-xs text-muted-foreground">Green</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-400">{backtestStats.reds}</p>
                <p className="text-xs text-muted-foreground">Red</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${backtestStats.winRate >= 70 ? 'text-emerald-400' : backtestStats.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {backtestStats.winRate.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">Win Rate</p>
              </div>
            </div>
            {backtestStats.finished < backtestStats.total && (
              <p className="text-xs text-muted-foreground mt-2">
                {backtestStats.total - backtestStats.finished} jogo(s) sem placar final disponível
              </p>
            )}
            {approvedResults.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2 text-xs mt-2" disabled={savingBacktest}
                onClick={saveBacktestForCalibration}>
                {savingBacktest ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Salvar para Calibração ({approvedResults.length})
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settings */}
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
                <Label className="text-xs">Mín. gols mandante (casa): {weights.min_home_goals_avg}</Label>
                <Slider value={[weights.min_home_goals_avg]} min={0.5} max={3} step={0.1}
                  onValueChange={([v]) => handleWeightChange('min_home_goals_avg', v)} />
              </div>
              <div>
                <Label className="text-xs">Mín. gols sofridos visitante (fora): {weights.min_away_conceded_avg}</Label>
                <Slider value={[weights.min_away_conceded_avg]} min={0.5} max={3} step={0.1}
                  onValueChange={([v]) => handleWeightChange('min_away_conceded_avg', v)} />
              </div>
              <div>
                <Label className="text-xs">Máx. odd visitante: {weights.max_away_odd}</Label>
                <Slider value={[weights.max_away_odd]} min={2} max={8} step={0.1}
                  onValueChange={([v]) => handleWeightChange('max_away_odd', v)} />
              </div>
              <div>
                <Label className="text-xs">Mín. Over 1.5 combinado: {weights.min_over15_combined}%</Label>
                <Slider value={[weights.min_over15_combined]} min={30} max={150} step={5}
                  onValueChange={([v]) => handleWeightChange('min_over15_combined', v)} />
              </div>
              <div>
                <Label className="text-xs">Máx. 0x1 no H2H: {weights.max_h2h_0x1}</Label>
                <Slider value={[weights.max_h2h_0x1]} min={0} max={3} step={1}
                  onValueChange={([v]) => handleWeightChange('max_h2h_0x1', v)} />
              </div>
              <div className="sm:col-span-2 p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  ⚡ <strong>Critério fixo:</strong> Odd da casa sempre deve ser menor que a do visitante (pré-filtro automático)
                </p>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Results — grouped by league, Fulltrader style */}
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
                      <Lay0x1ScoreCard
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
                        onSave={!isBacktest && !rangeMode ? () => handleSave(r) : undefined}
                        saving={savingId === r.fixture_id}
                        backtestResult={getBacktestResult(r)}
                        onBlockLeague={(name) => blockLeague(name, 'nao_disponivel')}
                        onSendToPlanning={!isBacktest && !rangeMode ? () => handleSendToPlanning(r) : undefined}
                        sendingToPlanning={sendingPlanningId === r.fixture_id}
                        alreadyInPlanning={planningFixtureIds.has(r.fixture_id)}
                        homeOdd={r.criteria?.home_odd}
                        drawOdd={r.criteria?.draw_odd}
                        awayOdd={r.criteria?.away_odd}
                        homeTeamLogo={r.home_team_logo}
                        awayTeamLogo={r.away_team_logo}
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
                          <Lay0x1ScoreCard
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
                            onSendToPlanning={!isBacktest && !rangeMode ? () => handleSendToPlanning(r) : undefined}
                            sendingToPlanning={sendingPlanningId === r.fixture_id}
                            alreadyInPlanning={planningFixtureIds.has(r.fixture_id)}
                            homeOdd={r.criteria?.home_odd}
                            drawOdd={r.criteria?.draw_odd}
                            awayOdd={r.criteria?.away_odd}
                            homeTeamLogo={r.home_team_logo}
                            awayTeamLogo={r.away_team_logo}
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

      {/* Empty state — no cache and not loading */}
      {!loading && results.length === 0 && !rangeMode && (
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
  );
};
