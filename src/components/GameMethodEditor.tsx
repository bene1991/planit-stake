import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useEffect } from 'react';
import { Game, Method, MethodOperation } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Check, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GameMethodEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game | null;
  methods: Method[];
  onConfirm: (gameId: string, methodOperations: MethodOperation[]) => void;
  loading?: boolean;
}

// Tipo para armazenar dados temporários dos métodos
interface MethodFormData {
  operationType?: 'Back' | 'Lay';
  entryOdds?: string;
  exitOdds?: string;
}

export const GameMethodEditor = ({ 
  open, 
  onOpenChange, 
  game, 
  methods,
  onConfirm, 
  loading
}: GameMethodEditorProps) => {
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [methodsData, setMethodsData] = useState<Record<string, MethodFormData>>({});
  const [methodToRemove, setMethodToRemove] = useState<string | null>(null);

  useEffect(() => {
    if (game) {
      // Pre-select methods that are already in the game
      setSelectedMethods(game.methodOperations.map(op => op.methodId));
      
      // Pre-fill existing data
      const initialData: Record<string, MethodFormData> = {};
      game.methodOperations.forEach(op => {
        initialData[op.methodId] = {
          operationType: op.operationType,
          entryOdds: op.entryOdds?.toString() || '',
          exitOdds: op.exitOdds?.toString() || '',
        };
      });
      setMethodsData(initialData);
    }
  }, [game]);

  // Validação de odds
  const validateOdds = (value: string): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 1.01 && num <= 100.00;
  };

  // Calcular resultado preview
  const calculatePreviewResult = (methodId: string): 'Green' | 'Red' | null => {
    const data = methodsData[methodId];
    if (!data?.operationType || !data?.entryOdds || !data?.exitOdds) return null;
    
    const entry = parseFloat(data.entryOdds);
    const exit = parseFloat(data.exitOdds);
    
    if (isNaN(entry) || isNaN(exit)) return null;
    
    if (data.operationType === 'Back') {
      return exit < entry ? 'Green' : 'Red';
    } else {
      return exit > entry ? 'Green' : 'Red';
    }
  };

  // Verificar se método está completo
  const isMethodComplete = (methodId: string): boolean => {
    const data = methodsData[methodId];
    return !!(data?.operationType && data?.entryOdds && data?.exitOdds);
  };

  const handleConfirm = () => {
    if (!game) return;
    
    if (selectedMethods.length === 0) {
      toast.error('Selecione pelo menos um método');
      return;
    }

    // Validar odds de todos os métodos configurados
    const invalidMethods: string[] = [];
    selectedMethods.forEach(methodId => {
      const data = methodsData[methodId];
      if (data?.entryOdds && !validateOdds(data.entryOdds)) {
        invalidMethods.push(methodId);
      }
      if (data?.exitOdds && !validateOdds(data.exitOdds)) {
        invalidMethods.push(methodId);
      }
    });

    if (invalidMethods.length > 0) {
      toast.error('Odds devem estar entre 1.01 e 100.00');
      return;
    }

    // Create method operations array with updated data
    const methodOperations: MethodOperation[] = selectedMethods.map(methodId => {
      const data = methodsData[methodId];
      const existingOp = game.methodOperations.find(op => op.methodId === methodId);
      
      if (data?.operationType && data?.entryOdds && data?.exitOdds) {
        // Método configurado - calcular resultado
        const entry = parseFloat(data.entryOdds);
        const exit = parseFloat(data.exitOdds);
        const result = data.operationType === 'Back' 
          ? (exit < entry ? 'Green' : 'Red')
          : (exit > entry ? 'Green' : 'Red');
        
        return {
          methodId,
          operationType: data.operationType,
          entryOdds: entry,
          exitOdds: exit,
          result: existingOp?.result || result, // Manter resultado existente se já finalizado
        };
      } else if (existingOp) {
        // Manter dados existentes se não foram editados
        return existingOp;
      } else {
        // Novo método sem dados
        return {
          methodId,
          operationType: undefined,
          entryOdds: undefined,
          exitOdds: undefined,
          result: undefined,
        };
      }
    });

    onConfirm(game.id, methodOperations);
    onOpenChange(false);
    toast.success('Métodos atualizados com sucesso!');
  };

  const toggleMethod = (methodId: string) => {
    if (selectedMethods.includes(methodId)) {
      // Verificar se método tem dados antes de remover
      const existingOp = game?.methodOperations.find(op => op.methodId === methodId);
      const hasData = existingOp && (existingOp.operationType || existingOp.entryOdds || existingOp.exitOdds);
      
      if (hasData) {
        setMethodToRemove(methodId);
        return;
      }
      
      // Remover método sem dados
      setSelectedMethods(prev => prev.filter(id => id !== methodId));
      const newData = { ...methodsData };
      delete newData[methodId];
      setMethodsData(newData);
    } else {
      // Adicionar método
      setSelectedMethods(prev => [...prev, methodId]);
    }
  };

  const confirmRemoveMethod = () => {
    if (methodToRemove) {
      setSelectedMethods(prev => prev.filter(id => id !== methodToRemove));
      const newData = { ...methodsData };
      delete newData[methodToRemove];
      setMethodsData(newData);
      setMethodToRemove(null);
      toast.success('Método removido');
    }
  };

  const updateMethodData = (methodId: string, field: keyof MethodFormData, value: string) => {
    setMethodsData(prev => ({
      ...prev,
      [methodId]: {
        ...prev[methodId],
        [field]: value,
      }
    }));
  };

  if (!game) return null;

  if (!game) return null;

  const completedCount = selectedMethods.filter(id => isMethodComplete(id)).length;
  const pendingCount = selectedMethods.length - completedCount;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar Métodos do Jogo</DialogTitle>
            <DialogDescription>
              {game.homeTeam} vs {game.awayTeam}
            </DialogDescription>
          </DialogHeader>

          {/* Resumo de status */}
          {selectedMethods.length > 0 && (
            <Alert className="bg-muted/50 border-border/50">
              <AlertDescription className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span className="font-medium">
                    {selectedMethods.length} método{selectedMethods.length > 1 ? 's' : ''} selecionado{selectedMethods.length > 1 ? 's' : ''}
                  </span>
                  {completedCount > 0 && (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />
                      {completedCount} completo{completedCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Selecione e configure os métodos
              </Label>
              <div className="space-y-3">
                {methods.map((method) => {
                  const isSelected = selectedMethods.includes(method.id);
                  const isComplete = isMethodComplete(method.id);
                  const previewResult = calculatePreviewResult(method.id);
                  const data = methodsData[method.id] || {};
                  
                  return (
                    <div 
                      key={method.id}
                      className={cn(
                        "rounded-xl border-2 transition-all",
                        isSelected 
                          ? 'bg-primary/5 border-primary/30' 
                          : 'bg-secondary/30 border-border/30 hover:border-border/50'
                      )}
                    >
                      {/* Header do método */}
                      <div className="flex items-start gap-3 p-3">
                        <Checkbox
                          id={method.id}
                          checked={isSelected}
                          onCheckedChange={() => toggleMethod(method.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <Label 
                              htmlFor={method.id}
                              className="text-sm font-semibold cursor-pointer"
                            >
                              {method.name}
                            </Label>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {method.percentage}% da banca
                              </Badge>
                              {isSelected && (
                                <Badge 
                                  variant={isComplete ? "default" : "secondary"}
                                  className="text-xs gap-1"
                                >
                                  {isComplete ? (
                                    <>
                                      <Check className="h-3 w-3" />
                                      Completo
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="h-3 w-3" />
                                      Pendente
                                    </>
                                  )}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Campos de edição inline quando selecionado */}
                          {isSelected && (
                            <div className="mt-3 p-3 bg-background/50 rounded-lg border border-border/40 space-y-3">
                              <div className="grid grid-cols-3 gap-3">
                                {/* Tipo de operação */}
                                <div>
                                  <Label className="text-xs font-medium mb-1.5 block">
                                    Tipo de Operação
                                  </Label>
                                  <Select
                                    value={data.operationType || ''}
                                    onValueChange={(value: 'Back' | 'Lay') => 
                                      updateMethodData(method.id, 'operationType', value)
                                    }
                                  >
                                    <SelectTrigger className="h-9 text-xs">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Back">
                                        <div className="flex items-center gap-2">
                                          <TrendingUp className="h-3 w-3" />
                                          Back
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="Lay">
                                        <div className="flex items-center gap-2">
                                          <TrendingDown className="h-3 w-3" />
                                          Lay
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Odds de entrada */}
                                <div>
                                  <Label className="text-xs font-medium mb-1.5 block">
                                    Odds de Entrada
                                  </Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="1.01"
                                    max="100"
                                    value={data.entryOdds || ''}
                                    onChange={(e) => 
                                      updateMethodData(method.id, 'entryOdds', e.target.value)
                                    }
                                    placeholder="Ex: 2.50"
                                    className={cn(
                                      "h-9 text-xs",
                                      data.entryOdds && !validateOdds(data.entryOdds) && "border-destructive"
                                    )}
                                  />
                                </div>

                                {/* Odds de saída */}
                                <div>
                                  <Label className="text-xs font-medium mb-1.5 block">
                                    Odds de Saída
                                  </Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="1.01"
                                    max="100"
                                    value={data.exitOdds || ''}
                                    onChange={(e) => 
                                      updateMethodData(method.id, 'exitOdds', e.target.value)
                                    }
                                    placeholder="Ex: 2.30"
                                    className={cn(
                                      "h-9 text-xs",
                                      data.exitOdds && !validateOdds(data.exitOdds) && "border-destructive"
                                    )}
                                  />
                                </div>
                              </div>

                              {/* Preview do resultado */}
                              {previewResult && (
                                <Alert className={cn(
                                  "py-2",
                                  previewResult === 'Green' 
                                    ? "bg-primary/10 border-primary/30" 
                                    : "bg-destructive/10 border-destructive/30"
                                )}>
                                  <AlertDescription className="flex items-center gap-2 text-xs font-medium">
                                    {previewResult === 'Green' ? (
                                      <>
                                        <Check className="h-4 w-4 text-primary" />
                                        <span className="text-primary">
                                          Preview: GREEN - Operação lucrativa
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <X className="h-4 w-4 text-destructive" />
                                        <span className="text-destructive">
                                          Preview: RED - Operação com prejuízo
                                        </span>
                                      </>
                                    )}
                                  </AlertDescription>
                                </Alert>
                              )}

                              {/* Validação de odds */}
                              {((data.entryOdds && !validateOdds(data.entryOdds)) || 
                                (data.exitOdds && !validateOdds(data.exitOdds))) && (
                                <Alert variant="destructive" className="py-2">
                                  <AlertDescription className="flex items-center gap-2 text-xs">
                                    <AlertTriangle className="h-4 w-4" />
                                    Odds devem estar entre 1.01 e 100.00
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedMethods.length === 0 || loading}
              className="flex-1"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação para remover método com dados */}
      <AlertDialog open={!!methodToRemove} onOpenChange={(open) => !open && setMethodToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover método com dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Este método possui dados configurados. Tem certeza que deseja removê-lo?
              Todos os dados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveMethod} className="bg-destructive hover:bg-destructive/90">
              Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

