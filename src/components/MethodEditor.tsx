import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';

interface Method {
  id: string;
  name: string;
  percentage: number;
  indice_confianca?: number;
}

interface MethodEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: Method | null;
  onConfirm: (methodId: string, updates: { name: string; percentage: number }) => void;
  loading?: boolean;
  remainingPercentage: number;
}

export const MethodEditor = ({ 
  open, 
  onOpenChange, 
  method, 
  onConfirm, 
  loading,
  remainingPercentage 
}: MethodEditorProps) => {
  const [name, setName] = useState('');
  const [percentage, setPercentage] = useState('');

  useEffect(() => {
    if (method) {
      setName(method.name);
      setPercentage(method.percentage.toString());
    }
  }, [method]);

  const handleConfirm = () => {
    if (!method) return;
    
    if (!name.trim()) {
      return;
    }
    
    const percentageValue = parseFloat(percentage);
    if (isNaN(percentageValue) || percentageValue <= 0) {
      return;
    }

    // Calcular disponível considerando a porcentagem atual do método sendo editado
    const maxAvailable = remainingPercentage + method.percentage;
    if (percentageValue > maxAvailable) {
      return;
    }

    onConfirm(method.id, { name: name.trim(), percentage: percentageValue });
    onOpenChange(false);
  };

  if (!method) return null;

  const maxAvailable = remainingPercentage + method.percentage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Método</DialogTitle>
          <DialogDescription>
            Atualize as informações do método de trabalho
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-method-name">Nome do Método</Label>
            <Input
              id="edit-method-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Under Limit, Lay 0x0"
            />
          </div>
          
          <div>
            <Label htmlFor="edit-method-percentage">Porcentagem da Banca (%)</Label>
            <Input
              id="edit-method-percentage"
              type="number"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="0"
              min="0"
              max={maxAvailable}
              step="0.1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Máximo disponível: {maxAvailable.toFixed(1)}%
            </p>
          </div>

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
              disabled={!name.trim() || !percentage || parseFloat(percentage) <= 0 || loading}
              className="flex-1"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
