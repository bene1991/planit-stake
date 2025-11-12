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
      "overflow-hidden transition-all duration-300 animate-slide-up hover:shadow-neon",
      isLive ? "border-primary/50 shadow-glow bg-gradient-to-br from-card to-primary/5" : "border-border/40 hover:border-primary/30 bg-card"
    )}>
      {/* Header super compacto */}
      <div className="px-4 py-3 border-b border-border/30 bg-gradient-neon-subtle">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs uppercase text-muted-foreground font-bold tracking-wide truncate">{game.league}</p>
              {isLive && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-black px-2.5 py-1 rounded-md bg-gradient-neon shadow-glow">
                  <span className="inline-block h-2 w-2 rounded-full bg-black animate-pulse" />
                  AO VIVO
                </span>
              )}
            </div>
            
            {/* Times com escudos acima dos nomes */}
            <div className="flex items-center justify-between gap-4">
              {/* Time da casa */}
              <div className="flex-1 flex flex-col items-center gap-2">
                {homeTeamLogo && (
                  <Avatar className="h-12 w-12 ring-2 ring-background shadow-apple-sm">
                    <AvatarImage src={homeTeamLogo} alt={game.homeTeam} />
                    <AvatarFallback className="text-xs bg-muted">
                      <Shield className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <p className="text-xs font-semibold text-foreground text-center leading-tight">
                  {game.homeTeam}
                </p>
              </div>

              {/* Horário no centro */}
              <div className="flex flex-col items-center gap-1 px-3">
                <p className="text-sm font-bold text-foreground whitespace-nowrap">
                  {game.time}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(game.date + "T00:00:00").toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
                </p>
              </div>

              {/* Time visitante */}
              <div className="flex-1 flex flex-col items-center gap-2">
                {awayTeamLogo && (
                  <Avatar className="h-12 w-12 ring-2 ring-background shadow-apple-sm">
                    <AvatarImage src={awayTeamLogo} alt={game.awayTeam} />
                    <AvatarFallback className="text-xs bg-muted">
                      <Shield className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <p className="text-xs font-semibold text-foreground text-center leading-tight">
                  {game.awayTeam}
                </p>
              </div>
            </div>
            {hasMultipleMethods && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium mt-2">
                <span className="font-medium">{game.methodOperations.length} métodos</span>
              </div>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {!isFinalized && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(game)} className="h-8 w-8 p-0 rounded-full hover:bg-primary/10">
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onDelete(game.id)} className="h-8 w-8 p-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Corpo com collapsible para múltiplos métodos */}
      <div className="px-4 py-3">
        {game.notes && (
          <p className="text-xs text-muted-foreground mb-3 pb-3 border-b line-clamp-2 italic">{game.notes}</p>
        )}

        {hasMultipleMethods ? (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            {/* Resumo compacto quando fechado */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  {greenCount > 0 && (
                    <span className="font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/20 text-primary border-2 border-primary/30">
                      <Check className="h-4 w-4" />
                      {greenCount}
                    </span>
                  )}
                  {redCount > 0 && (
                    <span className="font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/20 text-destructive border-2 border-destructive/30">
                      <X className="h-4 w-4" />
                      {redCount}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="font-bold px-3 py-1.5 rounded-lg bg-secondary/80 text-muted-foreground border-2 border-border/50">
                      {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-3 text-xs rounded-lg">
                    {isOpen ? (
                      <>
                        Ocultar <ChevronUp className="ml-1 h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        Ver detalhes <ChevronDown className="ml-1 h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>

              {/* Lista expandida */}
              <CollapsibleContent className="space-y-2 pt-2">
                {game.methodOperations.map((operation) => {
                  const isEditing = editingMethod === operation.methodId;
                  const methodName = getMethodName(operation.methodId);

                  return (
                    <div key={operation.methodId} className="space-y-2 p-3 rounded-xl bg-secondary/50 border-2 border-border/60">
                      <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs truncate">{methodName}</p>
                          {operation.operationType && operation.entryOdds && operation.exitOdds && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {operation.operationType}: {operation.entryOdds.toFixed(2)} → {operation.exitOdds.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {operation.result === "Green" && (
                            <span className="text-xs font-bold text-primary flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/20 border-2 border-primary/30">
                              <Check className="h-4 w-4" />
                              GREEN
                            </span>
                          )}
                          {operation.result === "Red" && (
                            <span className="text-xs font-bold text-destructive flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/20 border-2 border-destructive/30">
                              <X className="h-4 w-4" />
                              RED
                            </span>
                          )}
                          {!operation.result && !isFinalized && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditMethod(operation)}
                              className="h-7 text-xs px-3 rounded-lg"
                            >
                              Registrar
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Form inline */}
                      {isEditing && (
                        <div className="p-3 bg-secondary/80 rounded-xl border-2 border-border/60 space-y-3">
                          <div className="grid gap-3 grid-cols-3">
                            <div>
                              <Label className="text-xs font-medium mb-1">Tipo</Label>
                              <Select
                                value={methodForm.operationType}
                                onValueChange={(value: "Back" | "Lay") =>
                                  setMethodForm({ ...methodForm, operationType: value })
                                }
                              >
                                <SelectTrigger className="h-9 text-xs rounded-lg">
                                  <SelectValue placeholder="Tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Back">Back</SelectItem>
                                  <SelectItem value="Lay">Lay</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs font-medium mb-1">Entrada</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={methodForm.entryOdds}
                                onChange={(e) =>
                                  setMethodForm({ ...methodForm, entryOdds: e.target.value })
                                }
                                placeholder="2.50"
                                className="h-9 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium mb-1">Saída</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={methodForm.exitOdds}
                                onChange={(e) =>
                                  setMethodForm({ ...methodForm, exitOdds: e.target.value })
                                }
                                placeholder="2.30"
                                className="h-9 text-xs"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleSaveMethod(operation.methodId)}
                              className="h-8 text-xs px-4 rounded-lg"
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
                              className="h-8 text-xs px-4 rounded-lg"
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
              <div key={operation.methodId} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-1 tracking-tight">{methodName}</p>
                    {operation.operationType && operation.entryOdds && operation.exitOdds && (
                      <p className="text-xs text-muted-foreground font-medium">
                        {operation.operationType}: {operation.entryOdds.toFixed(2)} → {operation.exitOdds.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {operation.result === "Green" && (
                      <span className="text-xs font-bold text-primary flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/20 border-2 border-primary/30">
                        <Check className="h-4 w-4" />
                        GREEN
                      </span>
                    )}
                    {operation.result === "Red" && (
                      <span className="text-xs font-bold text-destructive flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/20 border-2 border-destructive/30">
                        <X className="h-4 w-4" />
                        RED
                      </span>
                    )}
                    {!operation.result && (
                      <>
                        <span className="text-xs font-bold text-muted-foreground px-3 py-1.5 rounded-lg bg-secondary/80 border-2 border-border/50">PENDENTE</span>
                        {!isFinalized && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditMethod(operation)}
                            className="h-7 text-xs px-3 rounded-lg"
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
                  <div className="p-3 bg-secondary/80 rounded-xl border-2 border-border/60 space-y-3">
                    <div className="grid gap-3 grid-cols-3">
                      <div>
                        <Label className="text-xs font-medium mb-1">Tipo</Label>
                        <Select
                          value={methodForm.operationType}
                          onValueChange={(value: "Back" | "Lay") =>
                            setMethodForm({ ...methodForm, operationType: value })
                          }
                        >
                          <SelectTrigger className="h-9 text-xs rounded-lg">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Back">Back</SelectItem>
                            <SelectItem value="Lay">Lay</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-medium mb-1">Entrada</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={methodForm.entryOdds}
                          onChange={(e) =>
                            setMethodForm({ ...methodForm, entryOdds: e.target.value })
                          }
                          placeholder="2.50"
                          className="h-9 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium mb-1">Saída</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={methodForm.exitOdds}
                          onChange={(e) =>
                            setMethodForm({ ...methodForm, exitOdds: e.target.value })
                          }
                          placeholder="2.30"
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleSaveMethod(operation.methodId)}
                        className="h-8 text-xs px-4 rounded-lg"
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
                        className="h-8 text-xs px-4 rounded-lg"
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