import { useState } from "react";
import { useGames } from "@/hooks/useGames";
import { useBankroll } from "@/hooks/useBankroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function DailyPlanning() {
  const { games, addGame, deleteGame } = useGames();
  const { bankroll } = useBankroll();
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    league: "",
    homeTeam: "",
    awayTeam: "",
    methods: [] as string[],
    notes: "",
  });

  const handleSubmit = () => {
    if (!formData.league || !formData.homeTeam || !formData.awayTeam) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (formData.methods.length === 0) {
      toast.error("Selecione ao menos um método");
      return;
    }

    addGame(formData);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      league: "",
      homeTeam: "",
      awayTeam: "",
      methods: [],
      notes: "",
    });
    setShowForm(false);
    toast.success("Jogo adicionado ao planejamento!");
  };

  const toggleMethod = (methodId: string) => {
    setFormData((prev) => ({
      ...prev,
      methods: prev.methods.includes(methodId)
        ? prev.methods.filter((id) => id !== methodId)
        : [...prev.methods, methodId],
    }));
  };

  const sortedGames = [...games].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
          <h2 className="mb-4 text-xl font-bold">Adicionar Jogo</h2>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
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
                Adicionar Jogo
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
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
                      {game.notes && (
                        <p className="text-sm text-muted-foreground">{game.notes}</p>
                      )}
                    </div>
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
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
