import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { useSupabaseBankroll } from "@/hooks/useSupabaseBankroll";
import { useLiveScoresContext } from "@/contexts/LiveScoresContext";
import { GoalDetectedCallback } from "@/hooks/useLiveScores";
import { RedCardEvent } from "@/hooks/useFixtureCache";
import { useNotifications } from "@/hooks/useNotifications";
import { usePlanningFilters } from "@/hooks/usePlanningFilters";
import { useDeleteWithUndo } from "@/hooks/useDeleteWithUndo";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useOperationalSettings } from "@/hooks/useOperationalSettings";

import { useRefreshInterval } from "@/hooks/useRefreshInterval";
import { updateGameStatuses } from "@/utils/gameStatus";
import { playGoalSound, playNotificationSound, playRedCardVoice } from "@/utils/soundManager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApiPause } from "@/hooks/useApiPause";

import { DataMigration } from "@/components/DataMigration";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import {
  Calendar, Download, CheckCircle, XCircle, RefreshCw,
  CalendarIcon, ChevronDown, Globe, Settings, Trash2,
  Pause, Play, Send, FileText, BarChart3, MoreVertical,
  AlertCircle
} from "lucide-react";
import { GameListByLeague } from "@/components/GameListByLeague";
import { GameStatusTabs, GameStatusFilter, GameSortOrder } from "@/components/GameStatusTabs";
import { MethodSelector } from "@/components/MethodSelector";
import { GameMethodEditor } from "@/components/GameMethodEditor";
import { ApiGameBrowser, SelectedGame } from "@/components/ApiGameBrowser";
import { ApiRequestIndicator } from "@/components/ApiRequestIndicator";
import { exportGamesToCSV } from "@/utils/exportToCSV";
import { Game } from "@/types";
import { calculateProfit } from "@/utils/profitCalculator";
import { Badge } from "@/components/ui/badge";
import { TelegramPlanningMessage, buildTelegramGames } from "@/components/TelegramPlanningMessage";
import { TelegramSummaryMessage } from "@/components/TelegramSummaryMessage";

import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getNowInBrasilia } from "@/utils/timezone";
import { FixtureDetailPanel } from "@/components/PreMatchAnalysis/FixtureDetailPanel";
import { useIsMobile } from "@/hooks/use-mobile";

export default function DailyPlanning() {
  const { user } = useAuth();
  const { games, loading: gamesLoading, addGame, updateGame, deleteGame, refreshGames } = useSupabaseGames();
  const { bankroll, loading: bankrollLoading } = useSupabaseBankroll();
  const { intervalMs } = useRefreshInterval();
  const { settings: opSettings } = useOperationalSettings();
  const stakeReference = opSettings.stakeValueReais || 25;
  const { isPaused, toggle: toggleApiPause } = useApiPause();
  const { preferences: notifPrefs } = useNotifications();


  // Split panel state
  const isMobile = useIsMobile();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // === DEDUP LAYER 2: sessionStorage-based (survives StrictMode remounts + HMR) ===
  const [showApiBrowser, setShowApiBrowser] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [selectedDailyGames, setSelectedDailyGames] = useState<string[]>([]);
  const [addingToPlanning, setAddingToPlanning] = useState(false);
  const [showGameMethodEditor, setShowGameMethodEditor] = useState(false);
  const [selectedGameForEdit, setSelectedGameForEdit] = useState<Game | null>(null);
  const [updatingGameMethods, setUpdatingGameMethods] = useState(false);
  const [gameStatusFilter, setGameStatusFilter] = useState<GameStatusFilter>('all');
  const [gameSortOrder, setGameSortOrder] = useState<GameSortOrder>('time');
  // Use persisted filters
  const {
    methodFilter: planningMethodFilter,
    statusFilter: planningStatusFilter,
    leagueFilter: planningLeagueFilter,
    searchQuery: planningSearchQuery,
    historyPeriod,
    showHistory,
    setMethodFilter: setPlanningMethodFilter,
    setStatusFilter: setPlanningStatusFilter,
    setLeagueFilter: setPlanningLeagueFilter,
    setSearchQuery: setPlanningSearchQuery,
    setHistoryPeriod,
    setShowHistory,
    clearFilters,
  } = usePlanningFilters();

  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();

  // Callback when score is persisted - update local state immediately
  const handleScorePersisted = useCallback(async (gameId: string, homeScore: number, awayScore: number) => {
    console.log(`[DailyPlanning] Score persisted for ${gameId}: ${homeScore}-${awayScore}. Manual resolution required by user request.`);

    // Refresh games to get the persisted data
    refreshGames();
  }, [refreshGames]);

  // Helper: check if a game is still pending (has methods without results)
  const isGamePending = useCallback((game: Game) => {
    // No methods = pending
    if (game.methodOperations.length === 0) return true;
    // At least one method without result = pending
    return game.methodOperations.some(op => !op.result);
  }, []);

  // NOTE: Goal and Red Card detection handlers removed from here.
  // They are now handled globally in App.tsx via LiveScoresProvider.



  // Use global live scores context
  const {
    getScoreForGame,
    refresh: refreshLiveScores,
    loading: scoresLoading,
    lastRefresh,
    scores: liveScores,
    highlightedGameId,
    setHighlightedGameId
  } = useLiveScoresContext();

  // Red card detection is now handled globally in App.tsx.
  // We can still keep a local handler if we want visual toasts on this page specifically,
  // but let's avoid duplicates by relying on the global one.
  const handleRedCardDetected = useCallback((event: RedCardEvent) => {
    // Rely on global toast/sound, or add specific page behavior here if needed.
    console.log('[DailyPlanning] Red card seen via context logic (optional page-specific behavior can go here)');
  }, []);


  // Track if we already did the initial highlight check
  const initialHighlightDoneRef = useRef(false);

  // On page load, detect if any live game has goals and highlight it
  // This ensures the golden highlight shows even if the goal was before we opened the page
  useEffect(() => {
    // Only run once when we first get live scores
    if (initialHighlightDoneRef.current) return;
    if (liveScores.size === 0) return;

    // Mark as done so we don't re-run
    initialHighlightDoneRef.current = true;

    // Find the most recent PENDING live game with goals scored (prefer latest minute)
    // Ignore games that are already fully signaled (all methods have Green/Red)
    let bestGame: { game: typeof games[0]; score: typeof liveScores extends Map<string, infer V> ? V : never } | null = null;

    for (const game of games) {
      if (!game.api_fixture_id) continue;

      // Skip games that are already fully signaled
      const isPending = game.methodOperations.length === 0 || game.methodOperations.some(op => !op.result);
      if (!isPending) continue;

      const score = liveScores.get(game.api_fixture_id);
      if (!score) continue;

      // Check if live and has goals
      const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(score.status);
      const hasGoals = score.homeScore > 0 || score.awayScore > 0;

      if (isLive && hasGoals) {
        // Pick the one with highest elapsed time (most recent action)
        if (!bestGame || (score.elapsed || 0) > (bestGame.score.elapsed || 0)) {
          bestGame = { game, score };
        }
      }
    }

    if (bestGame) {
      console.log('[DailyPlanning] Highlighting pending game with goals on load:', bestGame.game.homeTeam, 'vs', bestGame.game.awayTeam, `(${bestGame.score.homeScore}-${bestGame.score.awayScore})`);
      setHighlightedGameId(bestGame.game.id);
    }
  }, [games, liveScores]);

  // Backfill: trigger refresh on load if there are finished games without scores
  const backfillTriggeredRef = useRef(false);
  useEffect(() => {
    if (backfillTriggeredRef.current || gamesLoading) return;

    const gamesWithMissingScores = games.filter(g =>
      g.status === 'Finished' &&
      g.api_fixture_id &&
      (g.finalScoreHome === null || g.finalScoreHome === undefined)
    );

    if (gamesWithMissingScores.length > 0) {
      console.log(`[DailyPlanning] Found ${gamesWithMissingScores.length} finished games without scores, triggering backfill...`);
      backfillTriggeredRef.current = true;
      refreshLiveScores();
    }
  }, [games, gamesLoading, refreshLiveScores]);

  // Backfill: fetch logos for games that have api_fixture_id but no logos
  const logoBackfillRef = useRef(false);
  useEffect(() => {
    if (logoBackfillRef.current || gamesLoading) return;

    const gamesNeedingLogos = games.filter(g =>
      g.api_fixture_id &&
      (!g.homeTeamLogo || !g.awayTeamLogo)
    );

    if (gamesNeedingLogos.length === 0) return;
    logoBackfillRef.current = true;
    console.log(`[DailyPlanning] Backfilling logos for ${gamesNeedingLogos.length} games...`);

    (async () => {
      const BATCH = 3;
      let updated = 0;
      for (let i = 0; i < gamesNeedingLogos.length; i += BATCH) {
        const batch = gamesNeedingLogos.slice(i, i + BATCH);
        await Promise.all(batch.map(async (game) => {
          try {
            const res = await supabase.functions.invoke('api-football', {
              body: { endpoint: 'fixtures', params: { id: game.api_fixture_id } },
            });
            const fixture = res.data?.response?.[0];
            if (fixture) {
              const homeLogo = fixture.teams?.home?.logo;
              const awayLogo = fixture.teams?.away?.logo;
              if (homeLogo || awayLogo) {
                await updateGame(game.id, {
                  homeTeamLogo: homeLogo || game.homeTeamLogo,
                  awayTeamLogo: awayLogo || game.awayTeamLogo,
                });
                updated++;
              }
            }
          } catch (e) {
            console.error(`[Logo Backfill] Error for game ${game.id}:`, e);
          }
        }));
      }
      if (updated > 0) {
        console.log(`[DailyPlanning] Updated logos for ${updated} games`);
        refreshGames();
      }
    })();
  }, [games, gamesLoading, updateGame, refreshGames]);

  // Timestamp do último refresh global (para sincronizar tempo nos cards)
  const [lastGlobalRefresh, setLastGlobalRefresh] = useState<number>(0);

  const handleGlobalRefresh = async () => {
    await updateStatuses();
    // NOTE: refreshLiveScores() removido daqui para evitar loop duplo.
    // O useLiveScores já tem seu próprio polling interno.
    setLastGlobalRefresh(Date.now());
  };

  // Delete with undo functionality
  const restoreGame = useCallback(async (game: Game) => {
    await addGame({
      date: game.date,
      time: game.time,
      league: game.league,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeTeamLogo: game.homeTeamLogo,
      awayTeamLogo: game.awayTeamLogo,
      methodOperations: game.methodOperations,
      api_fixture_id: game.api_fixture_id,
    });
    await refreshGames();
  }, [addGame, refreshGames]);

  const { deleteWithUndo } = useDeleteWithUndo({
    onDelete: deleteGame,
    onRestore: restoreGame,
  });

  const updateStatuses = async () => {
    const updatedGames = updateGameStatuses(games);

    for (const game of updatedGames) {
      const originalGame = games.find(g => g.id === game.id);
      if (originalGame && originalGame.status !== game.status) {
        await updateGame(game.id, { status: game.status });
      }
    }

    await refreshGames();
  };

  const updateStatusesRef = useRef(updateStatuses);

  useEffect(() => {
    updateStatusesRef.current = updateStatuses;
  }, [games, updateGame, refreshGames]);

  // Auto-update game statuses - relies on handleGlobalRefresh triggered by useAutoRefresh hook
  useEffect(() => {
    updateStatusesRef.current();
  }, []);

  const handleDelete = useCallback((gameId: string) => {
    const game = games.find(g => g.id === gameId);
    if (game) {
      deleteWithUndo(game);
    }
  }, [games, deleteWithUndo]);

  const handleExport = () => {
    exportGamesToCSV(games, bankroll.methods);
    toast.success('Dados exportados com sucesso!');
  };


  const handleEditGameMethods = (game: Game) => {
    setSelectedGameForEdit(game);
    setShowGameMethodEditor(true);
  };

  const handleConfirmGameMethodsEdit = async (gameId: string, methodOperations: any[]) => {
    setUpdatingGameMethods(true);
    try {
      await updateGame(gameId, { methodOperations });
      toast.success('Métodos atualizados!');
      setShowGameMethodEditor(false);
      setSelectedGameForEdit(null);
    } catch (error: any) {
      toast.error('Erro ao atualizar métodos');
    } finally {
      setUpdatingGameMethods(false);
    }
  };

  // Add games from API browser
  const handleAddFromApi = async (selectedGames: SelectedGame[]) => {
    for (const game of selectedGames) {
      const methodOperations = game.methodIds.map(methodId => ({
        methodId,
        operationType: undefined,
        entryOdds: undefined,
        exitOdds: undefined,
        result: undefined,
      }));

      await addGame({
        date: game.date,
        time: game.time,
        league: game.league,
        country: game.country,
        leagueFlag: game.leagueFlag,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeTeamLogo: game.homeTeamLogo,
        awayTeamLogo: game.awayTeamLogo,
        methodOperations,
        api_fixture_id: game.fixtureId.toString(),
      });
    }
    toast.success(`${selectedGames.length} jogo(s) adicionado(s)!`);
    await refreshGames();
  };

  const handleSmartResolveAll = async () => {
    toast.info('A resolução automática foi desativada por sua solicitação. Defina os resultados manualmente.');
  };

  // Get today's date in Brasilia timezone
  const todayDate = format(getNowInBrasilia(), 'yyyy-MM-dd');

  // Separar jogos: PENDENTES (pelo menos 1 operação sem resultado) vs FINALIZADOS (todas com resultado)
  const pendingGames = games.filter((game) =>
    game.methodOperations.length === 0 || game.methodOperations.some((op) => !op.result)
  );

  const finalizedGames = games.filter((game) =>
    game.methodOperations.length > 0 && game.methodOperations.every((op) => op.result)
  );

  const sortGames = (gamesToSort: Game[]) => {
    return [...gamesToSort].sort((a, b) => {
      const dateTimeA = new Date(`${a.date}T${a.time}`).getTime();
      const dateTimeB = new Date(`${b.date}T${b.time}`).getTime();
      return dateTimeA - dateTimeB;
    });
  };

  // Apenas pendentes na seção principal - finalizados vão direto para o histórico
  const sortedPlanned = sortGames(pendingGames);

  // Filtros para planejamento
  const filteredPlannedGames = useMemo(() => {
    let filtered = [...sortedPlanned];

    if (planningSearchQuery) {
      const query = planningSearchQuery.toLowerCase();
      filtered = filtered.filter(game =>
        game.homeTeam.toLowerCase().includes(query) ||
        game.awayTeam.toLowerCase().includes(query) ||
        game.league.toLowerCase().includes(query)
      );
    }

    if (planningMethodFilter !== 'all') {
      filtered = filtered.filter(game =>
        game.methodOperations.some(op => op.methodId === planningMethodFilter)
      );
    }

    if (planningStatusFilter !== 'all') {
      if (planningStatusFilter === 'pending') {
        filtered = filtered.filter(game =>
          game.methodOperations.length === 0 || game.methodOperations.some(op => !op.result)
        );
      } else if (planningStatusFilter === 'live') {
        filtered = filtered.filter(game => game.status === 'Live');
      } else if (planningStatusFilter === 'finished') {
        filtered = filtered.filter(game =>
          game.methodOperations.length > 0 && game.methodOperations.every(op => op.result)
        );
      }
    }

    if (planningLeagueFilter !== 'all') {
      filtered = filtered.filter(game => game.league === planningLeagueFilter);
    }

    return filtered;
  }, [sortedPlanned, planningSearchQuery, planningMethodFilter, planningStatusFilter, planningLeagueFilter]);

  const uniqueLeagues = useMemo(() => {
    const leagues = new Set(sortedPlanned.map(game => game.league));
    return Array.from(leagues).sort();
  }, [sortedPlanned]);

  // Filtrar histórico por período
  const filteredHistory = useMemo(() => {
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const localOffset = now.getTimezoneOffset();
    const offsetDiff = localOffset - brasiliaOffset;

    const today = new Date(now.getTime() + offsetDiff * 60000);
    today.setHours(0, 0, 0, 0);

    return finalizedGames.filter((game) => {
      const [year, month, day] = game.date.split('-').map(Number);
      const gameDate = new Date(year, month - 1, day);
      gameDate.setHours(0, 0, 0, 0);

      switch (historyPeriod) {
        case 'today':
          return gameDate.getTime() === today.getTime();
        case 'yesterday': {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return gameDate.getTime() === yesterday.getTime();
        }
        case 'last7':
          const last7 = new Date(today);
          last7.setDate(last7.getDate() - 7);
          return gameDate >= last7;
        case 'last30':
          const last30 = new Date(today);
          last30.setDate(last30.getDate() - 30);
          return gameDate >= last30;
        case 'custom':
          if (!customDateFrom) return true;
          const from = new Date(customDateFrom);
          from.setHours(0, 0, 0, 0);
          if (customDateTo) {
            const to = new Date(customDateTo);
            to.setHours(23, 59, 59, 999);
            return gameDate >= from && gameDate <= to;
          }
          return gameDate >= from;
        default:
          return true;
      }
    });
  }, [finalizedGames, historyPeriod, customDateFrom, customDateTo]);


  // Agrupar histórico por data
  const groupedHistory = useMemo(() => {
    const groups = new Map<string, Game[]>();
    filteredHistory.forEach((game) => {
      const dateKey = game.date;
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(game);
    });

    groups.forEach((games) => {
      games.sort((a, b) => a.time.localeCompare(b.time));
    });

    return Array.from(groups.entries())
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, games]) => ({ date, games }));
  }, [filteredHistory]);

  // Stats gerais
  const allOperations = finalizedGames.flatMap((g) => g.methodOperations);
  const totalOperations = allOperations.length;
  const greenOperations = allOperations.filter((op) => op.result === "Green").length;
  const redOperations = allOperations.filter((op) => op.result === "Red").length;
  // Win Rate excludes Voids from denominator
  const decidedOperations = greenOperations + redOperations;
  const winRate = decidedOperations > 0 ? ((greenOperations / decidedOperations) * 100).toFixed(1) : "0.0";
  const liveGames = games.filter(g => g.status === 'Live').length;

  // Check if there are any live or pending games that need auto-refresh
  const hasActiveGames = useMemo(() => {
    return games.some(g => g.status === 'Live' || g.status === 'Pending');
  }, [games]);

  // Auto-refresh based on user-configured interval when there are live/pending games (respects pause)
  const { secondsUntilRefresh, isRefreshing } = useAutoRefresh(
    handleGlobalRefresh,
    { intervalMs, enabled: hasActiveGames && !isPaused }
  );

  const getMethodName = (methodId: string) => {
    const method = bankroll.methods.find((m) => m.id === methodId);
    if (method) return method.name;

    // Fallback mais descritivo para métodos órfãos
    const shortId = methodId?.substring(0, 4) || '????';
    return `Método (${shortId}...)`;
  };

  const handleSelectGame = useCallback((game: Game) => {
    setSelectedGame(game);
    sessionStorage.setItem('ai_trader_active_game', JSON.stringify(game));
    toast.success(`Jogo ${game.homeTeam} selecionado para o AI Trader`);
  }, []);

  if (gamesLoading || bankrollLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed inset-0 top-16 bg-background flex w-full max-w-none z-0 overflow-y-auto custom-scrollbar",
      isMobile ? "relative top-0 flex-col h-auto overflow-y-auto pb-24" : "grid grid-cols-[clamp(400px,30%,480px)_1fr] gap-0"
    )}>
      {/* COLUMN 1: LEFT - Game List (420px) */}
      <aside className={cn(
        "w-full sm:w-[480px] lg:w-[480px] border-r border-border bg-background flex flex-col h-fit min-h-full shrink-0",
        isMobile && "w-full h-auto border-r-0 border-b shrink-0"
      )}>
        <div className="p-4 border-b border-border space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#121A24] rounded-lg p-3 border border-white/5 shadow-sm">
            <h2 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600 flex items-center gap-1.5 drop-shadow-sm">
              <CalendarIcon className="h-4 w-4 text-emerald-500" />
              PLANEJAMENTO
            </h2>
            <div className="flex items-center gap-2">
              {liveGames > 0 && (
                <Badge variant="destructive" className="animate-pulse text-[10px] h-5">
                  {liveGames} LIVE
                </Badge>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground relative">
                    <Settings className="h-4 w-4" />
                    {isPaused && (
                      <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[280px] p-0 border-border bg-[#0B0F14]/95 backdrop-blur-xl">
                  {/* CONFIG PANEL INCORPORATED INTO POPOVER */}
                  <div className="flex flex-col h-full max-h-[80vh] overflow-y-auto custom-scrollbar">
                    <div className="p-4 border-b border-border space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Settings className="h-4 w-4 text-primary" />
                        Config & Status
                      </h3>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 rounded bg-muted/30 border border-white/5">
                          <span className="text-[11px] font-medium text-muted-foreground">API Football</span>
                          <ApiRequestIndicator />
                        </div>

                        <div className="flex items-center justify-between p-2 rounded bg-muted/30 border border-white/5">
                          <span className="text-[11px] font-medium text-muted-foreground">Telegram Bots</span>
                          <Badge variant={notifPrefs.telegramEnabled ? "default" : "secondary"} className="text-[10px] h-5">
                            {notifPrefs.telegramEnabled ? "Ativo" : "Off"}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowTelegramModal(true)} className="h-8 text-xs bg-[#121A24]/60">
                          <Send className="h-3 w-3 mr-2" />
                          Sinais
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowSummaryModal(true)} className="h-8 text-xs bg-[#121A24]/60">
                          <FileText className="h-3 w-3 mr-2" />
                          Resumo
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 space-y-4 border-b border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Controles Globais</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleGlobalRefresh}
                          disabled={scoresLoading || isPaused}
                          className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <RefreshCw className={cn("h-3 w-3", scoresLoading && "animate-spin")} />
                        </Button>
                      </div>

                      <Button
                        variant={isPaused ? "destructive" : "secondary"}
                        size="sm"
                        onClick={toggleApiPause}
                        className={cn("w-full h-9", isPaused && "animate-pulse")}
                      >
                        {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                        {isPaused ? 'Retomar Sistema' : 'Pausar Sistema'}
                      </Button>

                      <Button variant="outline" size="sm" onClick={handleExport} className="w-full h-9 bg-[#121A24]/60">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar CSV
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSmartResolveAll}
                        className="w-full h-9 bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Resolver Todos
                      </Button>
                    </div>

                    <div className="p-4 font-mono text-[10px] space-y-2 opacity-60">
                      <div className="flex justify-between">
                        <span>Server Time:</span>
                        <span>{format(getNowInBrasilia(), 'HH:mm:ss')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Data Pool:</span>
                        <span>{lastRefresh ? format(lastRefresh, 'HH:mm:ss') : '--:--'}</span>
                      </div>
                      {hasActiveGames && !isPaused && (
                        <div className="flex justify-between text-emerald-500">
                          <span>Next Update:</span>
                          <span>{secondsUntilRefresh}s</span>
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button type="button" variant="default" size="sm" onClick={() => setShowApiBrowser(true)} className="h-8 text-[11px] sm:text-xs px-2 sm:px-3 bg-emerald-500 hover:bg-emerald-600 text-black shadow-md shadow-emerald-500/20 font-medium whitespace-nowrap">
                <Globe className="h-3 w-3 mr-1" />
                Buscar Jogos
              </Button>
            </div>
          </div>

          <GameStatusTabs
            games={sortedPlanned}
            currentFilter={gameStatusFilter}
            onFilterChange={setGameStatusFilter}
            currentSort={gameSortOrder}
            onSortChange={setGameSortOrder}
          />
        </div>

        <div className="flex-1 p-2 space-y-2">
          {sortedPlanned.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">Nenhum jogo planejado</p>
            </div>
          ) : (
            <GameListByLeague
              games={sortedPlanned.filter((game) => {
                if (gameStatusFilter === 'all') return true;
                const fixtureStatus = game.status;
                if (gameStatusFilter === 'live') return fixtureStatus === 'Live';
                if (gameStatusFilter === 'finished') return fixtureStatus === 'Finished';
                if (gameStatusFilter === 'pending') return fixtureStatus !== 'Live' && fixtureStatus !== 'Finished';
                return true;
              })}
              methods={bankroll.methods}
              onUpdate={updateGame}
              onDelete={handleDelete}
              onEdit={handleEditGameMethods}
              getScoreForGame={getScoreForGame}
              lastGlobalRefresh={lastGlobalRefresh}
              sortOrder={gameSortOrder}
              highlightedGameId={highlightedGameId}
              globalPaused={isPaused}
              onRedCardDetected={handleRedCardDetected}
              onSelectGame={handleSelectGame}
              selectedGameId={selectedGame?.id}
              compact={false}
            />
          )}
        </div>
      </aside>

      {/* COLUMN 2: CENTER - Analysis & History (1fr) */}
      <main className="flex flex-col min-h-full bg-[#0B0F14]/50">
        <div className="flex-1 p-6 space-y-6">
          {/* Header & Metrics */}
          {(() => {
            const todayGames = games.filter(g => g.date === todayDate);
            const todayOps = todayGames.flatMap(g => g.methodOperations).filter(op => op.result);
            const todayGreens = todayOps.filter(op => op.result === 'Green').length;
            const todayReds = todayOps.filter(op => op.result === 'Red').length;
            const todayTotal = todayGreens + todayReds;
            // Calculate total profit money and stakes using aggressive fallback for quick-clicks
            let todayProfitMoney = 0;
            todayOps.forEach(op => {
              if (op.profit != null) {
                todayProfitMoney += op.profit;
              } else if (op.result) {
                const methodObj = bankroll.methods.find(m => m.id === op.methodId);
                const isLay = methodObj?.name?.toLowerCase().includes('lay') || op.operationType === 'Lay';
                const type = isLay ? 'Lay' : 'Back';
                const fallbackStake = op.stakeValue || stakeReference;
                const fallbackOdd = op.odd || op.entryOdds || 2.0;
                const commissionRate = op.commissionRate ?? 0.045;

                if (type === 'Back') {
                  if (op.result === 'Green') {
                    todayProfitMoney += fallbackStake * (fallbackOdd - 1) * (1 - commissionRate);
                  } else if (op.result === 'Red') {
                    todayProfitMoney -= fallbackStake;
                  }
                } else {
                  if (op.result === 'Green') {
                    const stakeLay = fallbackStake / (fallbackOdd - 1);
                    todayProfitMoney += stakeLay * (1 - commissionRate);
                  } else if (op.result === 'Red') {
                    todayProfitMoney -= fallbackStake;
                  }
                }
              }
            });

            const todayProfitStakes = stakeReference > 0 ? todayProfitMoney / stakeReference : 0;
            const todayWinRate = todayTotal > 0 ? ((todayGreens / todayTotal) * 100).toFixed(1) : '0.0';

            // Streak calculation
            const sortedOps = [...todayOps].reverse(); // most recent first
            let streakType: 'Green' | 'Red' | null = null;
            let streakCount = 0;
            for (const op of sortedOps) {
              if (!streakType) {
                streakType = op.result as 'Green' | 'Red';
                streakCount = 1;
              } else if (op.result === streakType) {
                streakCount++;
              } else {
                break;
              }
            }

            // Per-method breakdown
            const methodBreakdown = new Map<string, { name: string; greens: number; reds: number; profit: number }>();
            for (const game of todayGames) {
              for (const op of game.methodOperations) {
                if (!op.result) continue;
                const name = getMethodName(op.methodId);
                const existing = methodBreakdown.get(op.methodId) || { name, greens: 0, reds: 0, profit: 0 };
                if (op.result === 'Green') existing.greens++;
                else if (op.result === 'Red') existing.reds++;

                let opProfit = 0;
                if (op.profit != null) {
                  opProfit = op.profit;
                } else if (op.result) {
                  const isLay = name.toLowerCase().includes('lay') || op.operationType === 'Lay';
                  const type = isLay ? 'Lay' : 'Back';
                  const fallbackStake = op.stakeValue || stakeReference;
                  const fallbackOdd = op.odd || op.entryOdds || 2.0;
                  const commissionRate = op.commissionRate ?? 0.045;

                  if (type === 'Back') {
                    if (op.result === 'Green') {
                      opProfit = fallbackStake * (fallbackOdd - 1) * (1 - commissionRate);
                    } else if (op.result === 'Red') {
                      opProfit = -fallbackStake;
                    }
                  } else {
                    if (op.result === 'Green') {
                      const stakeLay = fallbackStake / (fallbackOdd - 1);
                      opProfit = stakeLay * (1 - commissionRate);
                    } else if (op.result === 'Red') {
                      opProfit = -fallbackStake;
                    }
                  }
                }

                existing.profit += opProfit;
                methodBreakdown.set(op.methodId, existing);
              }
            }

            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className="p-4 bg-[#121A24] border-white/5 shadow-sm">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Lucro Hoje</p>
                    <p className={cn("text-xl font-bold mt-1", todayProfitMoney >= 0 ? "text-emerald-500" : "text-red-500")}>
                      {todayProfitMoney >= 0 ? '+' : ''}{todayProfitMoney.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <p className="text-[10px] opacity-70">
                      {todayProfitStakes >= 0 ? '+' : ''}{todayProfitStakes.toFixed(2)} st
                    </p>
                  </Card>
                  <Card className="p-4 bg-[#121A24] border-white/5 shadow-sm">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Operações Hoje</p>
                    <p className="text-xl font-bold mt-1">{todayTotal}</p>
                    <p className="text-[10px] text-muted-foreground">{todayGreens}G / {todayReds}R</p>
                  </Card>
                  <Card className="p-4 bg-[#121A24] border-white/5 shadow-sm">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Win Rate Hoje</p>
                    <p className="text-xl font-bold mt-1">{todayWinRate}%</p>
                    <p className="text-[10px] text-muted-foreground">Média geral</p>
                  </Card>
                  <Card className="p-4 bg-[#121A24] border-white/5 shadow-sm">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Jogos Hoje</p>
                    <p className="text-xl font-bold mt-1">{todayGames.length}</p>
                    <p className="text-[10px] text-muted-foreground">{liveGames} ao vivo</p>
                  </Card>
                  <Card className="p-4 bg-[#121A24] border-white/5 shadow-sm">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Streak Atual</p>
                    <p className={cn("text-xl font-bold mt-1", streakType === 'Green' ? "text-emerald-500" : streakType === 'Red' ? "text-red-500" : "text-muted-foreground")}>
                      {streakCount > 0 ? `${streakCount} ${streakType}` : '—'}
                    </p>
                  </Card>
                </div>

                {/* Per-method P&L badges */}
                {methodBreakdown.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {Array.from(methodBreakdown.entries())
                      .sort(([, a], [, b]) => b.profit - a.profit)
                      .map(([id, m]) => {
                        const isOrphaned = !bankroll.methods.some(bm => bm.id === id);
                        return (
                          <span
                            key={id}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm",
                              m.profit >= 0
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : "bg-red-500/10 text-red-500 border-red-500/20",
                              isOrphaned && "border-amber-500/40 bg-amber-500/10 text-amber-500"
                            )}
                            title={isOrphaned ? "Método não encontrado na banca (pode ter sido deletado)" : undefined}
                          >
                            {isOrphaned && <AlertCircle className="h-3 w-3" />}
                            {m.name}: <span className="opacity-90 mx-1">{m.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            <span className="text-[9px] opacity-60 font-medium">({m.greens}G / {m.reds}R)</span>
                          </span>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            );
          })()}

          {/* Analysis View */}
          <section className="min-h-[400px]">
            {selectedGame?.api_fixture_id ? (
              <FixtureDetailPanel
                fixtureId={selectedGame.api_fixture_id}
                homeTeam={selectedGame.homeTeam}
                awayTeam={selectedGame.awayTeam}
                homeTeamLogo={selectedGame.homeTeamLogo}
                awayTeamLogo={selectedGame.awayTeamLogo}
                league={selectedGame.league}
                time={selectedGame.time}
              />
            ) : (
              <Card className="h-[400px] flex flex-col items-center justify-center bg-[#121A24] border-white/5 border-dashed border-2 text-muted-foreground">
                <BarChart3 className="h-12 w-12 opacity-10 mb-2" />
                <p className="text-sm">Selecione um jogo na lista para iniciar a análise</p>
              </Card>
            )}
          </section>

          {/* History Section (Visible but styled) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <h3 className="text-md font-bold">Histórico Recente</h3>
              </div>
              <Select value={historyPeriod} onValueChange={(val: any) => setHistoryPeriod(val)}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="last7">Últimos 7 dias</SelectItem>
                  <SelectItem value="last30">Últimos 30 dias</SelectItem>
                  <SelectItem value="all">Todo o Período</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {groupedHistory.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Nenhum jogo finalizado no período selecionado.
              </div>
            ) : (
              groupedHistory.map(({ date, games }) => (
                <div key={date} className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground ml-1">
                    {format(new Date(`${date}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {games.map((game) => (
                      <Card key={game.id} className="p-3 bg-[#121A24] border-white/5 hover:bg-[#1A232E] transition-colors relative group cursor-pointer" onClick={() => handleSelectGame(game)}>
                        <div className="flex justify-between items-start text-xs">
                          <span className="opacity-50 mt-1">{game.time}</span>
                          <div className="flex items-center gap-1">
                            <Badge variant={game.methodOperations.every(op => op.result === 'Green') ? 'default' : game.methodOperations.some(op => op.result === 'Red') ? 'destructive' : 'secondary'} className="text-[10px] h-5 px-2">
                              {game.finalScoreHome}-{game.finalScoreAway}
                            </Badge>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditGameMethods(game); }}>
                                  <Settings className="h-4 w-4 mr-2" />Editar resultados
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(game.id); }} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />Excluir jogo
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="mt-1 font-medium text-sm truncate pr-6">
                          {game.homeTeam} vs {game.awayTeam}
                        </div>

                        {/* Status lines for methods */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {game.methodOperations.map(op => (
                            <div key={op.methodId} className={cn("w-1.5 h-1.5 rounded-full", op.result === 'Green' ? "bg-emerald-500" : op.result === 'Red' ? "bg-red-500" : "bg-amber-500")} title={op.result} />
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </main>


      {/* Modals & Components */}
      <ApiGameBrowser
        open={showApiBrowser}
        onOpenChange={setShowApiBrowser}
        methods={bankroll.methods}
        onAddGames={handleAddFromApi}
        existingFixtureIds={games.filter(g => g.api_fixture_id).map(g => g.api_fixture_id!)}
      />
      <GameMethodEditor
        open={showGameMethodEditor}
        onOpenChange={setShowGameMethodEditor}
        game={selectedGameForEdit}
        methods={bankroll.methods}
        onConfirm={handleConfirmGameMethodsEdit}
        loading={updatingGameMethods}
      />
      <TelegramPlanningMessage
        open={showTelegramModal}
        onOpenChange={setShowTelegramModal}
        games={games.filter(g => g.date === todayDate)}
        methods={bankroll.methods}
      />
      <TelegramSummaryMessage
        open={showSummaryModal}
        onOpenChange={setShowSummaryModal}
        games={games}
        methods={bankroll.methods}
      />

      <DataMigration />
    </div>
  );
}
