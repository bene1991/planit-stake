import { DominanceResult } from '@/hooks/useDominanceAnalysis';
import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingUp, ShieldAlert, Flame, RefreshCw } from 'lucide-react';

interface DominanceIndicatorProps {
  result: DominanceResult;
}

const alertIcons = {
  high_pressure: Flame,
  danger_zone: ShieldAlert,
  momentum_shift: RefreshCw,
  defensive_lock: AlertTriangle,
} as const;

const severityStyles = {
  info: 'text-muted-foreground bg-muted/50',
  warning: 'text-amber-400 bg-amber-500/10',
  critical: 'text-red-400 bg-red-500/10',
} as const;

export function DominanceIndicator({ result }: DominanceIndicatorProps) {
  const { dataStatus, dataStatusMessage, dominanceIndex, dominanceLabel, alerts } = result;

  // Unavailable: show warning only
  if (dataStatus === 'unavailable') {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
        <span className="text-sm">🔴</span>
        <span className="text-[11px] text-destructive font-medium">{dataStatusMessage}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Data status badge + dominance label */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{dataStatus === 'ok' ? '🟢' : '🟡'}</span>
          {dataStatus === 'limited' && (
            <span className="text-[10px] text-amber-400 font-medium">{dataStatusMessage}</span>
          )}
        </div>
        {dominanceIndex !== null && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-foreground">{dominanceLabel}</span>
            <span className="text-[10px] font-bold text-primary tabular-nums">{dominanceIndex} LDI</span>
          </div>
        )}
      </div>

      {/* Dominance bar */}
      {dominanceIndex !== null && (
        <div className="relative h-2 w-full rounded-full overflow-hidden bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-700"
            style={{ width: `${dominanceIndex}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-full bg-violet-500 transition-all duration-700"
            style={{ width: `${100 - dominanceIndex}%` }}
          />
          {/* Center marker */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-background/60" />
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1">
          {alerts.map((alert, i) => {
            const Icon = alertIcons[alert.type];
            return (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium',
                  severityStyles[alert.severity]
                )}
              >
                <Icon className="h-3 w-3 flex-shrink-0" />
                <span>{alert.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
