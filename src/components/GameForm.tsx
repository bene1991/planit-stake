import { useState, useEffect } from "react";
import { Game, Method } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface GameFormProps {
  methods: Method[];
  editingGame: Game | null;
  onSubmit: (gameData: Omit<Game, "id">) => void;
  onCancel: () => void;
}

export function GameForm({ methods, editingGame, onSubmit, onCancel }: GameFormProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    time: "",
    league: "",
    homeTeam: "",
    awayTeam: "",
    selectedMethods: [] as string[],
    notes: "",
  });

  useEffect(() => {
    if (editingGame) {
      setFormData({
        date: editingGame.date,
        time: editingGame.time,
        league: editingGame.league,
        homeTeam: editingGame.homeTeam,
        awayTeam: editingGame.awayTeam,
        selectedMethods: editingGame.methodOperations.map((op) => op.methodId),
        notes: editingGame.notes || "",
      });
    }
  }, [editingGame]);

  const handleSubmit = () => {
    if (!formData.league || !formData.homeTeam || !formData.awayTeam || !formData.time) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (formData.selectedMethods.length === 0) {
      toast.error("Selecione ao menos um método");
      return;
    }

    const methodOperations = formData.selectedMethods.map((methodId) => {
      // Se estiver editando, manter os dados existentes do método
      if (editingGame) {
        const existing = editingGame.methodOperations.find((op) => op.methodId === methodId);
        if (existing) return existing;
      }
      // Senão, criar novo método sem resultados
      return { methodId };
    });

    const gameData = {
      date: formData.date,
      time: formData.time,
      league: formData.league,
      homeTeam: formData.homeTeam,
      awayTeam: formData.awayTeam,
      methodOperations,
      notes: formData.notes,
    };

    onSubmit(gameData);

    setFormData({
      date: new Date().toISOString().split("T")[0],
      time: "",
      league: "",
      homeTeam: "",
      awayTeam: "",
      selectedMethods: [],
      notes: "",
    });
  };

  const toggleMethod = (methodId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedMethods: prev.selectedMethods.includes(methodId)
        ? prev.selectedMethods.filter((id) => id !== methodId)
        : [...prev.selectedMethods, methodId],
    }));
  };

  return (
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
          {methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cadastre métodos na Gestão de Banca primeiro
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {methods.map((method) => (
                <div key={method.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={method.id}
                    checked={formData.selectedMethods.includes(method.id)}
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
            {editingGame ? "Salvar Alterações" : "Adicionar Jogo"}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </Card>
  );
}
