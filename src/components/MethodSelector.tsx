import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

interface Method {
  id: string;
  name: string;
  percentage: number;
}

interface MethodSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  methods: Method[];
  onConfirm: (methodIds: string[]) => void;
  loading?: boolean;
}

export const MethodSelector = ({ open, onOpenChange, methods, onConfirm, loading }: MethodSelectorProps) => {
  const [selectedMethodIds, setSelectedMethodIds] = useState<string[]>([]);

  const handleConfirm = () => {
    if (selectedMethodIds.length > 0) {
      onConfirm(selectedMethodIds);
      setSelectedMethodIds([]);
    }
  };

  const toggleMethod = (methodId: string) => {
    setSelectedMethodIds(prev => 
      prev.includes(methodId)
        ? prev.filter(id => id !== methodId)
        : [...prev, methodId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Método de Trabalho</DialogTitle>
          <DialogDescription>
            Escolha o método que você vai usar para este jogo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum método disponível. Crie um método primeiro.
            </p>
          ) : (
            <div className="space-y-2">
              {methods.map((method) => (
                <div key={method.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={method.id} 
                    checked={selectedMethodIds.includes(method.id)}
                    onCheckedChange={() => toggleMethod(method.id)}
                  />
                  <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                    {method.name} ({method.percentage}%)
                  </Label>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedMethodIds.length === 0 || loading}
              className="flex-1"
            >
              {loading ? 'Adicionando...' : `Confirmar ${selectedMethodIds.length > 0 ? `(${selectedMethodIds.length})` : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
