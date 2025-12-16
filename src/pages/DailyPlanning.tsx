import { useState, useEffect, useRef, useMemo } from "react";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { useSupabaseBankroll } from "@/hooks/useSupabaseBankroll";
import { useSettings } from "@/hooks/useSettings";
import { useDailyGames } from "@/hooks/useDailyGames";
import { usePlanningLiveStats } from "@/hooks/usePlanningLiveStats";
import { updateGameStatuses } from "@/utils/gameStatus";
import { rebuildStats } from "@/utils/rebuildStats";
import { DataMigration } from "@/components/DataMigration";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { Calendar, Download, CheckCircle, XCircle, RefreshCw, Search, CalendarIcon, ChevronDown, Globe } from "lucide-react";
import { toast } from "sonner";
import { GameCardCompact } from "@/components/GameCardCompact";
import { GameImporter } from "@/components/GameImporter";
import { DailyGamesTab } from "@/components/DailyGamesTab";
import { MethodSelector } from "@/components/MethodSelector";
import { GameMethodEditor } from "@/components/GameMethodEditor";
import { GoogleSheetsSync } from "@/components/GoogleSheetsSync";
import { ApiGameBrowser, SelectedGame } from "@/components/ApiGameBrowser";
import { exportGamesToCSV } from "@/utils/exportToCSV";
import { Game } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  const { settings } = useSettings();
  const { dailyGames, loading: dailyGamesLoading, loadDailyGames, markAsAdded } = useDailyGames();
  const [showImporter, setShowImporter] = useState(false);
  const [showApiBrowser, setShowApiBrowser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState('today');
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  const [rebuildingStats, setRebuildingStats] = useState(false);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [selectedDailyGames, setSelectedDailyGames] = useState<string[]>([]);
  const [addingToPlanning, setAddingToPlanning] = useState(false);
  const [showGameMethodEditor, setShowGameMethodEditor] = useState(false);
  const [selectedGameForEdit, setSelectedGameForEdit] = useState<Game | null>(null);
  const [updatingGameMethods, setUpdatingGameMethods] = useState(false);
  
  // Live stats for planning games
  const { getStatsForGame } = usePlanningLiveStats(games);
  
  // Filtros da aba Planejamento
  const [planningMethodFilter, setPlanningMethodFilter] = useState<string>('all');
  const [planningStatusFilter, setPlanningStatusFilter] = useState<string>('all');
  const [planningLeagueFilter, setPlanningLeagueFilter] = useState<string>('all');
  const [planningSearchQuery, setPlanningSearchQuery] = useState('');

  const updateStatuses = async () => {
    const updatedGames = updateGameStatuses(games);
    
    // Update games with changed statuses
    for (const game of updatedGames) {
      const originalGame = games.find(g => g.id === game.id);
      if (originalGame && originalGame.status !== game.status) {
        await updateGame(game.id, { status: game.status });
      }
    }
    
    await refreshGames();
    if (import.meta.env.DEV) {
      console.log('✅ Game statuses updated at (UTC-3)', new Date().toISOString());
    }
  };

  // Criar referência estável para updateStatuses
  const updateStatusesRef = useRef(updateStatuses);

  useEffect(() => {
    updateStatusesRef.current = updateStatuses;
  }, [games, updateGame, refreshGames]);

  // Auto-update game statuses every 30 seconds (mais frequente)
  useEffect(() => {
    // Atualizar imediatamente ao carregar
    updateStatusesRef.current();
    
    // Depois atualizar a cada 30 segundos
    const interval = setInterval(() => {
      updateStatusesRef.current();
    }, 30 * 1000); // 30 segundos

    return () => clearInterval(interval);
  }, []); // Array vazio - interval nunca reseta

  const handleDelete = (gameId: string) => {
    deleteGame(gameId);
    toast.success("Jogo removido");
  };

  const handleExport = () => {
    exportGamesToCSV(games, bankroll.methods);
    toast.success('Dados exportados com sucesso!');
  };

  const handleRebuildStats = async () => {
    setRebuildingStats(true);
    try {
      const result = await rebuildStats();
      await refreshGames();
      
      toast.success('✅ Estatísticas recalculadas!', {
        description: `${result.greens}G • ${result.reds}R • ${result.winRate}% win rate`,
      });
    } catch (error: any) {
      toast.error('Erro ao recalcular: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setRebuildingStats(false);
    }
  };

  const handleAddToPlanning = (gameIds: string[]) => {
    setSelectedDailyGames(gameIds);
    setShowMethodSelector(true);
  };

  const handleEditGameMethods = (game: Game) => {
    setSelectedGameForEdit(game);
    setShowGameMethodEditor(true);
  };

  const handleConfirmGameMethodsEdit = async (gameId: string, methodOperations: any[]) => {
    setUpdatingGameMethods(true);
    try {
      await updateGame(gameId, { methodOperations });
      toast.success('Métodos atualizados com sucesso!');
      setShowGameMethodEditor(false);
      setSelectedGameForEdit(null);
    } catch (error: any) {
      toast.error('Erro ao atualizar métodos: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setUpdatingGameMethods(false);
    }
  };

  const handleConfirmMethod = async (methodIds: string[]) => {
    setAddingToPlanning(true);
    try {
      const gamesToAdd = dailyGames.filter(g => selectedDailyGames.includes(g.id));
      
      for (const dailyGame of gamesToAdd) {
        // Create method operations for each selected method
        const methodOperations = methodIds.map(methodId => ({
          methodId: methodId,
          operationType: undefined,
          entryOdds: undefined,
          exitOdds: undefined,
          result: undefined,
        }));

        // Add game to planning with all selected methods
        await addGame({
          date: dailyGame.date,
          time: dailyGame.time,
          league: dailyGame.league,
          homeTeam: dailyGame.home_team,
          awayTeam: dailyGame.away_team,
          status: dailyGame.status,
          homeTeamLogo: dailyGame.home_team_logo || undefined,
          awayTeamLogo: dailyGame.away_team_logo || undefined,
          methodOperations: methodOperations,
        });

        // Mark as added in daily_games
        await markAsAdded(dailyGame.id);
      }

      const totalMethods = gamesToAdd.length * methodIds.length;
      toast.success(`${gamesToAdd.length} jogo(s) adicionado(s) com ${methodIds.length} método(s) cada!`);
      await loadDailyGames();
      setShowMethodSelector(false);
      setSelectedDailyGames([]);
    } catch (error) {
      console.error('Error adding games to planning:', error);
      toast.error('Erro ao adicionar jogos ao planejamento');
    } finally {
      setAddingToPlanning(false);
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
      });
    }
    toast.success(`${selectedGames.length} jogo(s) adicionado(s) ao planejamento!`);
    await refreshGames();
  };

  // Separar jogos em planejados e finalizados
  const plannedGames = games.filter((game) =>
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

  const sortedPlanned = sortGames(plannedGames);

  // Filtros avançados para aba Planejamento
  const filteredPlannedGames = useMemo(() => {
    let filtered = [...sortedPlanned];

    // Filtro por busca (time ou liga)
    if (planningSearchQuery) {
      const query = planningSearchQuery.toLowerCase();
      filtered = filtered.filter(game => 
        game.homeTeam.toLowerCase().includes(query) ||
        game.awayTeam.toLowerCase().includes(query) ||
        game.league.toLowerCase().includes(query)
      );
    }

    // Filtro por método
    if (planningMethodFilter !== 'all') {
      filtered = filtered.filter(game =>
        game.methodOperations.some(op => op.methodId === planningMethodFilter)
      );
    }

    // Filtro por status
    if (planningStatusFilter !== 'all') {
      if (planningStatusFilter === 'configured') {
        // Todos os métodos configurados
        filtered = filtered.filter(game =>
          game.methodOperations.every(op => op.result)
        );
      } else if (planningStatusFilter === 'pending') {
        // Pelo menos um método pendente
        filtered = filtered.filter(game =>
          game.methodOperations.some(op => !op.result)
        );
      } else if (planningStatusFilter === 'live') {
        filtered = filtered.filter(game => game.status === 'Live');
      }
    }

    // Filtro por liga
    if (planningLeagueFilter !== 'all') {
      filtered = filtered.filter(game => game.league === planningLeagueFilter);
    }

    return filtered;
  }, [sortedPlanned, planningSearchQuery, planningMethodFilter, planningStatusFilter, planningLeagueFilter]);


  // Extrair ligas únicas para o filtro
  const uniqueLeagues = useMemo(() => {
    const leagues = new Set(sortedPlanned.map(game => game.league));
    return Array.from(leagues).sort();
  }, [sortedPlanned]);

  // Aplicar filtro de período aos jogos finalizados
  const filteredByPeriod = useMemo(() => {
    // Usar horário de Brasília (UTC-3)
    const now = new Date();
    const brasiliaOffset = -3 * 60; // UTC-3 em minutos
    const localOffset = now.getTimezoneOffset();
    const offsetDiff = localOffset - brasiliaOffset;
    
    const today = new Date(now.getTime() + offsetDiff * 60000);
    today.setHours(0, 0, 0, 0);

    return finalizedGames.filter((game) => {
      // Parse da data do jogo considerando formato YYYY-MM-DD
      const [year, month, day] = game.date.split('-').map(Number);
      const gameDate = new Date(year, month - 1, day);
      gameDate.setHours(0, 0, 0, 0);

      switch (periodFilter) {
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
  }, [finalizedGames, periodFilter, customDateFrom, customDateTo]);

  // Aplicar busca por time/liga
  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return filteredByPeriod;
    const query = searchQuery.toLowerCase();
    return filteredByPeriod.filter(
      (game) =>
        game.homeTeam.toLowerCase().includes(query) ||
        game.awayTeam.toLowerCase().includes(query) ||
        game.league.toLowerCase().includes(query)
    );
  }, [filteredByPeriod, searchQuery]);

  // Agrupar por data
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Game[]>();
    filteredGames.forEach((game) => {
      const dateKey = game.date;
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(game);
    });

    // Ordenar jogos dentro de cada data por horário
    groups.forEach((games) => {
      games.sort((a, b) => a.time.localeCompare(b.time));
    });

    // Converter para array e ordenar por data (mais recente primeiro)
    return Array.from(groups.entries())
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, games]) => ({ date, games }));
  }, [filteredGames]);

  // Calcular estatísticas do período
  const periodStats = useMemo(() => {
    const allOps = filteredGames.flatMap((g) => g.methodOperations);
    const greens = allOps.filter((op) => op.result === 'Green').length;
    const reds = allOps.filter((op) => op.result === 'Red').length;
    const total = greens + reds;
    const winRate = total > 0 ? (greens / total) * 100 : 0;

    return {
      totalGames: filteredGames.length,
      totalMethods: allOps.length,
      greens,
      reds,
      winRate: winRate.toFixed(1),
    };
  }, [filteredGames]);

  // Calcular estatísticas rápidas
  const allOperations = finalizedGames.flatMap((g) => g.methodOperations);
  const totalOperations = allOperations.length;
  const greenOperations = allOperations.filter((op) => op.result === "Green").length;
  const redOperations = allOperations.filter((op) => op.result === "Red").length;
  const winRate = totalOperations > 0 ? ((greenOperations / totalOperations) * 100).toFixed(1) : "0.0";

  // Contar jogos LIVE
  const liveGames = games.filter(g => g.status === 'Live').length;

  const getMethodName = (methodId: string) => {
    return bankroll.methods.find((m) => m.id === methodId)?.name || 'Método desconhecido';
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
      
      {/* Header compacto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Planejamento Diário
            {liveGames > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {liveGames} LIVE
              </Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {totalOperations > 0 && (
              <span>{greenOperations}G • {redOperations}R • {winRate}% win rate</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
            <Download className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={updateStatuses} className="h-8">
            <RefreshCw className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button variant="default" size="sm" onClick={() => setShowApiBrowser(true)} className="h-8">
            <Globe className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Buscar Jogos</span>
          </Button>
          <GoogleSheetsSync 
            onSuccess={() => {
              loadDailyGames();
            }} 
          />
        </div>
      </div>

      {/* API Game Browser */}
      <ApiGameBrowser
        open={showApiBrowser}
        onOpenChange={setShowApiBrowser}
        methods={bankroll.methods}
        onAddGames={handleAddFromApi}
      />
      {/* Importador */}
      <GameImporter
        open={showImporter}
        onOpenChange={setShowImporter}
        onSuccess={() => {
          refreshGames();
          loadDailyGames();
        }}
        lastImportDate={settings?.last_import_date}
      />

      {/* Method Selector */}
      <MethodSelector
        open={showMethodSelector}
        onOpenChange={setShowMethodSelector}
        methods={bankroll.methods}
        onConfirm={handleConfirmMethod}
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

      {/* Tabs */}
      <Tabs defaultValue="planning" className="w-full">
        <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0 h-auto">
          <TabsTrigger 
            value="daily"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-sm"
          >
            Jogos do Dia
            {dailyGames.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {dailyGames.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="planning"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-sm"
          >
            Planejamento
            {sortedPlanned.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {sortedPlanned.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="finalized"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-sm"
          >
            Finalizados
            {filteredGames.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {filteredGames.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Jogos do Dia Tab */}
        <TabsContent value="daily" className="mt-4">
          <DailyGamesTab
            dailyGames={dailyGames}
            onRefresh={loadDailyGames}
            onAddToPlanning={handleAddToPlanning}
            loading={dailyGamesLoading}
          />
        </TabsContent>

        {/* Grid responsivo: 1 coluna mobile, 2 colunas tablet+, 3 colunas desktop */}
        <TabsContent value="planning" className="mt-4 space-y-4">
          {sortedPlanned.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
              title="Nenhum jogo planejado"
              description="Adicione jogos para começar a planejar suas operações"
            />
          ) : (
            <>
              {/* Filtros Avançados */}
              <Card className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Busca */}
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por time ou liga..."
                          value={planningSearchQuery}
                          onChange={(e) => setPlanningSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    {/* Filtro por Método */}
                    <Select value={planningMethodFilter} onValueChange={setPlanningMethodFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Todos os métodos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os métodos</SelectItem>
                        {bankroll.methods.map(method => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Filtro por Status */}
                    <Select value={planningStatusFilter} onValueChange={setPlanningStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Todos os status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="configured">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            Configurados
                          </div>
                        </SelectItem>
                        <SelectItem value="pending">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-3 w-3 text-orange-600" />
                            Pendentes
                          </div>
                        </SelectItem>
                        <SelectItem value="live">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                            Ao Vivo
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Filtro por Liga */}
                    <Select value={planningLeagueFilter} onValueChange={setPlanningLeagueFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Todas as ligas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as ligas</SelectItem>
                        {uniqueLeagues.map(league => (
                          <SelectItem key={league} value={league}>
                            {league}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Indicador de filtros ativos */}
                  {(planningSearchQuery || planningMethodFilter !== 'all' || planningStatusFilter !== 'all' || planningLeagueFilter !== 'all') && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">
                        Mostrando {filteredPlannedGames.length} de {sortedPlanned.length} jogos
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPlanningSearchQuery('');
                          setPlanningMethodFilter('all');
                          setPlanningStatusFilter('all');
                          setPlanningLeagueFilter('all');
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        Limpar filtros
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Lista de Jogos */}
              {filteredPlannedGames.length === 0 ? (
                <EmptyState
                  icon={<Search className="h-8 w-8 text-muted-foreground" />}
                  title="Nenhum jogo encontrado"
                  description="Tente ajustar os filtros para ver mais resultados"
                />
              ) : (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPlannedGames.map((game) => (
                    <GameCardCompact
                      key={game.id}
                      game={game}
                      methods={bankroll.methods}
                      onUpdate={updateGame}
                      onDelete={handleDelete}
                      onEdit={handleEditGameMethods}
                      liveStats={getStatsForGame(game.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="finalized" className="mt-4 space-y-4">
          {/* Filtros e Busca */}
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por time ou liga..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="last7">Últimos 7 dias</SelectItem>
                  <SelectItem value="last30">Últimos 30 dias</SelectItem>
                  <SelectItem value="custom">Período personalizado</SelectItem>
                </SelectContent>
              </Select>
              {periodFilter === 'custom' && (
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateFrom ? format(customDateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'De'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateTo ? format(customDateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Até'}
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

          {/* Resumo do período */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Resumo do Período</h3>
              <Button onClick={handleRebuildStats} disabled={rebuildingStats} variant="outline" size="sm">
                <RefreshCw className={cn('h-4 w-4 mr-2', rebuildingStats && 'animate-spin')} />
                Recalcular
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Jogos</p>
                <p className="text-2xl font-bold">{periodStats.totalGames}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Métodos</p>
                <p className="text-2xl font-bold">{periodStats.totalMethods}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Greens</p>
                <p className="text-2xl font-bold text-green-600">{periodStats.greens}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reds</p>
                <p className="text-2xl font-bold text-red-600">{periodStats.reds}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{periodStats.winRate}%</p>
              </div>
            </div>
          </Card>

          {/* Lista agrupada por data */}
          {groupedByDate.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-8 w-8 text-muted-foreground" />}
              title="Nenhum jogo finalizado"
              description="Jogos com todos os métodos finalizados aparecerão aqui"
            />
          ) : (
            <div className="space-y-6">
              {groupedByDate.map(({ date, games }) => (
                <div key={date} className="space-y-3">
                  <h3 className="text-lg font-semibold">
                    {format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </h3>
                  <div className="space-y-2">
                    {games.map((game) => (
                      <Collapsible key={game.id}>
                        <Card className="overflow-hidden">
                          <CollapsibleTrigger className="w-full">
                            <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="text-sm text-muted-foreground">{game.time}</div>
                                <div className="font-medium">
                                  {game.homeTeam} vs {game.awayTeam}
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {game.league}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={game.methodOperations.filter((op) => op.result === 'Green').length > 0 ? 'default' : 'destructive'}>
                                  {game.methodOperations.filter((op) => op.result === 'Green').length}G •{' '}
                                  {game.methodOperations.filter((op) => op.result === 'Red').length}R
                                </Badge>
                                <ChevronDown className="h-4 w-4" />
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t p-4 space-y-2 bg-muted/20">
                              {game.methodOperations.map((op, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm p-2 bg-background rounded">
                                  <span className="font-medium">{getMethodName(op.methodId)}</span>
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline">{op.operationType || 'N/A'}</Badge>
                                    <span className="text-muted-foreground">
                                      {op.entryOdds?.toFixed(2)} → {op.exitOdds?.toFixed(2)}
                                    </span>
                                    <Badge variant={op.result === 'Green' ? 'default' : 'destructive'}>
                                      {op.result}
                                    </Badge>
                                  </div>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
