import { useState } from "react";
import { useGames } from "@/hooks/useGames";
import { useBankroll } from "@/hooks/useBankroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Plus, Trash2, Edit, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DailyPlanning() {
  const { games, addGame, updateGame, deleteGame } = useGames();
  const { bankroll } = useBankroll();
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    time: "",
    league: "",
    homeTeam: "",
    awayTeam: "",
    methods: [] as string[],
    notes: "",
    operationType: "" as "Back" | "Lay" | "",
    entryOdds: "",
    exitOdds: "",
  });

  const calculateResult = (
    operationType: "Back" | "Lay" | "",
    entryOdds: string,
    exitOdds: string
  ): "Green" | "Red" | undefined => {
    if (!operationType || !entryOdds || !exitOdds) return undefined;
    
    const entry = parseFloat(entryOdds);
    const exit = parseFloat(exitOdds);
    
    if (isNaN(entry) || isNaN(exit)) return undefined;
    
    if (operationType === "Back") {
      return exit < entry ? "Green" : "Red";
    } else {
      return exit > entry ? "Green" : "Red";
    }
  };

  const handleSubmit = () => {
    if (!formData.league || !formData.homeTeam || !formData.awayTeam || !formData.time) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (formData.methods.length === 0) {
      toast.error("Selecione ao menos um método");
      return;
    }

    const result = calculateResult(formData.operationType, formData.entryOdds, formData.exitOdds);
    
    const gameData = {
      date: formData.date,
      time: formData.time,
      league: formData.league,
      homeTeam: formData.homeTeam,
      awayTeam: formData.awayTeam,
      methods: formData.methods,
      notes: formData.notes,
      operationType: formData.operationType || undefined,
      entryOdds: formData.entryOdds ? parseFloat(formData.entryOdds) : undefined,
      exitOdds: formData.exitOdds ? parseFloat(formData.exitOdds) : undefined,
      result,
    };

    if (editingGame) {
      updateGame(editingGame, gameData);
      toast.success("Jogo atualizado!");
      setEditingGame(null);
    } else {
      addGame(gameData);
      toast.success("Jogo adicionado ao planejamento!");
    }

    setFormData({
      date: new Date().toISOString().split("T")[0],
      time: "",
      league: "",
      homeTeam: "",
      awayTeam: "",
      methods: [],
      notes: "",
      operationType: "",
      entryOdds: "",
      exitOdds: "",
    });
    setShowForm(false);
  };

  const handleEdit = (game: any) => {
    setFormData({
      date: game.date,
      time: game.time,
      league: game.league,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      methods: game.methods,
      notes: game.notes || "",
      operationType: game.operationType || "",
      entryOdds: game.entryOdds?.toString() || "",
      exitOdds: game.exitOdds?.toString() || "",
    });
    setEditingGame(game.id);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingGame(null);
    setShowForm(false);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      time: "",
      league: "",
      homeTeam: "",
      awayTeam: "",
      methods: [],
      notes: "",
      operationType: "",
      entryOdds: "",
      exitOdds: "",
    });
  };

  const toggleMethod = (methodId: string) => {
    setFormData((prev) => ({
      ...prev,
      methods: prev.methods.includes(methodId)
        ? prev.methods.filter((id) => id !== methodId)
        : [...prev.methods, methodId],
    }));
  };

  const sortedGames = [...games].sort((a, b) => {
    const dateTimeA = new Date(`${a.date}T${a.time}`).getTime();
    const dateTimeB = new Date(`${b.date}T${b.time}`).getTime();
    return dateTimeA - dateTimeB;
  });

  // Calcular estatísticas
  const gamesWithResults = games.filter(g => g.result);
  const totalGames = gamesWithResults.length;
  const greenGames = gamesWithResults.filter(g => g.result === "Green").length;
  const redGames = gamesWithResults.filter(g => g.result === "Red").length;
  const winRate = totalGames > 0 ? ((greenGames / totalGames) * 100).toFixed(1) : "0.0";

  // Win rate por método
  const methodStats = bankroll.methods.map(method => {
    const methodGames = gamesWithResults.filter(g => g.methods.includes(method.id));
    const methodGreens = methodGames.filter(g => g.result === "Green").length;
    const methodTotal = methodGames.length;
    const methodWinRate = methodTotal > 0 ? ((methodGreens / methodTotal) * 100).toFixed(1) : "0.0";
    
    return {
      name: method.name,
      total: methodTotal,
      greens: methodGreens,
      reds: methodTotal - methodGreens,
      winRate: methodWinRate,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
            <Calendar className="h-6 w-6 text-secondary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Planejamento Diário</h1>
            <p className="text-muted-foreground">Organize os jogos que você vai operar</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Jogo
        </Button>
      </div>

      {showForm && (
        <Card className="p-6 shadow-card">
          <h2 className="mb-4 text-xl font-bold">
            {editingGame ? "Editar Jogo" : "Adicionar Jogo"}
          </h2>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="time">Horário</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="league">Liga</Label>
                <Input
                  id="league"
                  value={formData.league}
                  onChange={(e) => setFormData({ ...formData, league: e.target.value })}
                  placeholder="Ex: Brasileirão Série A"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="home">Time da Casa</Label>
                <Input
                  id="home"
                  value={formData.homeTeam}
                  onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })}
                  placeholder="Time mandante"
                />
              </div>
              <div>
                <Label htmlFor="away">Time Visitante</Label>
                <Input
                  id="away"
                  value={formData.awayTeam}
                  onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })}
                  placeholder="Time visitante"
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Métodos Planejados</Label>
              {bankroll.methods.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Cadastre métodos na Gestão de Banca primeiro
                </p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {bankroll.methods.map((method) => (
                    <div key={method.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={method.id}
                        checked={formData.methods.includes(method.id)}
                        onCheckedChange={() => toggleMethod(method.id)}
                      />
                      <label htmlFor={method.id} className="cursor-pointer text-sm">
                        {method.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="operationType">Tipo de Operação (opcional)</Label>
                <Select
                  value={formData.operationType}
                  onValueChange={(value: "Back" | "Lay") => 
                    setFormData({ ...formData, operationType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Back">Back</SelectItem>
                    <SelectItem value="Lay">Lay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="entryOdds">Odd de Entrada (opcional)</Label>
                <Input
                  id="entryOdds"
                  type="number"
                  step="0.01"
                  value={formData.entryOdds}
                  onChange={(e) => setFormData({ ...formData, entryOdds: e.target.value })}
                  placeholder="Ex: 2.50"
                />
              </div>
              <div>
                <Label htmlFor="exitOdds">Odd de Saída (opcional)</Label>
                <Input
                  id="exitOdds"
                  type="number"
                  step="0.01"
                  value={formData.exitOdds}
                  onChange={(e) => setFormData({ ...formData, exitOdds: e.target.value })}
                  placeholder="Ex: 2.30"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Adicione observações sobre este jogo..."
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="flex-1">
                {editingGame ? "Salvar Alterações" : "Adicionar Jogo"}
              </Button>
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {totalGames > 0 && (
        <Card className="p-6 shadow-card">
          <h2 className="mb-4 text-xl font-bold">Estatísticas</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Total de Operações</p>
              <p className="text-2xl font-bold">{totalGames}</p>
            </div>
            <div className="rounded-lg bg-green-500/10 p-4">
              <p className="text-sm text-muted-foreground">Greens</p>
              <p className="text-2xl font-bold text-green-600">{greenGames}</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-4">
              <p className="text-sm text-muted-foreground">Reds</p>
              <p className="text-2xl font-bold text-red-600">{redGames}</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-4">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold text-primary">{winRate}%</p>
            </div>
          </div>

          {methodStats.some(m => m.total > 0) && (
            <div className="mt-6">
              <h3 className="mb-3 font-bold">Win Rate por Método</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {methodStats
                  .filter(m => m.total > 0)
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

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Jogos Planejados ({games.length})</h2>
        {sortedGames.length === 0 ? (
          <Card className="p-12 text-center shadow-card">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">Nenhum jogo planejado ainda</p>
            <p className="text-sm text-muted-foreground">
              Adicione jogos para organizar suas operações do dia
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sortedGames.map((game) => {
              const methods = bankroll.methods.filter((m) => game.methods.includes(m.id));
              return (
                <Card key={game.id} className="p-6 shadow-card transition-shadow hover:shadow-hover">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-muted px-2 py-1 text-xs font-medium">
                          {new Date(game.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                        <span className="rounded bg-muted px-2 py-1 text-xs font-medium">
                          {game.time}
                        </span>
                        <span className="rounded bg-secondary/10 px-2 py-1 text-xs font-medium text-secondary">
                          {game.league}
                        </span>
                      </div>
                      <div className="text-lg font-bold">
                        {game.homeTeam} <span className="text-muted-foreground">vs</span> {game.awayTeam}
                      </div>
                      {methods.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {methods.map((method) => (
                            <span
                              key={method.id}
                              className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
                            >
                              {method.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {game.operationType && game.entryOdds && game.exitOdds && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">
                            {game.operationType}: {game.entryOdds.toFixed(2)} → {game.exitOdds.toFixed(2)}
                          </span>
                          {game.result && (
                            <span
                              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                                game.result === "Green"
                                  ? "bg-green-500/20 text-green-600"
                                  : "bg-red-500/20 text-red-600"
                              }`}
                            >
                              {game.result === "Green" ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {game.result}
                            </span>
                          )}
                        </div>
                      )}
                      {game.notes && (
                        <p className="text-sm text-muted-foreground">{game.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(game)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                          deleteGame(game.id);
                          toast.success("Jogo removido");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
