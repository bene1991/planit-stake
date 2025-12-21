import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, Send, Smartphone } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';

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
          <Button
            variant="outline"
            size="sm"
            onClick={sendTestNotification}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar Notificação de Teste
          </Button>
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
