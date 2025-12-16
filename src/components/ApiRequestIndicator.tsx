import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiRequestTracker } from '@/hooks/useApiRequestTracker';

export function ApiRequestIndicator() {
  const { requestCount, dailyLimit, percentage } = useApiRequestTracker();

  const getColor = () => {
    if (percentage >= 90) return 'text-destructive';
    if (percentage >= 70) return 'text-yellow-500';
    return 'text-primary';
  };

  return (
    <div className={cn(
      "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-muted/50",
      getColor()
    )}>
      <Activity className="h-3 w-3" />
      <span>{requestCount}/{dailyLimit}</span>
    </div>
  );
}
