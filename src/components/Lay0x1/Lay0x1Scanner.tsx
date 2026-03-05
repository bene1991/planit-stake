import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Loader2, Settings2, ChevronDown, FlaskConical, TrendingUp, Trash2, Calendar, Save, Send, BarChart3 } from 'lucide-react';
import { FixtureDetailPanel } from '@/components/PreMatchAnalysis/FixtureDetailPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { useLay0x1Weights, type Lay0x1Weights } from '@/hooks/useLay0x1Weights';
import { useLay0x1Analyses } from '@/hooks/useLay0x1Analyses';
import { useLay0x1BlockedLeagues } from '@/hooks/useLay0x1BlockedLeagues';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { Lay0x1ScoreCard } from './Lay0x1ScoreCard';
import { useLay0x1RealOperations } from '@/hooks/useLay0x1RealOperations';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { getNowInBrasilia } from '@/utils/timezone';
import { evaluateIASelection, autoRelaxThresholds, type IASelectionThresholds } from '@/utils/iaSelectionFilter';
import { useIAThresholds } from '@/hooks/useIAThresholds';

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
  ia_selected?: boolean;
  ia_justification?: string;
  ia_criteria?: {
    btts_pct: number;
    over25_pct: number;
    home_clean_sheet_pct: number;
    away_clean_sheet_pct: number;
    home_goals_avg_10: number;
    away_conceded_avg_10: number;
  };
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
  const { thresholds: iaThresholds, meta: iaMeta, calibrating: iaCalibratingState, calibrate: iaCalibrateAction } = useIAThresholds();
  const { games, addGame } = useSupabaseGames();
  const { settings } = useSettings();
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [registeringRealId, setRegisteringRealId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  const isMobile = useIsMobile();
  const todayStr = useMemo(() => format(getNowInBrasilia(), 'yyyy-MM-dd'), []);

  // Guard ref to prevent cache useEffect from overwriting results after analysis
  const isAnalyzingRef = useRef(false);

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
    if (isAnalyzingRef.current) return; // Don't overwrite during/after analysis
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

      const PARALLEL_DATES = 10; // Aumentado de 5 para 10 para maior velocidade
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
    isAnalyzingRef.current = true;
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
        body: { date: selectedDate, is_backtest: isBacktest },
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
            source_list: r.ia_selected ? 'ia_selection' : 'lista_padrao',
            ia_justification: r.ia_justification,
          }, true);
          if (result) savedCount++;
        }

        const skipped = approvedResults.length - toSave.length;
        if (savedCount > 0) {
          toast.success(`${savedCount} jogo(s) aprovado(s) salvo(s) automaticamente${skipped > 0 ? ` (${skipped} já existiam)` : ''}`);
        } else if (approvedResults.length > 0 && skipped === approvedResults.length) {
          toast.info(`${approvedResults.length} aprovado(s) já estavam salvos no Dashboard Lay0x1`);
        } else if (approvedResults.length > 0 && savedCount === 0) {
          toast.error(`Atenção: Houve falha ao salvar ${approvedResults.length} jogos aprovados no banco de dados. Atualize o banco!`);
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
      // Keep guard active briefly to prevent useEffect from overwriting
      setTimeout(() => { isAnalyzingRef.current = false; }, 500);
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
      is_backtest: result.is_backtest,
      source_list: result.ia_selected ? 'ia_selection' : 'lista_padrao',
      ia_justification: result.ia_justification,
    });

    if (!result.is_backtest) {
      await handleSendToPlanning(result);
    }

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
    toast.success('Análise salva no Dashboard Lay 0x1!');
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

  const handleWeightChange = (key: keyof Lay0x1Weights, value: number) => {
    saveWeights({ [key]: value });
  };

  // Filter out blocked leagues from display
  const filteredResults = useMemo(() =>
    results.filter(r => !blockedNames.includes(r.league)),
    [results, blockedNames]
  );

  const approvedResults = filteredResults.filter(r => r.approved);

  // Smart IA Selection — fully autonomous with auto-relaxation
  const iaEvaluation = useMemo(() => {
    // Build IA inputs from available criteria
    const gameInputs = approvedResults.map(r => ({
      awayOdd: r.criteria?.away_odd || 0,
      homeGoalsAvg: r.criteria?.home_goals_avg || 0,
      awayConcededAvg: r.criteria?.away_conceded_avg || 0,
      bttsPct: r.ia_criteria?.btts_pct ?? 0,
      over25Pct: r.ia_criteria?.over25_pct ?? 0,
      homeCleanSheetPct: r.ia_criteria?.home_clean_sheet_pct ?? 0,
      awayCleanSheetPct: r.ia_criteria?.away_clean_sheet_pct ?? 0,
    }));

    // Base thresholds from DB (or defaults)
    const baseThresholds: IASelectionThresholds = {
      maxAwayOdd: iaThresholds.max_away_odd,
      minHomeGoalsAvg: iaThresholds.min_home_goals_avg,
      minAwayConcededAvg: iaThresholds.min_away_conceded_avg,
      minBttsPct: iaThresholds.min_btts_pct,
      minOver25Pct: iaThresholds.min_over25_pct,
      maxHomeCleanSheetPct: iaThresholds.max_home_clean_sheet_pct,
      maxAwayCleanSheetPct: iaThresholds.max_away_clean_sheet_pct,
    };

    // Auto-relax: if 0 games pass, IA automatically widens criteria
    const { thresholds: effectiveThresholds, relaxed, rounds } = autoRelaxThresholds(
      gameInputs,
      baseThresholds,
      Math.max(1, Math.round(gameInputs.length * 0.3)), // target: ~30% of approved
      5, // max relaxation rounds
    );

    // Evaluate every game with effective (possibly relaxed) thresholds
    const enriched = approvedResults.map((r, i) => {
      if (r.ia_selected !== undefined) return r;

      const input = gameInputs[i];
      const iaResult = evaluateIASelection(input, effectiveThresholds);

      return {
        ...r,
        ia_selected: iaResult.selected,
        ia_justification: iaResult.justification,
        ia_criteria: {
          btts_pct: input.bttsPct,
          over25_pct: input.over25Pct,
          home_clean_sheet_pct: input.homeCleanSheetPct,
          away_clean_sheet_pct: input.awayCleanSheetPct,
          home_goals_avg_10: input.homeGoalsAvg,
          away_conceded_avg_10: input.awayConcededAvg,
        },
      };
    });

    return { enriched, relaxed, rounds, effectiveThresholds };
  }, [approvedResults, iaThresholds]);

  const enrichedApproved = iaEvaluation.enriched;
  const iaSelectionResults = enrichedApproved.filter(r => r.ia_selected);
  const standardApprovedResults = enrichedApproved; // ALL approved = Filtro Padrão
  const rejectedResults = filteredResults.filter(r => !r.approved);

  // Telegram send handler for Lay 0x1 approved games
  const handleSendTelegram = useCallback(async () => {
    if (!settings?.telegram_bot_token || !settings?.telegram_chat_id) {
      toast.error('Configure o Telegram em Conta → Configurações do Telegram');
      return;
    }
    if (approvedResults.length === 0) return;

    setSendingTelegram(true);
    try {
      let msg = '📊 LAY 0x1 — JOGOS APROVADOS\n';
      msg += `📅 ${selectedDate}\n`;

      approvedResults.forEach((g, i) => {
        const oddText = g.criteria?.away_odd ? Number(g.criteria.away_odd).toFixed(2) : '—';
        msg += `\n${i + 1}. 🏟 ${g.home_team} x ${g.away_team}`;
        msg += `\n📍 ${g.league}`;
        if (g.time) msg += ` • ⏰ ${g.time}`;
        msg += `\n🎯 Score: ${g.score_value} (${g.classification})`;
        msg += `\n💰 Odd visitante: ${oddText}`;
        msg += '\n';
      });

      msg += '\n⚙️ Entrada somente com jogo em 0x0';

      const response = await fetch(
        `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: settings.telegram_chat_id, text: msg }),
        }
      );
      const data = await response.json();
      if (data.ok) {
        toast.success('✅ Enviado ao Telegram!');
      } else {
        toast.error('Erro do Telegram: ' + data.description);
      }
    } catch (err: any) {
      toast.error('Erro ao enviar: ' + (err.message || 'Desconhecido'));
    } finally {
      setSendingTelegram(false);
    }
  }, [approvedResults, selectedDate, settings]);

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
          is_backtest: true,
        } : {
          is_backtest: true,
        }),
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
    <div className={cn('grid gap-4', !isMobile && 'grid-cols-[1fr_380px]')}>
      <div className="space-y-4">
        {/* Search Bar */}
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => { setRangeMode(null); setSelectedDate(e.target.value); }}
                className="flex-1 text-sm"
              />
              <Button onClick={analyzeGames} disabled={loading} size="sm" className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? 'Analisando...' : isBacktest ? 'Backtest' : 'Analisar'}
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={!rangeMode && selectedDate === todayStr ? 'default' : 'ghost'}
                size="sm"
                className="text-xs h-7"
                onClick={() => handleSingleDateClick(todayStr)}
              >
                <Calendar className="w-3 h-3 mr-1" /> Hoje
              </Button>
              <Button
                variant={!rangeMode && selectedDate === format(subDays(getNowInBrasilia(), 1), 'yyyy-MM-dd') ? 'default' : 'ghost'}
                size="sm"
                className="text-xs h-7"
                onClick={() => handleSingleDateClick(format(subDays(getNowInBrasilia(), 1), 'yyyy-MM-dd'))}
              >
                Ontem
              </Button>
              <div className="flex-1" />
              {results.length > 0 && (
                <>
                  <Button variant="ghost" size="sm" onClick={clearCache} className="text-xs h-7 text-muted-foreground mr-1">
                    <Trash2 className="w-3 h-3 mr-1" /> Limpar
                  </Button>
                  {!isBacktest && !rangeMode && approvedResults.length > 0 && (
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
                <span className="text-sm text-muted-foreground">Analisando jogos Lay 0x1...</span>
              </div>
              <Progress value={50} className="h-1" />
            </CardContent>
          </Card>
        )}

        {/* Meta info */}
        {meta && !loading && !rangeMode && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground px-1 flex-wrap">
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
          <Card className="border-yellow-500/30 mt-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-semibold text-yellow-400">
                  Backtest {rangeMode ? `últimos ${rangeMode.days} dias` : selectedDate}
                </span>
              </div>
              <div className={cn(
                "grid gap-2 text-center text-xs",
                isMobile ? "grid-cols-3" : "grid-cols-5"
              )}>
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
              {(rangeMode || isBacktest) && approvedResults.length > 0 && (
                <Button variant="outline" size="sm" className="w-full gap-2 text-[10px] mt-4" disabled={savingBacktest}
                  onClick={saveBacktestForCalibration}>
                  {savingBacktest ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Salvar para Calib.
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
            {standardApprovedResults.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-emerald-400 mb-2">
                  ✅ Aprovados ({standardApprovedResults.length})
                </h3>
                {groupByLeague(standardApprovedResults).map(([leagueName, leagueResults]) => (
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
                          onSelect={() => setSelectedResult(r)}
                          isSelected={selectedResult?.fixture_id === r.fixture_id}
                          iaSelected={false}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* LIST 2: IA Selection — Independent AI-curated sub-list */}
            {iaSelectionResults.length > 0 && (
              <div className="space-y-1 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border border-cyan-500/30">
                    <span className="text-sm font-semibold text-cyan-400">🤖 IA Selection ({iaSelectionResults.length})</span>
                  </div>
                  {iaEvaluation.relaxed && (
                    <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-500/30">
                      auto-ajustada ({iaEvaluation.rounds}x)
                    </Badge>
                  )}
                  <div className="flex-1 h-px bg-cyan-500/20" />
                </div>
                {groupByLeague(iaSelectionResults).map(([leagueName, leagueResults]) => (
                  <div key={`ia-${leagueName}`}>
                    <div className="flex items-center gap-2 px-1 py-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">{leagueName}</span>
                      <div className="flex-1 h-px bg-border/30" />
                    </div>
                    <div className="space-y-1">
                      {leagueResults.map(r => (
                        <Lay0x1ScoreCard
                          key={`ia-${r.fixture_id}`}
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
                          onSelect={() => setSelectedResult(r)}
                          isSelected={selectedResult?.fixture_id === r.fixture_id}
                          iaSelected={r.ia_selected}
                          iaJustification={r.ia_justification}
                          iaCriteria={r.ia_criteria}
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
              lay0x1Data={{
                awayOdd: selectedResult.criteria?.away_odd || 0,
                stakeReference: 25,
                scoreValue: selectedResult.score_value,
                classification: selectedResult.classification,
              }}
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
