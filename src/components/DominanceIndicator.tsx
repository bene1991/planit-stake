import { DominanceResult } from '@/hooks/useDominanceAnalysis';
import { LdiSnapshot } from '@/hooks/useLdiHistory';
import { LdiSparkline } from '@/components/LdiSparkline';
import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingUp, ShieldAlert, Flame, RefreshCw, Info, Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DominanceIndicatorProps {
  result: DominanceResult;
  ldiHistory?: LdiSnapshot[];
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

const ldiTiers = [
  { range: '65-100', label: 'Casa domina' },
  { range: '55-64', label: 'Casa com vantagem' },
  { range: '45-54', label: 'Equilibrado' },
  { range: '35-44', label: 'Visitante com vantagem' },
  { range: '0-34', label: 'Visitante domina' },
];

export function DominanceIndicator({ result, ldiHistory = [] }: DominanceIndicatorProps) {
  const { dataStatus, dataStatusMessage, dominanceIndex, dominanceLabel, alerts } = result;

  // No coverage: neutral info badge
  if (dataStatus === 'no_coverage') {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
        <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-[11px] text-muted-foreground font-medium">{dataStatusMessage}</span>
      </div>
    );
  }

  // Unavailable: show loading or waiting state
  if (dataStatus === 'unavailable') {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
        <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin flex-shrink-0" />
        <span className="text-[11px] text-muted-foreground font-medium">{dataStatusMessage}</span>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-1.5">
        {/* Data status badge + dominance label + sparkline */}
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] font-bold text-primary tabular-nums cursor-help">
                    {dominanceIndex} LDI
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs font-semibold mb-1">Live Dominance Index</p>
                  <div className="space-y-0.5">
                    {ldiTiers.map(t => (
                      <div key={t.range} className="flex justify-between gap-3 text-[10px]">
                        <span className="text-muted-foreground tabular-nums">{t.range}</span>
                        <span>{t.label}</span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
              {/* Sparkline */}
              {ldiHistory.length >= 2 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <LdiSparkline data={ldiHistory} width={100} height={20} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-[10px]">Evolução do LDI ao longo do jogo</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* Dominance bar */}
        {dominanceIndex !== null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative h-2 w-full rounded-full overflow-hidden bg-muted cursor-help">
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
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-[10px]">🟢 Casa &nbsp;|&nbsp; 🟣 Visitante</p>
            </TooltipContent>
          </Tooltip>
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
    </TooltipProvider>
  );
}
