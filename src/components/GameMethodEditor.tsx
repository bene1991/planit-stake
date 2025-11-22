import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { Game, Method, MethodOperation } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface GameMethodEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game | null;
  methods: Method[];
  onConfirm: (gameId: string, methodOperations: MethodOperation[]) => void;
  loading?: boolean;
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

  useEffect(() => {
    if (game) {
      // Pre-select methods that are already in the game
      setSelectedMethods(game.methodOperations.map(op => op.methodId));
    }
  }, [game]);

  const handleConfirm = () => {
    if (!game) return;
    
    if (selectedMethods.length === 0) {
      toast.error('Selecione pelo menos um método');
      return;
    }

    // Create method operations array
    // Keep existing data for methods that were already selected
    // Add new methods without data
    const methodOperations: MethodOperation[] = selectedMethods.map(methodId => {
      const existingOp = game.methodOperations.find(op => op.methodId === methodId);
      
      if (existingOp) {
        // Keep existing operation with all its data
        return existingOp;
      } else {
        // New method - create empty operation
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
  };

  const toggleMethod = (methodId: string) => {
    setSelectedMethods(prev => 
      prev.includes(methodId) 
        ? prev.filter(id => id !== methodId)
        : [...prev, methodId]
    );
  };

  if (!game) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Métodos do Jogo</DialogTitle>
          <DialogDescription>
            {game.homeTeam} vs {game.awayTeam}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Selecione os métodos para este jogo
            </Label>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {methods.map((method) => {
                const isSelected = selectedMethods.includes(method.id);
                const existingOp = game.methodOperations.find(op => op.methodId === method.id);
                const hasData = existingOp?.operationType && existingOp?.entryOdds && existingOp?.exitOdds;
                
                return (
                  <div 
                    key={method.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all ${
                      isSelected 
                        ? 'bg-primary/10 border-primary/50' 
                        : 'bg-secondary/30 border-border/30 hover:border-border/60'
                    }`}
                  >
                    <Checkbox
                      id={method.id}
                      checked={isSelected}
                      onCheckedChange={() => toggleMethod(method.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label 
                        htmlFor={method.id}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {method.name}
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {method.percentage}% da banca
                        </span>
                        {hasData && (
                          <span className="text-xs text-primary font-medium">
                            • {existingOp.operationType}: {existingOp.entryOdds?.toFixed(2)} → {existingOp.exitOdds?.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

