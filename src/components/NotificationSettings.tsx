import { Bell, MonitorSmartphone, Volume2, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { testSound, NotificationSoundType, testGameStartVoice } from '@/utils/soundManager';
import { supabase } from '@/integrations/supabase/client';

export const NotificationSettings = () => {
  const { preferences, updatePreferences, requestNativePermission } = useNotifications();

  const handleNativeToggle = async (checked: boolean) => {
    if (checked) {
      if (!('Notification' in window)) {
        toast.error('Seu navegador não suporta notificações nativas');
        return;
      }

      const granted = await requestNativePermission();
      if (granted) {
        updatePreferences({ nativeEnabled: true });
        toast.success('Notificações nativas ativadas! Você será alertado mesmo com a aba minimizada.');
      } else {
        toast.error('Permissão negada. Ative nas configurações do navegador.');
      }
    } else {
      updatePreferences({ nativeEnabled: false });
    }
  };

  const testNotification = async (type: NotificationSoundType) => {
    const messages = {
      success: { title: '✅ Teste de Sucesso', body: 'Notificação de sucesso funcionando!' },
      warning: { title: '⚠️ Teste de Aviso', body: 'Notificação de aviso funcionando!' },
      error: { title: '🚨 Teste de Erro', body: 'Notificação de erro funcionando!' },
      info: { title: 'ℹ️ Teste de Info', body: 'Notificação informativa funcionando!' }
    };
    
    const msg = messages[type];
    
    // Test toast
    toast[type](msg.title, { description: msg.body });
    
    // Test sound
    testSound(type);
    
    // Test Telegram
    if (preferences.telegramEnabled) {
      try {
        const { error } = await supabase.functions.invoke('send-telegram-notification', {
          body: { title: msg.title, message: msg.body, type }
        });
        if (error) {
          toast.error('Erro ao enviar para Telegram', { description: error.message });
        } else {
          toast.success('Mensagem enviada para Telegram!');
        }
      } catch (err) {
        toast.error('Erro ao testar Telegram');
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>Notificações</CardTitle>
        </div>
        <CardDescription>
          Configure os alertas que deseja receber sobre seus jogos e performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enabled" className="text-base font-semibold">
              Ativar notificações
            </Label>
            <p className="text-sm text-muted-foreground">
              Habilita ou desabilita todas as notificações
            </p>
          </div>
          <Switch
            id="enabled"
            checked={preferences.enabled}
            onCheckedChange={(checked) => updatePreferences({ enabled: checked })}
          />
        </div>

        <Separator />

        {/* Native notifications */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MonitorSmartphone className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="native-enabled" className="cursor-pointer font-medium">
                Notificações nativas do navegador
              </Label>
              <p className="text-sm text-muted-foreground">
                Receba alertas mesmo com a aba minimizada ou em segundo plano
              </p>
            </div>
          </div>
          <Switch
            id="native-enabled"
            checked={preferences.nativeEnabled}
            onCheckedChange={handleNativeToggle}
            disabled={!preferences.enabled}
          />
        </div>

        <Separator />

        {/* Telegram notifications */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Send className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="telegram-enabled" className="cursor-pointer font-medium">
                Enviar para Telegram
              </Label>
              <p className="text-sm text-muted-foreground">
                Receba todas as notificações também no seu Telegram
              </p>
            </div>
          </div>
          <Switch
            id="telegram-enabled"
            checked={preferences.telegramEnabled}
            onCheckedChange={(checked) => updatePreferences({ telegramEnabled: checked })}
            disabled={!preferences.enabled}
          />
        </div>

        <Separator />

        {/* Sound notifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="sound-enabled" className="cursor-pointer font-medium">
                  Sons de notificação
                </Label>
                <p className="text-sm text-muted-foreground">
                  Reproduzir som ao receber notificações
                </p>
              </div>
            </div>
            <Switch
              id="sound-enabled"
              checked={preferences.soundEnabled}
              onCheckedChange={(checked) => updatePreferences({ soundEnabled: checked })}
              disabled={!preferences.enabled}
            />
          </div>

          {preferences.soundEnabled && (
            <div className="ml-8 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Testar sons:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testSound('success')}
                  className="text-xs"
                >
                  ✅ Sucesso
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testSound('warning')}
                  className="text-xs"
                >
                  ⚠️ Aviso
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testSound('error')}
                  className="text-xs"
                >
                  🚨 Erro
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testSound('info')}
                  className="text-xs"
                >
                  ℹ️ Info
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Test complete notification system */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Testar Sistema Completo</h3>
          <p className="text-sm text-muted-foreground">
            Teste o sistema completo (toast + som + telegram)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => testNotification('success')}>
              ✅ Sucesso
            </Button>
            <Button variant="outline" size="sm" onClick={() => testNotification('warning')}>
              ⚠️ Aviso
            </Button>
            <Button variant="outline" size="sm" onClick={() => testNotification('error')}>
              🚨 Erro
            </Button>
            <Button variant="outline" size="sm" onClick={() => testNotification('info')}>
              ℹ️ Info
            </Button>
          </div>
        </div>

        <Separator />

        {/* Game alerts */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Alertas de Jogos</h4>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="gameProximity" className="text-sm">
                Proximidade de início
              </Label>
              <p className="text-xs text-muted-foreground">
                Alertas 15 e 5 minutos antes do jogo
              </p>
            </div>
            <Switch
              id="gameProximity"
              checked={preferences.gameProximity}
              onCheckedChange={(checked) => updatePreferences({ gameProximity: checked })}
              disabled={!preferences.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="gameLive" className="text-sm">
                Jogo ao vivo
              </Label>
              <p className="text-xs text-muted-foreground">
                Notificar quando jogo começar (Live)
              </p>
            </div>
            <Switch
              id="gameLive"
              checked={preferences.gameLive}
              onCheckedChange={(checked) => updatePreferences({ gameLive: checked })}
              disabled={!preferences.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="voiceAlerts" className="text-sm">
                🗣️ Voz de início de jogo
              </Label>
              <p className="text-xs text-muted-foreground">
                Fala "Jogo começando agora!" quando o jogo inicia
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  testGameStartVoice();
                  toast.info('Testando voz...');
                }}
                disabled={!preferences.enabled || !preferences.voiceAlerts}
                className="text-xs h-7 px-2"
              >
                Testar
              </Button>
              <Switch
                id="voiceAlerts"
                checked={preferences.voiceAlerts}
                onCheckedChange={(checked) => updatePreferences({ voiceAlerts: checked })}
                disabled={!preferences.enabled}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="gameFinished" className="text-sm">
                Jogo finalizado
              </Label>
              <p className="text-xs text-muted-foreground">
                Notificar quando jogo terminar
              </p>
            </div>
            <Switch
              id="gameFinished"
              checked={preferences.gameFinished}
              onCheckedChange={(checked) => updatePreferences({ gameFinished: checked })}
              disabled={!preferences.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pendingOperations" className="text-sm">
                Operações pendentes
              </Label>
              <p className="text-xs text-muted-foreground">
                Lembrete de operações sem resultado
              </p>
            </div>
            <Switch
              id="pendingOperations"
              checked={preferences.pendingOperations}
              onCheckedChange={(checked) => updatePreferences({ pendingOperations: checked })}
              disabled={!preferences.enabled}
            />
          </div>
        </div>

        <Separator />

        {/* Performance alerts */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Alertas de Performance</h4>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="dailyGoals" className="text-sm">
                Metas diárias
              </Label>
              <p className="text-xs text-muted-foreground">
                Notificar quando atingir 5 greens no dia
              </p>
            </div>
            <Switch
              id="dailyGoals"
              checked={preferences.dailyGoals}
              onCheckedChange={(checked) => updatePreferences({ dailyGoals: checked })}
              disabled={!preferences.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="winRateAlerts" className="text-sm">
                Win rate crítico
              </Label>
              <p className="text-xs text-muted-foreground">
                Alerta quando win rate cair abaixo de 50%
              </p>
            </div>
            <Switch
              id="winRateAlerts"
              checked={preferences.winRateAlerts}
              onCheckedChange={(checked) => updatePreferences({ winRateAlerts: checked })}
              disabled={!preferences.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="streakAlerts" className="text-sm">
                Sequências (Streaks)
              </Label>
              <p className="text-xs text-muted-foreground">
                Notificar em sequências de 5+ greens ou 3+ reds
              </p>
            </div>
            <Switch
              id="streakAlerts"
              checked={preferences.streakAlerts}
              onCheckedChange={(checked) => updatePreferences({ streakAlerts: checked })}
              disabled={!preferences.enabled}
            />
          </div>
        </div>

        <Separator />

        {/* ROI alerts */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Alertas de ROI</h4>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="roiAlerts" className="text-sm">
                Lucro/Prejuízo acumulado
              </Label>
              <p className="text-xs text-muted-foreground">
                Alertas de ROI significativo no dia
              </p>
            </div>
            <Switch
              id="roiAlerts"
              checked={preferences.roiAlerts}
              onCheckedChange={(checked) => updatePreferences({ roiAlerts: checked })}
              disabled={!preferences.enabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
