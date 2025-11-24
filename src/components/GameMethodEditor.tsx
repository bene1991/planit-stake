import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useEffect } from 'react';
import { Game, Method, MethodOperation } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Check, AlertTriangle } from 'lucide-react';
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

// Tipo para armazenar resultado temporário dos métodos
interface MethodFormData {
  result?: 'Green' | 'Red';
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
          result: op.result,
        };
      });
      setMethodsData(initialData);
    }
  }, [game]);

  // Verificar se método está completo
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

    // Create method operations array with updated data
    const methodOperations: MethodOperation[] = selectedMethods.map(methodId => {
      const data = methodsData[methodId];
      const existingOp = game.methodOperations.find(op => op.methodId === methodId);
      
      return {
        methodId,
        operationType: existingOp?.operationType,
        entryOdds: existingOp?.entryOdds,
        exitOdds: existingOp?.exitOdds,
        result: data?.result || existingOp?.result,
      };
    });

    onConfirm(game.id, methodOperations);
    onOpenChange(false);
    toast.success('Métodos atualizados com sucesso!');
  };

  const toggleMethod = (methodId: string) => {
    if (selectedMethods.includes(methodId)) {
      // Verificar se método tem resultado antes de remover
      const existingOp = game?.methodOperations.find(op => op.methodId === methodId);
      const hasData = existingOp && existingOp.result;
      
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

  const updateMethodData = (methodId: string, field: keyof MethodFormData, value: 'Green' | 'Red') => {
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
                  const isComplete = isMethodComplete(method.id);
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
                          
                          {/* Campo de resultado quando selecionado */}
                          {isSelected && (
                            <div className="mt-3 p-3 bg-background/50 rounded-lg border border-border/40">
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
                                  <SelectValue placeholder="Selecione o resultado" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Green">
                                    <div className="flex items-center gap-2">
                                      <Check className="h-3 w-3 text-primary" />
                                      <span className="text-primary font-medium">Green</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="Red">
                                    <div className="flex items-center gap-2">
                                      <X className="h-3 w-3 text-destructive" />
                                      <span className="text-destructive font-medium">Red</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
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

