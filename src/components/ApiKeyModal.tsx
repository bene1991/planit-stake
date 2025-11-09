import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';

interface ApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ApiKeyModal = ({ open, onOpenChange }: ApiKeyModalProps) => {
  const { settings, updateSettings } = useSettings();
  const [apiKey, setApiKey] = useState(settings?.api_key || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('Por favor, insira a API Key');
      return;
    }

    setLoading(true);
    try {
      await updateSettings({ api_key: apiKey.trim() });
      toast.success('✅ API Key vinculada com sucesso');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving API key:', error);
      toast.error('Erro ao salvar API Key: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular API Key</DialogTitle>
          <DialogDescription>
            Cole sua API Key do API-Football para habilitar as funcionalidades de importação
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              placeholder="Cole sua API Key aqui"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
