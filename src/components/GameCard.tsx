import { useState } from "react";
import { Game, MethodOperation } from "@/types";
import { Method } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Edit, Check, X, ChevronDown, ChevronUp, Shield } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTeamLogo } from "@/hooks/useTeamLogo";

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
  const [isOpen, setIsOpen] = useState(false);
  const [methodForm, setMethodForm] = useState({
    operationType: "" as "Back" | "Lay" | "",
    entryOdds: "",
    exitOdds: "",
  });

  // Busca dinâmica de logos quando não existem no banco
  const { logoUrl: homeLogo } = useTeamLogo(game.homeTeam);
  const { logoUrl: awayLogo } = useTeamLogo(game.awayTeam);
  
  // Usa logo do banco ou logo buscado dinamicamente
  const homeTeamLogo = game.homeTeamLogo || homeLogo;
  const awayTeamLogo = game.awayTeamLogo || awayLogo;

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
  const hasMultipleMethods = game.methodOperations.length > 1;

  // Resumo rápido dos métodos
  const greenCount = game.methodOperations.filter(op => op.result === 'Green').length;
  const redCount = game.methodOperations.filter(op => op.result === 'Red').length;
  const pendingCount = game.methodOperations.filter(op => !op.result).length;

  return (
    <Card className={cn(
      "overflow-hidden shadow-sm border transition-all hover:shadow-md",
      isLive && "border-l-4 border-l-red-600"
    )}>
      {/* Header super compacto */}
      <div className="px-3 py-2 border-b bg-muted/10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-xs uppercase text-muted-foreground font-medium truncate">{game.league}</p>
              {isLive && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mb-0.5">
              {homeTeamLogo && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={homeTeamLogo} alt={game.homeTeam} />
                  <AvatarFallback className="text-xs">
                    <Shield className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <h3 className="text-sm font-semibold text-foreground leading-tight">
                {game.homeTeam} vs {game.awayTeam}
              </h3>
              {awayTeamLogo && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={awayTeamLogo} alt={game.awayTeam} />
                  <AvatarFallback className="text-xs">
                    <Shield className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{new Date(game.date + "T00:00:00").toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}</span>
              <span>•</span>
              <span>{game.time}</span>
              {hasMultipleMethods && (
                <>
                  <span>•</span>
                  <span className="font-medium">{game.methodOperations.length} métodos</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-0.5 flex-shrink-0">
            {!isFinalized && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(game)} className="h-6 w-6 p-0">
                <Edit className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onDelete(game.id)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Corpo com collapsible para múltiplos métodos */}
      <div className="px-3 py-2">
        {game.notes && (
          <p className="text-xs text-muted-foreground mb-2 pb-2 border-b line-clamp-2">{game.notes}</p>
        )}

        {hasMultipleMethods ? (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            {/* Resumo compacto quando fechado */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {greenCount > 0 && (
                    <span className="text-green-600 font-medium flex items-center gap-0.5">
                      <Check className="h-3 w-3" />
                      {greenCount}
                    </span>
                  )}
                  {redCount > 0 && (
                    <span className="text-red-600 font-medium flex items-center gap-0.5">
                      <X className="h-3 w-3" />
                      {redCount}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="text-muted-foreground font-medium">
                      {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px]">
                    {isOpen ? (
                      <>
                        Ocultar <ChevronUp className="ml-1 h-3 w-3" />
                      </>
                    ) : (
                      <>
                        Ver detalhes <ChevronDown className="ml-1 h-3 w-3" />
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>

              {/* Lista expandida */}
              <CollapsibleContent className="space-y-1.5 pt-1">
                {game.methodOperations.map((operation) => {
                  const isEditing = editingMethod === operation.methodId;
                  const methodName = getMethodName(operation.methodId);

                  return (
                    <div key={operation.methodId} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 py-1 border-b border-dashed">
                      <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs truncate">{methodName}</p>
                          {operation.operationType && operation.entryOdds && operation.exitOdds && (
                            <p className="text-xs text-muted-foreground">
                              {operation.operationType}: {operation.entryOdds.toFixed(2)} → {operation.exitOdds.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {operation.result === "Green" && (
                            <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
                              <Check className="h-3.5 w-3.5" />
                              GREEN
                            </span>
                          )}
                          {operation.result === "Red" && (
                            <span className="text-xs font-semibold text-red-600 flex items-center gap-0.5">
                              <X className="h-3.5 w-3.5" />
                              RED
                            </span>
                          )}
                          {!operation.result && !isFinalized && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditMethod(operation)}
                              className="h-5 text-[10px] px-2"
                            >
                              Registrar
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Form inline */}
                      {isEditing && (
                        <div className="p-2 bg-muted/30 rounded border space-y-2">
                          <div className="grid gap-2 grid-cols-3">
                            <div>
                              <Label className="text-[10px]">Tipo</Label>
                              <Select
                                value={methodForm.operationType}
                                onValueChange={(value: "Back" | "Lay") =>
                                  setMethodForm({ ...methodForm, operationType: value })
                                }
                              >
                                <SelectTrigger className="h-7 text-[11px]">
                                  <SelectValue placeholder="Tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Back">Back</SelectItem>
                                  <SelectItem value="Lay">Lay</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px]">Entrada</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={methodForm.entryOdds}
                                onChange={(e) =>
                                  setMethodForm({ ...methodForm, entryOdds: e.target.value })
                                }
                                placeholder="2.50"
                                className="h-7 text-[11px]"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">Saída</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={methodForm.exitOdds}
                                onChange={(e) =>
                                  setMethodForm({ ...methodForm, exitOdds: e.target.value })
                                }
                                placeholder="2.30"
                                className="h-7 text-[11px]"
                              />
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <Button 
                              size="sm" 
                              onClick={() => handleSaveMethod(operation.methodId)}
                              className="h-6 text-[10px] px-2"
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
                              className="h-6 text-[10px] px-2"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CollapsibleContent>
            </div>
          </Collapsible>
        ) : (
          // Método único - layout normal
          game.methodOperations.map((operation) => {
            const isEditing = editingMethod === operation.methodId;
            const methodName = getMethodName(operation.methodId);

            return (
              <div key={operation.methodId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-0.5">{methodName}</p>
                    {operation.operationType && operation.entryOdds && operation.exitOdds && (
                      <p className="text-xs text-muted-foreground">
                        {operation.operationType}: {operation.entryOdds.toFixed(2)} → {operation.exitOdds.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {operation.result === "Green" && (
                      <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
                        <Check className="h-3.5 w-3.5" />
                        GREEN
                      </span>
                    )}
                    {operation.result === "Red" && (
                      <span className="text-xs font-semibold text-red-600 flex items-center gap-0.5">
                        <X className="h-3.5 w-3.5" />
                        RED
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
                            className="h-6 text-[10px] px-2"
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
                  <div className="p-2 bg-muted/30 rounded border space-y-2">
                    <div className="grid gap-2 grid-cols-3">
                      <div>
                        <Label className="text-[10px]">Tipo</Label>
                        <Select
                          value={methodForm.operationType}
                          onValueChange={(value: "Back" | "Lay") =>
                            setMethodForm({ ...methodForm, operationType: value })
                          }
                        >
                          <SelectTrigger className="h-7 text-[11px]">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Back">Back</SelectItem>
                            <SelectItem value="Lay">Lay</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">Entrada</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={methodForm.entryOdds}
                          onChange={(e) =>
                            setMethodForm({ ...methodForm, entryOdds: e.target.value })
                          }
                          placeholder="2.50"
                          className="h-7 text-[11px]"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Saída</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={methodForm.exitOdds}
                          onChange={(e) =>
                            setMethodForm({ ...methodForm, exitOdds: e.target.value })
                          }
                          placeholder="2.30"
                          className="h-7 text-[11px]"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button 
                        size="sm" 
                        onClick={() => handleSaveMethod(operation.methodId)}
                        className="h-6 text-[10px] px-2"
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
                        className="h-6 text-[10px] px-2"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}