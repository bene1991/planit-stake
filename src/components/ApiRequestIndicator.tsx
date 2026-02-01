import { Activity, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiRequestTracker } from '@/hooks/useApiRequestTracker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';

export function ApiRequestIndicator() {
  const { requestCount, dailyLimit, percentage, remaining, isFromApi } = useApiRequestTracker();

  const getColor = () => {
    if (percentage >= 90) return 'text-destructive';
    if (percentage >= 70) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const getProgressColor = () => {
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-muted/50 cursor-help",
            getColor()
          )}>
            {percentage >= 90 ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Activity className="h-3 w-3" />
            )}
            <span>{requestCount.toLocaleString()}/{(dailyLimit / 1000).toFixed(1)}k</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-64">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>API-Football</span>
              <span className={cn("font-medium", getColor())}>
                {percentage.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={percentage} 
              className="h-2"
              style={{
                ['--progress-background' as string]: percentage >= 90 
                  ? 'hsl(var(--destructive))' 
                  : percentage >= 70 
                    ? 'hsl(45 93% 47%)' 
                    : 'hsl(var(--primary))'
              }}
            />
          <div className="text-xs text-muted-foreground">
            <p>{requestCount.toLocaleString()} de {dailyLimit.toLocaleString()} requisições usadas</p>
            <p>{remaining.toLocaleString()} restantes hoje</p>
            <div className="flex items-center gap-1 mt-1">
              {isFromApi ? (
                <>
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">Sincronizado com API</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-yellow-500" />
                  <span className="text-yellow-600 dark:text-yellow-400">Estimativa local</span>
                </>
              )}
            </div>
          </div>
          {percentage >= 70 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Considere aumentar o intervalo de atualização
            </p>
          )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
