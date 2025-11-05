import { useState } from "react";
import { Game, MethodOperation } from "@/types";
import { Method } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit, CheckCircle2, XCircle, Clock } from "lucide-react";
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
      "overflow-hidden shadow-card transition-all hover:shadow-hover animate-fade-in",
      "bg-gradient-to-br from-card to-card/50",
      isLive && "border-2 border-red-500 shadow-red-500/20"
    )}>
      {/* Header do Card */}
      <div className="relative bg-gradient-to-r from-muted/30 to-muted/10 px-6 py-4 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-foreground">{game.league}</h3>
              {isLive && (
                <Badge variant="destructive" className="animate-pulse">
                  🔴 AO VIVO
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {game.homeTeam} ⚽ {game.awayTeam} • {game.time} • {new Date(game.date + "T00:00:00").toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="flex gap-1.5">
            {!isFinalized && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(game)} className="h-8 w-8 p-0">
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onDelete(game.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Corpo do Card */}
      <div className="p-6">
        {game.notes && (
          <p className="text-sm text-muted-foreground mb-4 pb-4 border-b">{game.notes}</p>
        )}

        {/* Lista de métodos - Design simples e limpo */}
        <div className="space-y-2">
          {game.methodOperations.map((operation) => {
            const isEditing = editingMethod === operation.methodId;
            const methodName = getMethodName(operation.methodId);

            return (
              <div
                key={operation.methodId}
                className="group relative"
              >
                {/* Linha do método - layout horizontal limpo */}
                <div className={cn(
                  "flex items-center gap-3 py-3 px-4 rounded-lg transition-all",
                  "border-l-4",
                  operation.result === "Green" && "border-l-green-500 bg-green-500/5",
                  operation.result === "Red" && "border-l-red-500 bg-red-500/5",
                  !operation.result && "border-l-muted bg-muted/20"
                )}>
                  {/* Ícone de resultado */}
                  <div className="flex-shrink-0">
                    {operation.result === "Green" && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                    {operation.result === "Red" && (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    {!operation.result && (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Nome do método */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{methodName}</span>
                      {operation.operationType && operation.entryOdds && operation.exitOdds && (
                        <span className="text-xs text-muted-foreground">
                          {operation.operationType}: {operation.entryOdds.toFixed(2)} → {operation.exitOdds.toFixed(2)}
                        </span>
                      )}
                      {operation.result && (
                        <Badge 
                          variant={operation.result === "Green" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {operation.result}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Botão registrar resultado */}
                  {!operation.result && !isFinalized && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditMethod(operation)}
                      className="ml-auto"
                    >
                      Registrar
                    </Button>
                  )}
                </div>

                {/* Formulário de edição inline */}
                {isEditing && (
                  <div className="mt-3 p-4 bg-muted/30 rounded-lg border space-y-3">
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
