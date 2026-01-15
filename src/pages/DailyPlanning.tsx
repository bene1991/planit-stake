import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { useSupabaseBankroll } from "@/hooks/useSupabaseBankroll";
import { useOptimizedLiveStats } from "@/hooks/useOptimizedLiveStats";
import { usePlanningFilters } from "@/hooks/usePlanningFilters";
import { useDeleteWithUndo } from "@/hooks/useDeleteWithUndo";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useGoalNotifications } from "@/hooks/useGoalNotifications";
import { updateGameStatuses } from "@/utils/gameStatus";
import { rebuildStats } from "@/utils/rebuildStats";

import { DataMigration } from "@/components/DataMigration";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Calendar, Download, CheckCircle, XCircle, RefreshCw, CalendarIcon, ChevronDown, Globe, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GameCardCompact } from "@/components/GameCardCompact";
import { MethodSelector } from "@/components/MethodSelector";
import { GameMethodEditor } from "@/components/GameMethodEditor";
import { ApiGameBrowser, SelectedGame } from "@/components/ApiGameBrowser";
import { ApiRequestIndicator } from "@/components/ApiRequestIndicator";
import { exportGamesToCSV } from "@/utils/exportToCSV";
import { Game } from "@/types";
import { Badge } from "@/components/ui/badge";

import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function DailyPlanning() {
  const { games, loading: gamesLoading, addGame, updateGame, deleteGame, refreshGames } = useSupabaseGames();
  const { bankroll, loading: bankrollLoading } = useSupabaseBankroll();
  
  const [showApiBrowser, setShowApiBrowser] = useState(false);
  
  const [rebuildingStats, setRebuildingStats] = useState(false);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [selectedDailyGames, setSelectedDailyGames] = useState<string[]>([]);
  const [addingToPlanning, setAddingToPlanning] = useState(false);
  const [showGameMethodEditor, setShowGameMethodEditor] = useState(false);
  const [selectedGameForEdit, setSelectedGameForEdit] = useState<Game | null>(null);
  const [updatingGameMethods, setUpdatingGameMethods] = useState(false);
  
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
  
  // Optimized live stats - single API call for all fixtures
  const { 
    getStatsForGame, 
    fetchGameDetails, 
    refresh: refreshLiveStats, 
    loading: statsLoading,
    lastRefresh 
  } = useOptimizedLiveStats(games);
  
  // Goal notifications for background monitoring
  const { setLiveGames, startMonitoring, updateScoreSnapshot } = useGoalNotifications();
  
  // Start goal monitoring when games change
  useEffect(() => {
    setLiveGames(games);
    startMonitoring();
  }, [games, setLiveGames, startMonitoring]);
  
  // Timestamp do último refresh global (para sincronizar tempo nos cards)
  const [lastGlobalRefresh, setLastGlobalRefresh] = useState<number>(0);

  // Auto-refresh após mount para combater cold start de Edge Functions
  const initialLoadRef = useRef(false);
  
  useEffect(() => {
    if (!gamesLoading && games.length > 0 && !initialLoadRef.current) {
      initialLoadRef.current = true;
      
      // Delay para permitir que Edge Functions "acordem"
      const timer = setTimeout(() => {
        console.log('[DailyPlanning] Auto-refresh após mount (cold start mitigation)');
        refreshLiveStats(true); // forceNoCache=true
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [gamesLoading, games.length, refreshLiveStats]);
  
  const handleGlobalRefresh = async () => {
    await updateStatuses();
    await refreshLiveStats(true); // forceNoCache=true para evitar dados antigos
    
    // Buscar detalhes para jogos ao vivo que não têm dados completos
    const liveGames = games.filter(g => 
      (g.status === 'Live' || g.status === 'Pending') && g.api_fixture_id
    );
    
    // Buscar detalhes para até 5 jogos ao vivo
    const gamesToFetch = liveGames.slice(0, 5);
    console.log(`[DailyPlanning] Buscando detalhes para ${gamesToFetch.length} jogos ao vivo`);
    
    for (const game of gamesToFetch) {
      try {
        await fetchGameDetails(parseInt(game.api_fixture_id!));
      } catch (error) {
        console.error(`[DailyPlanning] Erro ao buscar detalhes para ${game.homeTeam} x ${game.awayTeam}:`, error);
      }
    }
    
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

  const handleRebuildStats = async () => {
    setRebuildingStats(true);
    try {
      const result = await rebuildStats();
      await refreshGames();
      toast.success('Estatísticas recalculadas!', {
        description: `${result.greens}G • ${result.reds}R • ${result.winRate}% win rate`,
      });
    } catch (error: any) {
      toast.error('Erro ao recalcular: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setRebuildingStats(false);
    }
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
  const getTodayDate = () => {
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const localOffset = now.getTimezoneOffset();
    const offsetDiff = localOffset - brasiliaOffset;
    const today = new Date(now.getTime() + offsetDiff * 60000);
    return format(today, 'yyyy-MM-dd');
  };
  
  const todayDate = getTodayDate();

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

  // Stats do histórico
  const historyStats = useMemo(() => {
    const allOps = filteredHistory.flatMap((g) => g.methodOperations);
    const greens = allOps.filter((op) => op.result === 'Green').length;
    const reds = allOps.filter((op) => op.result === 'Red').length;
    const total = greens + reds;
    const winRate = total > 0 ? (greens / total) * 100 : 0;
    return { totalGames: filteredHistory.length, greens, reds, winRate: winRate.toFixed(1) };
  }, [filteredHistory]);

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
  const winRate = totalOperations > 0 ? ((greenOperations / totalOperations) * 100).toFixed(1) : "0.0";
  const liveGames = games.filter(g => g.status === 'Live').length;
  
  // Check if there are any live or pending games that need auto-refresh
  const hasActiveGames = useMemo(() => {
    return games.some(g => g.status === 'Live' || g.status === 'Pending');
  }, [games]);
  
  // Auto-refresh every 60 seconds when there are live/pending games
  const { secondsUntilRefresh, isRefreshing } = useAutoRefresh(
    handleGlobalRefresh,
    { intervalMs: 60000, enabled: hasActiveGames }
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
    <div className="space-y-4 pb-8">
      <DataMigration />
      
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
            disabled={statsLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 sm:mr-2", statsLoading && "animate-spin")} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button variant="default" size="sm" onClick={() => setShowApiBrowser(true)} className="h-8">
            <Globe className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Buscar Jogos</span>
          </Button>
        </div>
      </div>

      {/* Last Refresh Info */}
      {lastRefresh && (
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

      {/* PLANEJAMENTO - Seção Principal */}
      <div className="space-y-4">
        {sortedPlanned.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
            title="Nenhum jogo planejado"
            description="Clique em 'Buscar Jogos' para adicionar jogos ao planejamento"
          />
        ) : (
          <>
            {/* Grid de Jogos */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {sortedPlanned.map((game) => {
                const fixtureData = getStatsForGame(game);
                  return (
                    <GameCardCompact
                      key={game.id}
                      game={game}
                      methods={bankroll.methods}
                      onUpdate={updateGame}
                      onDelete={handleDelete}
                      onEdit={handleEditGameMethods}
                      fixtureData={fixtureData}
                      lastGlobalRefresh={lastGlobalRefresh}
                    />
                  );
              })}
            </div>
          </>
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

          {/* Resumo */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Resumo do Período</h3>
              <Button onClick={handleRebuildStats} disabled={rebuildingStats} variant="outline" size="sm" className="h-8">
                <RefreshCw className={cn('h-3 w-3 mr-2', rebuildingStats && 'animate-spin')} />
                Recalcular
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Jogos</p>
                <p className="text-xl font-bold">{historyStats.totalGames}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Greens</p>
                <p className="text-xl font-bold text-primary">{historyStats.greens}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reds</p>
                <p className="text-xl font-bold text-destructive">{historyStats.reds}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="text-xl font-bold">{historyStats.winRate}%</p>
              </div>
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
