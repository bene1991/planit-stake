import { useState } from "react";
import { Game, MethodOperation } from "@/types";
import { Method } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit, Check, X } from "lucide-react";
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
      "overflow-hidden shadow-sm border border-border transition-shadow hover:shadow-md",
      isLive && "border-l-4 border-l-red-600"
    )}>
      {/* Header compacto */}
      <div className="px-6 py-4 border-b bg-muted/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs uppercase text-muted-foreground font-medium">{game.league}</p>
              {isLive && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {game.homeTeam} vs {game.awayTeam}
            </h3>
            <p className="text-sm text-muted-foreground">
              {new Date(game.date + "T00:00:00").toLocaleDateString("pt-BR")} • {game.time}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {!isFinalized && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(game)} className="h-8 w-8 p-0">
                <Edit className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onDelete(game.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Corpo */}
      <div className="p-6">
        {game.notes && (
          <p className="text-sm text-muted-foreground mb-4 pb-4 border-b">{game.notes}</p>
        )}

        {/* Métodos em layout tabular */}
        <div className="space-y-3">
          {game.methodOperations.map((operation) => {
            const isEditing = editingMethod === operation.methodId;
            const methodName = getMethodName(operation.methodId);

            return (
              <div key={operation.methodId} className="space-y-3">
                {/* Linha do método */}
                <div className="flex items-center justify-between gap-4 py-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-0.5">{methodName}</p>
                    {operation.operationType && operation.entryOdds && operation.exitOdds && (
                      <p className="text-xs text-muted-foreground">
                        {operation.operationType}: {operation.entryOdds.toFixed(2)} → {operation.exitOdds.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {operation.result === "Green" && (
                      <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                        <Check className="h-4 w-4" />
                        GANHOU
                      </span>
                    )}
                    {operation.result === "Red" && (
                      <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                        <X className="h-4 w-4" />
                        PERDEU
                      </span>
                    )}
                    {!operation.result && (
                      <>
                        <span className="text-xs font-medium text-muted-foreground">PENDENTE</span>
                        {!isFinalized && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditMethod(operation)}
                          >
                            Registrar
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Form inline */}
                {isEditing && (
                  <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs">Tipo de Operação</Label>
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
                        <Label className="text-xs">Odd de Entrada</Label>
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
                        <Label className="text-xs">Odd de Saída</Label>
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
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleSaveMethod(operation.methodId)}
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
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
