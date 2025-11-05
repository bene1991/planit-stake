import { useState, useEffect } from "react";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { useSupabaseBankroll } from "@/hooks/useSupabaseBankroll";
import { updateGameStatuses } from "@/utils/gameStatus";
import { DataMigration } from "@/components/DataMigration";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Calendar, Plus, Download, TrendingUp, CheckCircle, XCircle, Target } from "lucide-react";
import { toast } from "sonner";
import { GameCard } from "@/components/GameCard";
import { GameForm } from "@/components/GameForm";
import { exportGamesToCSV } from "@/utils/exportToCSV";
import { Game } from "@/types";

export default function DailyPlanning() {
  const { games, loading: gamesLoading, addGame, updateGame, deleteGame, refreshGames } = useSupabaseGames();
  const { bankroll, loading: bankrollLoading } = useSupabaseBankroll();
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

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

  const handleExport = () => {
    exportGamesToCSV(games, bankroll.methods);
    toast.success('Dados exportados com sucesso!');
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
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Planejamento Diário</h1>
          <p className="text-sm text-muted-foreground">Organize e acompanhe suas operações</p>
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


      {totalOperations > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Estatísticas</h2>
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <StatCard
              label="Total de Operações"
              value={totalOperations}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatCard
              label="Greens"
              value={greenOperations}
              icon={<CheckCircle className="h-5 w-5 text-green-600" />}
              className="text-green-600"
            />
            <StatCard
              label="Reds"
              value={redOperations}
              icon={<XCircle className="h-5 w-5 text-red-600" />}
              className="text-red-600"
            />
            <StatCard
              label="Win Rate"
              value={`${winRate}%`}
              icon={<Target className="h-5 w-5" />}
            />
          </div>

          {methodStats.some((m) => m.total > 0) && (
            <div className="mt-6 p-6 border rounded-lg">
              <h3 className="mb-3 text-base font-semibold">Win Rate por Método</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {methodStats
                  .filter((m) => m.total > 0)
                  .map((stat) => (
                    <div key={stat.name} className="rounded-lg border bg-card p-4">
                      <p className="mb-2 font-medium text-sm">{stat.name}</p>
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
        </div>
      )}

      <Tabs defaultValue="planning" className="w-full">
        <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0">
          <TabsTrigger 
            value="planning"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            Planejamento ({sortedPlanned.length})
          </TabsTrigger>
          <TabsTrigger 
            value="finalized"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            Finalizados ({sortedFinalized.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-4 mt-6">
          {sortedPlanned.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
              title="Nenhum jogo planejado"
              description="Adicione jogos para começar a planejar suas operações"
            />
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
            <EmptyState
              icon={<CheckCircle className="h-8 w-8 text-muted-foreground" />}
              title="Nenhum jogo finalizado"
              description="Jogos com todos os métodos finalizados aparecerão aqui"
            />
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
