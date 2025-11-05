import { useState, useEffect, useRef } from "react";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { useSupabaseBankroll } from "@/hooks/useSupabaseBankroll";
import { updateGameStatuses } from "@/utils/gameStatus";
import { DataMigration } from "@/components/DataMigration";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Calendar, Plus, Download, TrendingUp, CheckCircle, XCircle, Target, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { GameCard } from "@/components/GameCard";
import { GameForm } from "@/components/GameForm";
import { exportGamesToCSV } from "@/utils/exportToCSV";
import { Game } from "@/types";
import { Badge } from "@/components/ui/badge";

export default function DailyPlanning() {
  const { games, loading: gamesLoading, addGame, updateGame, deleteGame, refreshGames } = useSupabaseGames();
  const { bankroll, loading: bankrollLoading } = useSupabaseBankroll();
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

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

  // Calcular estatísticas rápidas
  const allOperations = finalizedGames.flatMap((g) => g.methodOperations);
  const totalOperations = allOperations.length;
  const greenOperations = allOperations.filter((op) => op.result === "Green").length;
  const redOperations = allOperations.filter((op) => op.result === "Red").length;
  const winRate = totalOperations > 0 ? ((greenOperations / totalOperations) * 100).toFixed(1) : "0.0";

  // Contar jogos LIVE
  const liveGames = games.filter(g => g.status === 'Live').length;

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
          <h1 className="text-xl font-bold flex items-center gap-2">
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
          <Button size="sm" onClick={() => setShowForm(!showForm)} className="h-8">
            <Plus className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Novo Jogo</span>
          </Button>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          <GameForm
            methods={bankroll.methods}
            editingGame={editingGame}
            onSubmit={handleSubmit}
            onCancel={handleCancelEdit}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="planning" className="w-full">
        <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0 h-auto">
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
            {sortedFinalized.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {sortedFinalized.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Grid responsivo: 1 coluna mobile, 2 colunas tablet+, 3 colunas desktop */}
        <TabsContent value="planning" className="mt-4">
          {sortedPlanned.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
              title="Nenhum jogo planejado"
              description="Adicione jogos para começar a planejar suas operações"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedPlanned.map((game) => (
                <div key={game.id} className="animate-in fade-in-50 duration-200">
                  <GameCard
                    game={game}
                    methods={bankroll.methods}
                    onUpdate={updateGame}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="finalized" className="mt-4">
          {sortedFinalized.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-8 w-8 text-muted-foreground" />}
              title="Nenhum jogo finalizado"
              description="Jogos com todos os métodos finalizados aparecerão aqui"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedFinalized.map((game) => (
                <div key={game.id} className="animate-in fade-in-50 duration-200">
                  <GameCard
                    game={game}
                    methods={bankroll.methods}
                    onUpdate={updateGame}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    isFinalized
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
