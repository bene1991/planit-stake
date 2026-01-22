import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, Send, Smartphone, Goal, Volume2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { playGoalSound } from '@/utils/soundManager';

export const PushNotificationSettings = () => {
  const { user } = useAuth();
  const {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications();

  // Local storage for goal notifications preference
  const [goalNotificationsEnabled, setGoalNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('goalNotificationsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('goalNotificationsEnabled', JSON.stringify(goalNotificationsEnabled));
  }, [goalNotificationsEnabled]);

  const handleTestGoalSound = () => {
    playGoalSound();
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Faça login para configurar notificações push.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Seu navegador não suporta notificações push.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isSubscribed ? (
            <Bell className="h-5 w-5 text-primary" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receba notificações mesmo quando o app estiver fechado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="push-notifications" className="flex-1">
            <div className="font-medium">Ativar Push Notifications</div>
            <div className="text-sm text-muted-foreground">
              Alertas sobre jogos, resultados e atualizações importantes
            </div>
          </Label>
          <Switch
            id="push-notifications"
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            disabled={isLoading}
          />
        </div>

        {isSubscribed && (
          <>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="goal-notifications" className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    <Goal className="h-4 w-4" />
                    Alertas de Gol
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Som de torcida + notificação push quando houver gol
                  </div>
                </Label>
                <Switch
                  id="goal-notifications"
                  checked={goalNotificationsEnabled}
                  onCheckedChange={setGoalNotificationsEnabled}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestGoalSound}
                className="flex-1"
              >
                <Volume2 className="h-4 w-4 mr-2" />
                🎉 Testar Som de Gol
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={sendTestNotification}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                Testar Push
              </Button>
            </div>
          </>
        )}

        <div className="text-xs text-muted-foreground">
          <p>
            <strong>Dica:</strong> Para receber notificações no celular, adicione este 
            app à sua tela inicial usando o menu do navegador.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
