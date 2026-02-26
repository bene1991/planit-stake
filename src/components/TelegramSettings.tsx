import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';

export const TelegramSettings = () => {
  const { settings, updateSettings, loading } = useSettings();
  const [botToken, setBotToken] = useState(settings?.telegram_bot_token || '');
  const [chatId, setChatId] = useState(settings?.telegram_chat_id || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        telegram_bot_token: botToken.trim(),
        telegram_chat_id: chatId.trim(),
      });
      toast.success('✅ Configurações do Telegram salvas');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      toast.error('Configure o Bot Token e Chat ID primeiro');
      return;
    }

    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke('send-telegram-notification', {
        body: {
          action: 'send',
          message: '🎉 Teste de notificação do PlanIt Stake',
          type: 'info',
          botToken: botToken.trim(),
          chatId: chatId.trim(),
        },
      });

      if (error) {
        toast.error('Erro ao enviar: ' + error.message);
      } else {
        toast.success('✅ Mensagem enviada com sucesso!');
      }
    } catch (error: any) {
      toast.error('Erro ao testar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          <CardTitle>Configurações do Telegram</CardTitle>
        </div>
        <CardDescription>
          Configure seu bot do Telegram para receber notificações automáticas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bot-token">Bot Token</Label>
          <Input
            id="bot-token"
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="chat-id">Chat ID</Label>
          <Input
            id="chat-id"
            placeholder="123456789"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || loading}
          >
            {testing ? 'Enviando...' : 'Testar Envio'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
