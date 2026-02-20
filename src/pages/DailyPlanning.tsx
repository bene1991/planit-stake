import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { useSupabaseBankroll } from "@/hooks/useSupabaseBankroll";
import { useLiveScores, GoalDetectedCallback } from "@/hooks/useLiveScores";
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
import { Calendar, Download, CheckCircle, XCircle, RefreshCw, CalendarIcon, ChevronDown, Globe, Settings, Trash2, Pause, Play, Send, FileText } from "lucide-react";
import { toast } from "sonner";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getNowInBrasilia } from "@/utils/timezone";

export default function DailyPlanning() {
  const { user } = useAuth();
  const { games, loading: gamesLoading, addGame, updateGame, deleteGame, refreshGames } = useSupabaseGames();
  const { bankroll, loading: bankrollLoading } = useSupabaseBankroll();
  const { intervalMs } = useRefreshInterval();
  const { settings: opSettings } = useOperationalSettings();
  const stakeReference = opSettings.stakeValueReais || 25;
  const { isPaused, toggle: toggleApiPause } = useApiPause();
  const { preferences: notifPrefs } = useNotifications();
  
  
  // State for highlighting the last game with a goal
  const [highlightedGameId, setHighlightedGameId] = useState<string | null>(null);
  
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
  const handleScorePersisted = useCallback((gameId: string, homeScore: number, awayScore: number) => {
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
  
  // Goal detection callback - called by useLiveScores when a goal is detected
  const handleGoalDetected = useCallback<GoalDetectedCallback>((gameId, team, homeScore, awayScore, game) => {
    // IGNORE games that are already fully signaled (all methods have Green/Red)
    if (!isGamePending(game)) {
      console.log(`[DailyPlanning] Ignoring goal for completed game: ${game.homeTeam} vs ${game.awayTeam}`);
      return;
    }
    
    // === DEDUP LAYER 2: sessionStorage-based dedup (survives remounts/HMR) ===
    const goalKey = `${gameId}-${homeScore}-${awayScore}`;
    try {
      const stored = sessionStorage.getItem('notifiedGoalKeys');
      const keys: string[] = stored ? JSON.parse(stored) : [];
      if (keys.includes(goalKey)) {
        console.log(`[DailyPlanning] Dedup: goal already notified for key=${goalKey}, skipping`);
        return;
      }
      // Keep last 50 keys max to avoid unbounded growth
      keys.push(goalKey);
      if (keys.length > 50) keys.splice(0, keys.length - 50);
      sessionStorage.setItem('notifiedGoalKeys', JSON.stringify(keys));
    } catch {
      // sessionStorage fail - proceed but log
      console.warn('[DailyPlanning] sessionStorage dedup failed, proceeding');
    }
    
    console.log(`[DailyPlanning] ⚽ GOAL! ${team === 'home' ? game.homeTeam : game.awayTeam} scores! ${game.homeTeam} ${homeScore}-${awayScore} ${game.awayTeam}`);
    
    // Play celebration sound (Layer 3 dedup inside playGoalSound)
    playGoalSound();
    
    // Highlight this game with golden border
    setHighlightedGameId(gameId);
    
    // Send push notification ONLY if app is in background (user can't hear the sound)
    if (user && document.hidden) {
      const scoringTeamName = team === 'home' ? game.homeTeam : game.awayTeam;
      supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          payload: {
            title: '⚽ GOL!',
            body: `${scoringTeamName} marca! ${game.homeTeam} ${homeScore} x ${awayScore} ${game.awayTeam}`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: { 
              type: 'goal',
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              homeScore,
              awayScore
            }
          }
        }
      }).catch(err => console.error('[DailyPlanning] Push notification error:', err));
    }
  }, [user, isGamePending]);

  // Red card detection callback
  const handleRedCardDetected = useCallback((event: RedCardEvent) => {
    if (!notifPrefs.redCardAlerts || !notifPrefs.enabled) return;

    const teamLabel = event.team === 'home' ? 'Casa' : 'Fora';
    const playerName = event.player || 'Jogador';
    const message = `🟥 Cartão Vermelho! ${playerName} - ${teamLabel} (${event.minute}')`;

    console.log(`[DailyPlanning] ${message}`);

    // Visual toast
    toast.error(message, { duration: 8000 });

    // Sound alert
    if (notifPrefs.soundEnabled) {
      playNotificationSound('error', true);
    }

    // Voice alert
    if (notifPrefs.voiceAlerts) {
      playRedCardVoice();
    }

    // Push notification (background only)
    if (user && document.hidden) {
      supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          payload: {
            title: '🟥 Cartão Vermelho!',
            body: `${playerName} - ${teamLabel} (${event.minute}')`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: { type: 'red_card', fixtureId: event.fixtureId }
          }
        }
      }).catch(err => console.error('[DailyPlanning] Push red card error:', err));
    }
  }, [user, notifPrefs]);
  
  // Optimized live scores - uses configurable interval + auto-economy
  const { 
    getScoreForGame, 
    refresh: refreshLiveScores, 
    loading: scoresLoading,
    lastRefresh,
    scores: liveScores 
  } = useLiveScores(games, handleScorePersisted, handleGoalDetected, intervalMs, isPaused);
  
  
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

  // Auto-update game statuses every 30 seconds
  useEffect(() => {
    updateStatusesRef.current();
    const interval = setInterval(() => {
      updateStatusesRef.current();
    }, 30 * 1000);
    return () => clearInterval(interval);
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

  // Get today's date in Brasilia timezone
  const todayDate = format(getNowInBrasilia(), 'yyyy-MM-dd');

  // Separar jogos: PENDENTES (pelo menos 1 operação sem resultado) vs FINALIZADOS (todas com resultado)
  const pendingGames = games.filter((game) =>
    game.methodOperations.some((op) => !op.result)
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

  // Mostrar apenas jogos pendentes na seção principal
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
          game.methodOperations.some(op => !op.result)
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
    return bankroll.methods.find((m) => m.id === methodId)?.name || 'Método';
  };

  if (gamesLoading || bankrollLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-8">
      <DataMigration />

      {/* Resumo do Dia */}
      {(() => {
        const todayGames = games.filter(g => g.date === todayDate);
        const todayOps = todayGames.flatMap(g => g.methodOperations).filter(op => op.result);
        const todayGreens = todayOps.filter(op => op.result === 'Green').length;
        const todayReds = todayOps.filter(op => op.result === 'Red').length;
        // Win Rate excludes Voids from denominator
        const todayTotal = todayGreens + todayReds;
        const todayWinRate = todayTotal > 0 ? ((todayGreens / todayTotal) * 100).toFixed(1) : '0.0';
        const todayProfitMoney = todayOps.reduce((sum, op) => {
          if (op.profit != null) return sum + op.profit;
          if (op.stakeValue && op.odd && op.operationType && op.result) {
            return sum + calculateProfit({
              stakeValue: op.stakeValue,
              odd: op.odd,
              operationType: op.operationType,
              result: op.result,
              commissionRate: 0.045
            });
          }
          return sum;
        }, 0);
        const todayProfitStakes = todayProfitMoney / stakeReference;
        const todayLive = todayGames.filter(g => g.status === 'Live').length;

        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Card className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lucro Hoje</p>
                <p className={cn("text-lg font-bold", todayProfitMoney >= 0 ? "text-emerald-500" : "text-red-500")}>
                  {todayProfitMoney >= 0 ? '+' : ''}{todayProfitMoney.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className={cn("text-[10px]", todayProfitStakes >= 0 ? "text-emerald-500/70" : "text-red-500/70")}>
                  {todayProfitStakes >= 0 ? '+' : ''}{todayProfitStakes.toFixed(2)} st
                </p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Operações Hoje</p>
                <p className="text-lg font-bold">{todayTotal}</p>
                <p className="text-[10px] text-muted-foreground">{todayGreens}G / {todayReds}R</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Win Rate Hoje</p>
                <p className="text-lg font-bold">{todayWinRate}%</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Jogos Hoje</p>
                <p className="text-lg font-bold">{todayGames.length}</p>
                <p className="text-[10px] text-muted-foreground">
                  {todayLive > 0 ? `${todayLive} ao vivo` : 'Nenhum ao vivo'}
                </p>
              </Card>
              {/* Streak Atual */}
              <Card className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Streak Atual</p>
                {(() => {
                  // Calculate streak from all completed operations ordered by date/time
                  const allCompleted = games
                    .filter(g => g.methodOperations.some(op => op.result))
                    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
                  
                  let streakType: string | null = null;
                  let streakCount = 0;
                  
                  for (const game of allCompleted) {
                    const ops = game.methodOperations.filter(op => op.result).sort((a, b) => (b.result || '').localeCompare(a.result || ''));
                    for (const op of ops) {
                      if (!streakType) {
                        streakType = op.result!;
                        streakCount = 1;
                      } else if (op.result === streakType) {
                        streakCount++;
                      } else {
                        break;
                      }
                    }
                    if (streakType && ops.some(op => op.result !== streakType)) break;
                  }
                  
                  return (
                    <>
                      <p className={cn("text-lg font-bold", streakType === 'Green' ? "text-emerald-500" : streakType === 'Red' ? "text-red-500" : "text-muted-foreground")}>
                        {streakCount > 0 ? `${streakCount} ${streakType}` : '-'}
                      </p>
                      {streakType === 'Red' && streakCount >= 3 && (
                        <p className="text-[10px] text-red-400">⚠️ Atenção</p>
                      )}
                    </>
                  );
                })()}
              </Card>
            </div>

            {/* Resumo por Método */}
            {(() => {
              const methodGroups = todayOps.reduce<Record<string, { greens: number; reds: number; profit: number }>>((acc, op) => {
                const key = op.methodId;
                if (!acc[key]) acc[key] = { greens: 0, reds: 0, profit: 0 };
                if (op.result === 'Green') acc[key].greens++;
                if (op.result === 'Red') acc[key].reds++;
                const p = op.profit != null ? op.profit
                  : (op.stakeValue && op.odd && op.operationType && op.result)
                    ? calculateProfit({ stakeValue: op.stakeValue, odd: op.odd, operationType: op.operationType, result: op.result, commissionRate: 0.045 })
                    : 0;
                acc[key].profit += p;
                return acc;
              }, {});

              const entries = Object.entries(methodGroups).sort((a, b) => b[1].profit - a[1].profit);
              if (entries.length === 0) return null;

              return (
                <div className="flex flex-wrap gap-2 pt-1">
                  {entries.map(([methodId, data]) => {
                    const method = bankroll?.methods.find(m => m.id === methodId);
                    if (!method) return null;
                    const isPositive = data.profit >= 0;
                    return (
                      <span
                        key={methodId}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                          isPositive
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-red-500/15 text-red-400"
                        )}
                      >
                        {method.name}: {data.greens}G/{data.reds}R {isPositive ? '+' : ''}{data.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        );
      })()}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Planejamento
            {liveGames > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {liveGames} LIVE
              </Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {totalOperations > 0 && (
              <span>{greenOperations}G • {redOperations}R • {winRate}%</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {buildTelegramGames(games.filter(g => g.date === todayDate), bankroll.methods).length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowTelegramModal(true)} className="h-8">
              <Send className="h-3.5 w-3.5 sm:mr-2" />
              <span className="hidden sm:inline">Telegram</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowSummaryModal(true)} className="h-8">
            <FileText className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Resumo</span>
          </Button>
          <ApiRequestIndicator />
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
            <Download className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGlobalRefresh} 
            className="h-8"
            disabled={scoresLoading || isPaused}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 sm:mr-2", scoresLoading && "animate-spin")} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button 
            variant={isPaused ? "destructive" : "outline"} 
            size="sm" 
            onClick={toggleApiPause} 
            className={cn("h-8", isPaused && "animate-pulse")}
          >
            {isPaused ? <Play className="h-3.5 w-3.5 sm:mr-2" /> : <Pause className="h-3.5 w-3.5 sm:mr-2" />}
            <span className="hidden sm:inline">{isPaused ? 'Retomar API' : 'Pausar API'}</span>
          </Button>
          <Button variant="default" size="sm" onClick={() => setShowApiBrowser(true)} className="h-8">
            <Globe className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Buscar Jogos</span>
          </Button>
        </div>
      </div>

      {/* Pause Banner */}
      {isPaused && (
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs font-medium">
          <Pause className="h-3.5 w-3.5" />
          Requisições pausadas — placares e estatísticas não estão atualizando
        </div>
      )}

      {/* Last Refresh Info */}
      {lastRefresh && !isPaused && (
        <p className="text-[10px] text-muted-foreground">
          Última atualização: {format(lastRefresh, 'HH:mm:ss')}
          {hasActiveGames && (
            <span className="ml-1">
              • próxima em {secondsUntilRefresh}s
            </span>
          )}
        </p>
      )}

      {/* API Game Browser */}
      <ApiGameBrowser
        open={showApiBrowser}
        onOpenChange={setShowApiBrowser}
        methods={bankroll.methods}
        onAddGames={handleAddFromApi}
        existingFixtureIds={games.filter(g => g.api_fixture_id).map(g => g.api_fixture_id!)}
      />

      {/* Method Selector */}
      <MethodSelector
        open={showMethodSelector}
        onOpenChange={setShowMethodSelector}
        methods={bankroll.methods}
        onConfirm={() => {}}
        loading={addingToPlanning}
      />

      {/* Game Method Editor */}
      <GameMethodEditor
        open={showGameMethodEditor}
        onOpenChange={setShowGameMethodEditor}
        game={selectedGameForEdit}
        methods={bankroll.methods}
        onConfirm={handleConfirmGameMethodsEdit}
        loading={updatingGameMethods}
      />

      {/* Telegram Planning Message */}
      <TelegramPlanningMessage
        open={showTelegramModal}
        onOpenChange={setShowTelegramModal}
        games={games.filter(g => g.date === todayDate)}
        methods={bankroll.methods}
      />

      {/* Telegram Summary Message */}
      <TelegramSummaryMessage
        open={showSummaryModal}
        onOpenChange={setShowSummaryModal}
        games={games}
        methods={bankroll.methods}
      />

      {/* PLANEJAMENTO - Seção Principal */}
      <div className="space-y-4">
        {/* Status Filter Tabs */}
        <GameStatusTabs
          games={sortedPlanned}
          currentFilter={gameStatusFilter}
          onFilterChange={setGameStatusFilter}
          currentSort={gameSortOrder}
          onSortChange={setGameSortOrder}
        />

        {sortedPlanned.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
            title="Nenhum jogo planejado"
            description="Clique em 'Buscar Jogos' para adicionar jogos ao planejamento"
          />
        ) : (
          <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
            <GameListByLeague
              games={sortedPlanned.filter((game) => {
                if (gameStatusFilter === 'all') return true;
                
                const fixtureStatus = game.status;
                const isLive = fixtureStatus === 'Live';
                const isFinished = fixtureStatus === 'Finished';
                
                if (gameStatusFilter === 'live') return isLive;
                if (gameStatusFilter === 'finished') return isFinished;
                if (gameStatusFilter === 'pending') return !isLive && !isFinished;
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
            />
          </div>
        )}
      </div>

      {/* HISTÓRICO - Seção Colapsável */}
      <Collapsible open={showHistory} onOpenChange={setShowHistory}>
        <CollapsibleTrigger asChild>
          <Card className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Histórico</h3>
                  <p className="text-xs text-muted-foreground">
                    {finalizedGames.length} jogos finalizados
                  </p>
                </div>
              </div>
              <ChevronDown className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                showHistory && "rotate-180"
              )} />
            </div>
          </Card>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-4">
          {/* Filtros do histórico */}
          <Card className="p-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={historyPeriod} onValueChange={setHistoryPeriod}>
                <SelectTrigger className="w-full sm:w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="last7">Últimos 7 dias</SelectItem>
                  <SelectItem value="last30">Últimos 30 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              {historyPeriod === 'custom' && (
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateFrom ? format(customDateFrom, 'dd/MM', { locale: ptBR }) : 'De'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateTo ? format(customDateTo, 'dd/MM', { locale: ptBR }) : 'Até'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent mode="single" selected={customDateTo} onSelect={setCustomDateTo} locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </Card>

          {/* Lista de jogos */}
          {groupedHistory.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-8 w-8 text-muted-foreground" />}
              title="Nenhum jogo finalizado"
              description="Jogos com resultados aparecerão aqui"
            />
          ) : (
            <div className="space-y-4">
              {groupedHistory.map(({ date, games }) => (
                <div key={date} className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    {format(new Date(date + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                  </h4>
                  <div className="space-y-2">
                    {games.map((game) => (
                      <Collapsible key={game.id}>
                        <Card className="overflow-hidden">
                          <CollapsibleTrigger className="w-full">
                            <div className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-12">{game.time}</span>
                                <span className="text-sm font-medium">
                                  {game.homeTeam} vs {game.awayTeam}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditGameMethods(game);
                                  }}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                                  title="Editar métodos"
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(game.id);
                                  }}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  title="Remover jogo"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                                <Badge variant="secondary" className="text-[10px]">
                                  {game.methodOperations.filter((op) => op.result === 'Green').length}G •{' '}
                                  {game.methodOperations.filter((op) => op.result === 'Red').length}R
                                </Badge>
                                <ChevronDown className="h-4 w-4" />
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t p-3 space-y-1 bg-muted/20">
                              {game.methodOperations.map((op, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs p-2 bg-background rounded">
                                  <span className="font-medium">{getMethodName(op.methodId)}</span>
                                  <Badge variant={op.result === 'Green' ? 'default' : 'destructive'} className="text-[10px]">
                                    {op.result}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
