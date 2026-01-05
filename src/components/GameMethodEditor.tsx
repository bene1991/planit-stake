import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useEffect } from 'react';
import { Game, Method, MethodOperation } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Check, AlertTriangle, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { calculateProfit, calculatePotentialProfit, formatCurrency } from '@/utils/profitCalculator';

interface GameMethodEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game | null;
  methods: Method[];
  onConfirm: (gameId: string, methodOperations: MethodOperation[]) => void;
  loading?: boolean;
}

interface MethodFormData {
  result?: 'Green' | 'Red';
  operationType?: 'Back' | 'Lay';
  stakeValue?: number;
  odd?: number;
}

const DEFAULT_COMMISSION = 0.045;

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
      setSelectedMethods(game.methodOperations.map(op => op.methodId));
      
      const initialData: Record<string, MethodFormData> = {};
      game.methodOperations.forEach(op => {
        initialData[op.methodId] = {
          result: op.result,
          operationType: op.operationType || 'Back',
          stakeValue: op.stakeValue,
          odd: op.odd,
        };
      });
      setMethodsData(initialData);
    }
  }, [game]);

  const isMethodComplete = (methodId: string): boolean => {
    const data = methodsData[methodId];
    return !!data?.result;
  };

  const handleConfirm = () => {
    if (!game) return;
    
    if (selectedMethods.length === 0) {
      toast.error('Selecione pelo menos um método');
      return;
    }

    const methodOperations: MethodOperation[] = selectedMethods.map(methodId => {
      const data = methodsData[methodId];
      const existingOp = game.methodOperations.find(op => op.methodId === methodId);
      
      const operationType = data?.operationType || existingOp?.operationType || 'Back';
      const result = data?.result || existingOp?.result;
      const stakeValue = data?.stakeValue || existingOp?.stakeValue;
      const odd = data?.odd || existingOp?.odd;
      
      let profit: number | undefined;
      if (result && stakeValue && odd && operationType) {
        profit = calculateProfit({
          stakeValue,
          odd,
          operationType,
          result,
          commissionRate: DEFAULT_COMMISSION
        });
      }
      
      return {
        methodId,
        operationType,
        entryOdds: existingOp?.entryOdds,
        exitOdds: existingOp?.exitOdds,
        result,
        stakeValue,
        odd,
        profit,
        commissionRate: DEFAULT_COMMISSION,
      };
    });

    onConfirm(game.id, methodOperations);
    onOpenChange(false);
    toast.success('Métodos atualizados com sucesso!');
  };

  const toggleMethod = (methodId: string) => {
    if (selectedMethods.includes(methodId)) {
      const existingOp = game?.methodOperations.find(op => op.methodId === methodId);
      const hasData = existingOp && existingOp.result;
      
      if (hasData) {
        setMethodToRemove(methodId);
        return;
      }
      
      setSelectedMethods(prev => prev.filter(id => id !== methodId));
      const newData = { ...methodsData };
      delete newData[methodId];
      setMethodsData(newData);
    } else {
      setSelectedMethods(prev => [...prev, methodId]);
      setMethodsData(prev => ({
        ...prev,
        [methodId]: { operationType: 'Back' }
      }));
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

  const updateMethodData = <K extends keyof MethodFormData>(
    methodId: string, 
    field: K, 
    value: MethodFormData[K]
  ) => {
    setMethodsData(prev => ({
      ...prev,
      [methodId]: {
        ...prev[methodId],
        [field]: value,
      }
    }));
  };

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

          {selectedMethods.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium">
                {selectedMethods.length} método{selectedMethods.length > 1 ? 's' : ''} selecionado{selectedMethods.length > 1 ? 's' : ''}
              </span>
              {completedCount > 0 && (
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  {completedCount} com resultado
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {pendingCount} sem resultado
                </Badge>
              )}
            </div>
          )}

          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Selecione os métodos e registre os resultados
              </Label>
              <div className="space-y-3">
              {methods.map((method) => {
                  const isSelected = selectedMethods.includes(method.id);
                  const data = methodsData[method.id] || {};
                  
                  // Calculate profits directly without hooks
                  const potentialProfit = (data.stakeValue && data.odd && data.operationType)
                    ? calculatePotentialProfit(data.stakeValue, data.odd, data.operationType, DEFAULT_COMMISSION)
                    : null;

                  const actualProfit = (data.result && data.stakeValue && data.odd && data.operationType)
                    ? calculateProfit({
                        stakeValue: data.stakeValue,
                        odd: data.odd,
                        operationType: data.operationType,
                        result: data.result,
                        commissionRate: DEFAULT_COMMISSION
                      })
                    : null;
                  
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
                              {isSelected && data.result && (
                                <Badge 
                                  variant={data.result === 'Green' ? 'default' : 'destructive'}
                                  className="text-xs gap-1"
                                >
                                  {data.result === 'Green' ? (
                                    <>
                                      <Check className="h-3 w-3" />
                                      Green
                                    </>
                                  ) : (
                                    <>
                                      <X className="h-3 w-3" />
                                      Red
                                    </>
                                  )}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {isSelected && (
                            <div className="mt-3 p-3 bg-background/50 rounded-lg border border-border/40 space-y-3">
                              {/* Row 1: Operation Type and Odd */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs font-medium mb-1.5 block">
                                    Tipo de Operação
                                  </Label>
                                  <Select
                                    value={data.operationType || 'Back'}
                                    onValueChange={(value: 'Back' | 'Lay') => 
                                      updateMethodData(method.id, 'operationType', value)
                                    }
                                  >
                                    <SelectTrigger className="h-9 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Back">Back</SelectItem>
                                      <SelectItem value="Lay">Lay</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs font-medium mb-1.5 block">
                                    Odd
                                  </Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="1.01"
                                    placeholder="Ex: 1.80"
                                    value={data.odd || ''}
                                    onChange={(e) => 
                                      updateMethodData(method.id, 'odd', Number(e.target.value) || undefined)
                                    }
                                    className="h-9 text-xs"
                                  />
                                </div>
                              </div>

                              {/* Row 2: Stake Value and Result */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs font-medium mb-1.5 block">
                                    Valor de Entrada (R$)
                                  </Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Ex: 100.00"
                                    value={data.stakeValue || ''}
                                    onChange={(e) => 
                                      updateMethodData(method.id, 'stakeValue', Number(e.target.value) || undefined)
                                    }
                                    className="h-9 text-xs"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium mb-1.5 block">
                                    Resultado
                                  </Label>
                                  <Select
                                    value={data.result || ''}
                                    onValueChange={(value: 'Green' | 'Red') => 
                                      updateMethodData(method.id, 'result', value)
                                    }
                                  >
                                    <SelectTrigger className="h-9 text-xs">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Green">
                                        <div className="flex items-center gap-2">
                                          <Check className="h-3 w-3 text-emerald-500" />
                                          <span className="text-emerald-500 font-medium">Green</span>
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="Red">
                                        <div className="flex items-center gap-2">
                                          <X className="h-3 w-3 text-red-500" />
                                          <span className="text-red-500 font-medium">Red</span>
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Profit Preview */}
                              {(potentialProfit || actualProfit !== null) && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border/30">
                                  <Calculator className="h-4 w-4 text-muted-foreground" />
                                  {actualProfit !== null ? (
                                    <span className={cn(
                                      "text-sm font-medium",
                                      actualProfit >= 0 ? "text-emerald-500" : "text-red-500"
                                    )}>
                                      Lucro: {formatCurrency(actualProfit)}
                                      <span className="text-xs text-muted-foreground ml-1">
                                        (4,5% comissão)
                                      </span>
                                    </span>
                                  ) : potentialProfit && (
                                    <span className="text-xs text-muted-foreground">
                                      Se Green: <span className="text-emerald-500 font-medium">{formatCurrency(potentialProfit.green)}</span>
                                      {' | '}
                                      Se Red: <span className="text-red-500 font-medium">{formatCurrency(potentialProfit.red)}</span>
                                    </span>
                                  )}
                                </div>
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
