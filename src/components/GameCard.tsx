import { useState } from "react";
import { Game, MethodOperation } from "@/types";
import { Method } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GameCardProps {
  game: Game;
  methods: Method[];
  onUpdate: (gameId: string, updates: Partial<Game>) => void;
  onDelete: (gameId: string) => void;
  onEdit: (game: Game) => void;
  isFinalized?: boolean;
}

export function GameCard({ game, methods, onUpdate, onDelete, onEdit, isFinalized }: GameCardProps) {
  const [editingMethod, setEditingMethod] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [methodForm, setMethodForm] = useState({
    operationType: "" as "Back" | "Lay" | "",
    entryOdds: "",
    exitOdds: "",
  });

  const calculateResult = (
    operationType: "Back" | "Lay",
    entryOdds: number,
    exitOdds: number
  ): "Green" | "Red" => {
    if (operationType === "Back") {
      return exitOdds < entryOdds ? "Green" : "Red";
    } else {
      return exitOdds > entryOdds ? "Green" : "Red";
    }
  };

  const handleSaveMethod = (methodId: string) => {
    if (!methodForm.operationType || !methodForm.entryOdds || !methodForm.exitOdds) {
      toast.error("Preencha todos os campos");
      return;
    }

    const entry = parseFloat(methodForm.entryOdds);
    const exit = parseFloat(methodForm.exitOdds);

    if (isNaN(entry) || isNaN(exit)) {
      toast.error("Odds inválidas");
      return;
    }

    const result = calculateResult(methodForm.operationType, entry, exit);

    const updatedOperations = game.methodOperations.map((op) =>
      op.methodId === methodId
        ? {
            ...op,
            operationType: methodForm.operationType as "Back" | "Lay",
            entryOdds: entry,
            exitOdds: exit,
            result,
          }
        : op
    );

    onUpdate(game.id, { methodOperations: updatedOperations });
    setEditingMethod(null);
    setMethodForm({ operationType: "", entryOdds: "", exitOdds: "" });
    toast.success("Método atualizado!");
  };

  const startEditMethod = (operation: MethodOperation) => {
    setEditingMethod(operation.methodId);
    setMethodForm({
      operationType: operation.operationType || "",
      entryOdds: operation.entryOdds?.toString() || "",
      exitOdds: operation.exitOdds?.toString() || "",
    });
  };

  const getMethodName = (methodId: string) => {
    return methods.find((m) => m.id === methodId)?.name || "Método não encontrado";
  };

  const isLive = game.status === 'Live';

  return (
    <Card className={cn(
      "p-6 shadow-card transition-all",
      isLive && "border-2 border-red-500 bg-red-500/5"
    )}>
      <div className="space-y-4">
        {/* Cabeçalho do jogo */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-muted px-2 py-1 text-xs font-medium">
                {new Date(game.date + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
              <span className="rounded bg-muted px-2 py-1 text-xs font-medium">{game.time}</span>
              <span className="rounded bg-secondary/10 px-2 py-1 text-xs font-medium text-secondary">
                {game.league}
              </span>
              {isLive && (
                <Badge variant="destructive" className="animate-pulse">
                  🔴 AO VIVO
                </Badge>
              )}
            </div>
            <div className="text-base font-bold sm:text-lg">
              {game.homeTeam} <span className="text-muted-foreground">vs</span> {game.awayTeam}
            </div>
            {game.notes && <p className="text-sm text-muted-foreground">{game.notes}</p>}
          </div>
          <div className="flex gap-2 sm:flex-col">
            {!isFinalized && (
              <Button variant="outline" size="icon" onClick={() => onEdit(game)}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            <Button variant="destructive" size="icon" onClick={() => onDelete(game.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Lista de métodos */}
        <div className="space-y-3">
          {game.methodOperations.map((operation) => {
            const isEditing = editingMethod === operation.methodId;
            const methodName = getMethodName(operation.methodId);

            return (
              <div
                key={operation.methodId}
                className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        {methodName}
                      </span>
                      {operation.result && (
                        <span
                          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                            operation.result === "Green"
                              ? "bg-green-500/20 text-green-600"
                              : "bg-red-500/20 text-red-600"
                          }`}
                        >
                          {operation.result === "Green" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {operation.result}
                        </span>
                      )}
                    </div>
                    {!operation.result && !isFinalized && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditMethod(operation)}
                      >
                        Registrar Resultado
                      </Button>
                    )}
                  </div>

                  {operation.operationType && operation.entryOdds && operation.exitOdds && (
                    <div className="text-sm text-muted-foreground">
                      {operation.operationType}: {operation.entryOdds.toFixed(2)} →{" "}
                      {operation.exitOdds.toFixed(2)}
                    </div>
                  )}

                  {isEditing && (
                  <div className="space-y-3 border-t pt-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs sm:text-sm">Tipo de Operação</Label>
                          <Select
                            value={methodForm.operationType}
                            onValueChange={(value: "Back" | "Lay") =>
                              setMethodForm({ ...methodForm, operationType: value })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Back">Back</SelectItem>
                              <SelectItem value="Lay">Lay</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs sm:text-sm">Odd de Entrada</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={methodForm.entryOdds}
                            onChange={(e) =>
                              setMethodForm({ ...methodForm, entryOdds: e.target.value })
                            }
                            placeholder="Ex: 2.50"
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs sm:text-sm">Odd de Saída</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={methodForm.exitOdds}
                            onChange={(e) =>
                              setMethodForm({ ...methodForm, exitOdds: e.target.value })
                            }
                            placeholder="Ex: 2.30"
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button 
                          size="sm" 
                          onClick={() => handleSaveMethod(operation.methodId)}
                          className="w-full sm:w-auto"
                        >
                          Salvar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingMethod(null);
                            setMethodForm({ operationType: "", entryOdds: "", exitOdds: "" });
                          }}
                          className="w-full sm:w-auto"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
