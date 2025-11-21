import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/useSettings';

interface GoogleSheetsSyncProps {
  onSuccess?: () => void;
}

export const GoogleSheetsSync = ({ onSuccess }: GoogleSheetsSyncProps) => {
  const [syncing, setSyncing] = useState(false);
  const { settings, updateSettings } = useSettings();

  const handleSync = async () => {
    setSyncing(true);
    
    try {
      // Se não tiver URL salva, salvar a URL do link fornecido
      if (!settings?.google_sheets_url) {
        await updateSettings({
          google_sheets_url: 'https://docs.google.com/spreadsheets/d/1uhfkfHOrz0qpfQ5XJsmcpT5RnH0CS_KB/edit?usp=sharing&ouid=113855482681932523567&rtpof=true&sd=true'
        });
      }

      const { data, error } = await supabase.functions.invoke('sync-google-sheets');

      if (error) throw error;

      toast.success('Sincronização concluída!', {
        description: `${data.count} jogos importados do Google Sheets`,
      });

      onSuccess?.();
    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      toast.error('Erro na sincronização', {
        description: error.message || 'Não foi possível sincronizar com o Google Sheets',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button 
      variant="default" 
      size="sm" 
      onClick={handleSync}
      disabled={syncing}
      className="h-8"
    >
      <RefreshCw className={`h-3.5 w-3.5 sm:mr-2 ${syncing ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">
        {syncing ? 'Sincronizando...' : 'Sincronizar'}
      </span>
    </Button>
  );
};
