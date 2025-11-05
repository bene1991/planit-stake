import { Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/useNotifications';

export const NotificationSettings = () => {
  const { preferences, updatePreferences } = useNotifications();

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
