import { useState } from "react";
import { Game, MethodOperation } from "@/types";
import { Method } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Edit, Check, X, ChevronDown, ChevronUp, Shield, Calculator } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTeamLogo } from "@/hooks/useTeamLogo";
import { FixtureLinker } from "@/components/LiveStats/FixtureLinker";
import { GameNotesEditor } from "@/components/GameNotesEditor";
import { calculateProfit, calculatePotentialProfit, formatCurrency } from "@/utils/profitCalculator";
import { DEFAULT_COMMISSION } from "@/hooks/useOperationalSettings";
import { useIsMobile } from "@/hooks/use-mobile";

interface GameCardProps {
  game: Game;
  methods: Method[];
  onUpdate: (gameId: string, updates: Partial<Game>) => void;
  onDelete: (gameId: string) => void;
  onEdit?: (game: Game) => void;
  onRefresh?: () => void;
  isFinalized?: boolean;
}

export function GameCard({ game, methods, onUpdate, onDelete, onEdit, onRefresh, isFinalized }: GameCardProps) {
  const isMobile = useIsMobile();
  const [editingMethod, setEditingMethod] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [methodForm, setMethodForm] = useState({
    operationType: "" as "Back" | "Lay" | "",
    entryOdds: "",
    exitOdds: "",
    stakeValue: "",
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
      toast.error("Preencha tipo, entrada e saída");
      return;
    }

    const entry = parseFloat(methodForm.entryOdds);
    const exit = parseFloat(methodForm.exitOdds);
    const stake = methodForm.stakeValue ? parseFloat(methodForm.stakeValue) : undefined;

    if (isNaN(entry) || isNaN(exit)) {
      toast.error("Odds inválidas");
      return;
    }

    const result = calculateResult(methodForm.operationType, entry, exit);

    // Calculate profit if stake is provided
    let profit: number | undefined = undefined;
    if (stake && stake > 0 && entry > 1) {
      profit = calculateProfit({
        stakeValue: stake,
        odd: entry,
        operationType: methodForm.operationType,
        result,
        commissionRate: DEFAULT_COMMISSION
      });
    }

    const updatedOperations = game.methodOperations.map((op) =>
      op.methodId === methodId
        ? {
          ...op,
          operationType: methodForm.operationType as "Back" | "Lay",
          entryOdds: entry,
          exitOdds: exit,
          result,
          stakeValue: stake,
          odd: entry,
          profit,
          commissionRate: DEFAULT_COMMISSION
        }
        : op
    );

    onUpdate(game.id, { methodOperations: updatedOperations });
    setEditingMethod(null);
    setMethodForm({ operationType: "", entryOdds: "", exitOdds: "", stakeValue: "" });
    toast.success("Método atualizado!");
  };

  const startEditMethod = (operation: MethodOperation) => {
    setEditingMethod(operation.methodId);
    setMethodForm({
      operationType: operation.operationType || "",
      entryOdds: operation.entryOdds?.toString() || "",
      exitOdds: operation.exitOdds?.toString() || "",
      stakeValue: operation.stakeValue?.toString() || "",
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
      <div className="px-3 py-2 border-b border-border/30 bg-gradient-neon-subtle">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wide truncate">{game.league}</p>
              {isLive && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-black px-2.5 py-1 rounded-md bg-gradient-neon shadow-glow">
                  <span className="inline-block h-2 w-2 rounded-full bg-black animate-pulse" />
                  AO VIVO
                </span>
              )}
              {!isFinalized && (
                <FixtureLinker
                  gameId={game.id}
                  gameDate={game.date}
                  homeTeam={game.homeTeam}
                  awayTeam={game.awayTeam}
                  currentFixtureId={game.api_fixture_id}
                  onLinked={() => onRefresh?.()}
                />
              )}
            </div>

            {/* Times com escudos acima dos nomes */}
            <div className="flex items-center justify-between gap-3">
              {/* Time da casa */}
              <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                {homeTeamLogo && (
                  <Avatar className={cn(
                    "ring-2 ring-background shadow-apple-sm",
                    isMobile ? "h-8 w-8" : "h-10 w-10"
                  )}>
                    <AvatarImage src={homeTeamLogo} alt={game.homeTeam} />
                    <AvatarFallback className="text-xs bg-muted">
                      <Shield className={cn(isMobile ? "h-3 w-3" : "h-5 w-5")} />
                    </AvatarFallback>
                  </Avatar>
                )}
                <p className={cn(
                  "font-semibold text-foreground text-center leading-tight truncate w-full",
                  isMobile ? "text-[10px]" : "text-[11px]"
                )}>
                  {game.homeTeam}
                </p>
              </div>

              {/* Horário no centro */}
              <div className="flex flex-col items-center gap-0.5 px-2">
                <p className="text-xs font-bold text-foreground whitespace-nowrap">
                  {game.time}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(game.date + "T00:00:00").toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
                </p>
              </div>

              {/* Time visitante */}
              <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                {awayTeamLogo && (
                  <Avatar className={cn(
                    "ring-2 ring-background shadow-apple-sm",
                    isMobile ? "h-8 w-8" : "h-10 w-10"
                  )}>
                    <AvatarImage src={awayTeamLogo} alt={game.awayTeam} />
                    <AvatarFallback className="text-xs bg-muted">
                      <Shield className={cn(isMobile ? "h-3 w-3" : "h-5 w-5")} />
                    </AvatarFallback>
                  </Avatar>
                )}
                <p className={cn(
                  "font-semibold text-foreground text-center leading-tight truncate w-full",
                  isMobile ? "text-[10px]" : "text-[11px]"
                )}>
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
            {!isFinalized && onEdit && (
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
      <div className="px-3 py-2">
        <div className="mb-3 pb-3 border-b border-border/30">
          <GameNotesEditor
            notes={game.notes}
            onSave={(notes) => onUpdate(game.id, { notes })}
          />
        </div>

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
                          <div className={cn(
                            "grid gap-3",
                            isMobile ? "grid-cols-1" : "grid-cols-2 md:grid-cols-4"
                          )}>
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
                              <Label className="text-xs font-medium mb-1">Alocação (R$)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={methodForm.stakeValue}
                                onChange={(e) =>
                                  setMethodForm({ ...methodForm, stakeValue: e.target.value })
                                }
                                placeholder="100.00"
                                className="h-9 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium mb-1">Ratio Entrada</Label>
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
                              <Label className="text-xs font-medium mb-1">Ratio Saída</Label>
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

                          {/* Profit preview */}
                          {methodForm.operationType && methodForm.stakeValue && methodForm.entryOdds && (
                            <div className="flex items-center gap-2 text-xs p-2 bg-background/50 rounded-lg">
                              <Calculator className="h-4 w-4 text-muted-foreground" />
                              {(() => {
                                const stake = parseFloat(methodForm.stakeValue);
                                const odd = parseFloat(methodForm.entryOdds);
                                if (stake > 0 && odd > 1) {
                                  const potential = calculatePotentialProfit(stake, odd, methodForm.operationType as 'Back' | 'Lay', DEFAULT_COMMISSION);
                                  return (
                                    <span>
                                      Se <span className="text-emerald-500 font-medium">Green: {formatCurrency(potential.green)}</span>
                                      {" | "}
                                      Se <span className="text-red-500 font-medium">Red: {formatCurrency(potential.red)}</span>
                                    </span>
                                  );
                                }
                                return <span className="text-muted-foreground">Preencha alocação e ratio para ver previsão</span>;
                              })()}
                            </div>
                          )}
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
                                setMethodForm({ operationType: "", entryOdds: "", exitOdds: "", stakeValue: "" });
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
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
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
                        <Label className="text-xs font-medium mb-1">Alocação (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={methodForm.stakeValue}
                          onChange={(e) =>
                            setMethodForm({ ...methodForm, stakeValue: e.target.value })
                          }
                          placeholder="100.00"
                          className="h-9 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium mb-1">Ratio Entrada</Label>
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
                        <Label className="text-xs font-medium mb-1">Ratio Saída</Label>
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

                    {/* Profit preview */}
                    {methodForm.operationType && methodForm.stakeValue && methodForm.entryOdds && (
                      <div className="flex items-center gap-2 text-xs p-2 bg-background/50 rounded-lg">
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                        {(() => {
                          const stake = parseFloat(methodForm.stakeValue);
                          const odd = parseFloat(methodForm.entryOdds);
                          if (stake > 0 && odd > 1) {
                            const potential = calculatePotentialProfit(stake, odd, methodForm.operationType as 'Back' | 'Lay', DEFAULT_COMMISSION);
                            return (
                              <span>
                                Se <span className="text-emerald-500 font-medium">Green: {formatCurrency(potential.green)}</span>
                                {" | "}
                                Se <span className="text-red-500 font-medium">Red: {formatCurrency(potential.red)}</span>
                              </span>
                            );
                          }
                          return <span className="text-muted-foreground">Preencha alocação e ratio para ver previsão</span>;
                        })()}
                      </div>
                    )}
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
                          setMethodForm({ operationType: "", entryOdds: "", exitOdds: "", stakeValue: "" });
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