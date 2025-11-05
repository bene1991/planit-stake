import { useState, useEffect, useCallback } from "react";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { useSupabaseBankroll } from "@/hooks/useSupabaseBankroll";
import { updateGameStatuses } from "@/utils/gameStatus";
import { DataMigration } from "@/components/DataMigration";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Calendar, Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { GameCard } from "@/components/GameCard";
import { GameForm } from "@/components/GameForm";
import { FilterBar, FilterOptions } from "@/components/FilterBar";
import { exportGamesToCSV } from "@/utils/exportToCSV";
import { Game } from "@/types";

export default function DailyPlanning() {
  const { games, loading: gamesLoading, addGame, updateGame, deleteGame, refreshGames } = useSupabaseGames();
  const { bankroll, loading: bankrollLoading } = useSupabaseBankroll();
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);

  // Auto-update game statuses every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      updateStatuses();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [games]);

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
    toast.success('Status dos jogos atualizado!');
  };

  const handleSubmit = (gameData: Omit<Game, "id">) => {
    if (editingGame) {
      updateGame(editingGame.id, gameData);
      toast.success("Jogo atualizado!");
      setEditingGame(null);
    } else {
      addGame(gameData);
      toast.success("Jogo adicionado ao planejamento!");
    }
    setShowForm(false);
  };

  const handleEdit = (game: Game) => {
    setEditingGame(game);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingGame(null);
    setShowForm(false);
  };

  const handleDelete = (gameId: string) => {
    deleteGame(gameId);
    toast.success("Jogo removido");
  };

  const applyFilters = useCallback((filters: FilterOptions) => {
    let result = [...games];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (g) =>
          g.homeTeam.toLowerCase().includes(searchLower) ||
          g.awayTeam.toLowerCase().includes(searchLower) ||
          g.league.toLowerCase().includes(searchLower) ||
          g.notes?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.dateFrom) {
      result = result.filter((g) => new Date(g.date) >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      result = result.filter((g) => new Date(g.date) <= filters.dateTo!);
    }

    if (filters.leagues.length > 0) {
      result = result.filter((g) => filters.leagues.includes(g.league));
    }

    if (filters.methods.length > 0) {
      result = result.filter((g) =>
        g.methodOperations.some((op) => filters.methods.includes(op.methodId))
      );
    }

    if (filters.result !== 'all') {
      if (filters.result === 'pending') {
        result = result.filter((g) =>
          g.methodOperations.some((op) => !op.result)
        );
      } else if (filters.result === 'green') {
        result = result.filter((g) =>
          g.methodOperations.some((op) => op.result === 'Green')
        );
      } else if (filters.result === 'red') {
        result = result.filter((g) =>
          g.methodOperations.some((op) => op.result === 'Red')
        );
      }
    }

    if (filters.status !== 'all') {
      const statusMap: Record<string, string> = {
        'not-started': 'Not Started',
        'live': 'Live',
        'finished': 'Finished',
      };
      result = result.filter((g) => g.status === statusMap[filters.status]);
    }

    setFilteredGames(result);
  }, [games]);

  const handleExport = () => {
    const gamesToExport = filteredGames.length > 0 ? filteredGames : games;
    exportGamesToCSV(gamesToExport, bankroll.methods);
    toast.success('Dados exportados com sucesso!');
  };

  // Usar jogos filtrados se houver filtros aplicados
  const displayGames = filteredGames.length > 0 ? filteredGames : games;

  // Separar jogos em planejados e finalizados
  const plannedGames = displayGames.filter((game) =>
    game.methodOperations.some((op) => !op.result)
  );

  const finalizedGames = displayGames.filter((game) =>
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
  const sortedFinalized = sortGames(finalizedGames);

  // Calcular estatísticas
  const allOperations = finalizedGames.flatMap((g) => g.methodOperations);
  const totalOperations = allOperations.length;
  const greenOperations = allOperations.filter((op) => op.result === "Green").length;
  const redOperations = allOperations.filter((op) => op.result === "Red").length;
  const winRate = totalOperations > 0 ? ((greenOperations / totalOperations) * 100).toFixed(1) : "0.0";

  // Win rate por método
  const methodStats = bankroll.methods.map((method) => {
    const methodOps = allOperations.filter((op) => op.methodId === method.id);
    const methodGreens = methodOps.filter((op) => op.result === "Green").length;
    const methodTotal = methodOps.length;
    const methodWinRate = methodTotal > 0 ? ((methodGreens / methodTotal) * 100).toFixed(1) : "0.0";

    return {
      name: method.name,
      total: methodTotal,
      greens: methodGreens,
      reds: methodTotal - methodGreens,
      winRate: methodWinRate,
    };
  });

  if (gamesLoading || bankrollLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DataMigration />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
            <Calendar className="h-6 w-6 text-secondary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Planejamento Diário</h1>
            <p className="text-muted-foreground">Organize e acompanhe suas operações</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
          <Button variant="outline" onClick={updateStatuses}>
            <span className="hidden sm:inline">Atualizar status</span>
            <span className="sm:hidden">Atualizar</span>
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Novo Jogo</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {showForm && (
        <GameForm
          methods={bankroll.methods}
          editingGame={editingGame}
          onSubmit={handleSubmit}
          onCancel={handleCancelEdit}
        />
      )}

      <FilterBar 
        games={games} 
        methods={bankroll.methods} 
        onFilterChange={applyFilters}
      />

      {totalOperations > 0 && (
        <Card className="p-6 shadow-card">
          <h2 className="mb-4 text-xl font-bold">Estatísticas</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Total de Operações</p>
              <p className="text-2xl font-bold">{totalOperations}</p>
            </div>
            <div className="rounded-lg bg-green-500/10 p-4">
              <p className="text-sm text-muted-foreground">Greens</p>
              <p className="text-2xl font-bold text-green-600">{greenOperations}</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-4">
              <p className="text-sm text-muted-foreground">Reds</p>
              <p className="text-2xl font-bold text-red-600">{redOperations}</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-4">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold text-primary">{winRate}%</p>
            </div>
          </div>

          {methodStats.some((m) => m.total > 0) && (
            <div className="mt-6">
              <h3 className="mb-3 font-bold">Win Rate por Método</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {methodStats
                  .filter((m) => m.total > 0)
                  .map((stat) => (
                    <div key={stat.name} className="rounded-lg border bg-card p-4">
                      <p className="mb-2 font-medium">{stat.name}</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {stat.total} op. • {stat.greens}G / {stat.reds}R
                        </span>
                        <span className="font-bold text-primary">{stat.winRate}%</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Tabs defaultValue="planning" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="planning">
            Planejamento ({sortedPlanned.length})
          </TabsTrigger>
          <TabsTrigger value="finalized">
            Finalizados ({sortedFinalized.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-4 mt-6">
          {sortedPlanned.length === 0 ? (
            <Card className="p-12 text-center shadow-card">
              <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">Nenhum jogo planejado ainda</p>
              <p className="text-sm text-muted-foreground">
                Adicione jogos para organizar suas operações do dia
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sortedPlanned.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  methods={bankroll.methods}
                  onUpdate={updateGame}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="finalized" className="space-y-4 mt-6">
          {sortedFinalized.length === 0 ? (
            <Card className="p-12 text-center shadow-card">
              <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">Nenhum jogo finalizado ainda</p>
              <p className="text-sm text-muted-foreground">
                Jogos com todos os métodos finalizados aparecerão aqui
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sortedFinalized.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  methods={bankroll.methods}
                  onUpdate={updateGame}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  isFinalized
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
