import { useState, useEffect } from "react";
import { Game, Method } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTeamLogo } from "@/hooks/useTeamLogo";

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
    homeTeamLogo: "",
    awayTeamLogo: "",
    selectedMethods: [] as string[],
    notes: "",
  });

  const { logoUrl: homeLogoUrl, loading: homeLoading } = useTeamLogo(formData.homeTeam);
  const { logoUrl: awayLogoUrl, loading: awayLoading } = useTeamLogo(formData.awayTeam);

  useEffect(() => {
    if (editingGame) {
      setFormData({
        date: editingGame.date,
        time: editingGame.time,
        league: editingGame.league,
        homeTeam: editingGame.homeTeam,
        awayTeam: editingGame.awayTeam,
        homeTeamLogo: editingGame.homeTeamLogo || "",
        awayTeamLogo: editingGame.awayTeamLogo || "",
        selectedMethods: editingGame.methodOperations.map((op) => op.methodId),
        notes: editingGame.notes || "",
      });
    }
  }, [editingGame]);

  useEffect(() => {
    if (homeLogoUrl) {
      setFormData(prev => ({ ...prev, homeTeamLogo: homeLogoUrl }));
    }
  }, [homeLogoUrl]);

  useEffect(() => {
    if (awayLogoUrl) {
      setFormData(prev => ({ ...prev, awayTeamLogo: awayLogoUrl }));
    }
  }, [awayLogoUrl]);

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
      homeTeamLogo: formData.homeTeamLogo,
      awayTeamLogo: formData.awayTeamLogo,
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
      homeTeamLogo: "",
      awayTeamLogo: "",
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
            <div className="flex gap-2 items-center">
              <Input
                id="home"
                value={formData.homeTeam}
                onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })}
                placeholder="Time mandante"
                className="flex-1"
              />
              {homeLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : formData.homeTeamLogo ? (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={formData.homeTeamLogo} alt={formData.homeTeam} />
                  <AvatarFallback>
                    <Shield className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              ) : null}
            </div>
          </div>
          <div>
            <Label htmlFor="away">Time Visitante</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="away"
                value={formData.awayTeam}
                onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })}
                placeholder="Time visitante"
                className="flex-1"
              />
              {awayLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : formData.awayTeamLogo ? (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={formData.awayTeamLogo} alt={formData.awayTeam} />
                  <AvatarFallback>
                    <Shield className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              ) : null}
            </div>
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
