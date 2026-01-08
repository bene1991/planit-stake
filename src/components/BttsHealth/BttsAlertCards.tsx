import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BttsAlert } from '@/types/btts';
import { getOverallStatus } from '@/hooks/useBttsAlerts';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, XCircle, Bell } from 'lucide-react';

interface BttsAlertCardsProps {
  alerts: BttsAlert[];
}

export function BttsAlertCards({ alerts }: BttsAlertCardsProps) {
  const overallStatus = getOverallStatus(alerts);

  if (alerts.length === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="font-medium text-green-500">✅ Tudo OK</p>
              <p className="text-sm text-muted-foreground">
                Nenhum alerta ativo. Continue operando normalmente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "border-border/50",
      overallStatus === 'caution' && "border-yellow-500/30 bg-yellow-500/5",
      overallStatus === 'pause' && "border-destructive/30 bg-destructive/5"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className={cn(
            "h-4 w-4",
            overallStatus === 'caution' && "text-yellow-500",
            overallStatus === 'pause' && "text-destructive"
          )} />
          {overallStatus === 'pause' ? '🔴 Alertas Críticos' : '⚠️ Alertas Ativos'}
          <span className="text-xs text-muted-foreground font-normal">
            ({alerts.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              "p-3 rounded-lg border",
              alert.status === 'ok' && "border-green-500/30 bg-green-500/10",
              alert.status === 'caution' && "border-yellow-500/30 bg-yellow-500/10",
              alert.status === 'pause' && "border-destructive/30 bg-destructive/10"
            )}
          >
            <div className="flex items-start gap-2">
              {alert.status === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />}
              {alert.status === 'caution' && <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />}
              {alert.status === 'pause' && <XCircle className="h-4 w-4 text-destructive mt-0.5" />}
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium",
                  alert.status === 'caution' && "text-yellow-600 dark:text-yellow-400",
                  alert.status === 'pause' && "text-destructive"
                )}>
                  {alert.title}
                </p>
                <p className="text-xs text-muted-foreground">{alert.description}</p>
                {alert.action && (
                  <p className="text-xs font-medium mt-1 text-foreground/80">
                    → {alert.action}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
