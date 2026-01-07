import { cn } from "@/lib/utils";
import { Check, AlertTriangle, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BttsOdds } from "@/hooks/useFixtureOdds";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OddsDisplayProps {
  btts?: BttsOdds | null;
  bookmaker?: string;
  isBetfair?: boolean;
  onRefetch?: () => void;
  loading?: boolean;
  lastUpdate?: Date | string | null;
}

function OddBadge({ 
  value, 
  label, 
  highlight = false 
}: { 
  value: number | undefined; 
  label: string; 
  highlight?: boolean;
}) {
  if (!value) return null;
  
  return (
    <div className={cn(
      "flex flex-col items-center px-2 py-1 rounded-md min-w-[42px]",
      highlight ? "bg-primary/20 text-primary" : "bg-muted/50 text-foreground"
    )}>
      <span className="text-[9px] text-muted-foreground uppercase">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

function OddsSkeleton() {
  return (
    <div className="flex flex-col gap-1 animate-fade-in">
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="h-9 w-[42px] rounded-md" />
        <Skeleton className="h-9 w-[42px] rounded-md" />
      </div>
    </div>
  );
}

function BookmakerIndicator({ 
  isBetfair, 
  bookmaker 
}: { 
  isBetfair?: boolean; 
  bookmaker?: string;
}) {
  if (isBetfair) {
    return (
      <span className="text-[8px] text-emerald-400 flex items-center gap-0.5">
        <Check className="h-2.5 w-2.5" />
        Betfair
      </span>
    );
  }
  
  return (
    <span className="text-[8px] text-yellow-400 flex items-center gap-0.5">
      <AlertTriangle className="h-2.5 w-2.5" />
      {bookmaker || 'N/A'}
    </span>
  );
}

function LastUpdateIndicator({ lastUpdate }: { lastUpdate?: Date | string | null }) {
  if (!lastUpdate) return null;
  
  const date = typeof lastUpdate === 'string' ? new Date(lastUpdate) : lastUpdate;
  const formattedTime = format(date, "HH:mm", { locale: ptBR });
  
  return (
    <span className="text-[8px] text-muted-foreground flex items-center gap-0.5 ml-auto">
      <Clock className="h-2 w-2" />
      {formattedTime}
    </span>
  );
}

export function OddsDisplay({ btts, bookmaker, isBetfair, onRefetch, loading, lastUpdate }: OddsDisplayProps) {
  const hasBtts = btts?.yes && btts?.no;
  
  // Show skeleton while loading and no data yet
  if (loading && !hasBtts) {
    return <OddsSkeleton />;
  }
  
  if (!hasBtts && !onRefetch) {
    return null;
  }
  
  return (
    <div className="space-y-2">
      {hasBtts ? (
        <div className="flex flex-col gap-1 animate-fade-in">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground font-medium">BTTS</span>
            <BookmakerIndicator 
              isBetfair={isBetfair} 
              bookmaker={bookmaker}
            />
            {onRefetch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefetch}
                disabled={loading}
                className="h-4 w-4 p-0 ml-1"
                title="Atualizar BTTS"
              >
                <RefreshCw className={cn("h-2.5 w-2.5 text-muted-foreground", loading && "animate-spin")} />
              </Button>
            )}
            <LastUpdateIndicator lastUpdate={lastUpdate} />
          </div>
          <div className="flex gap-1">
            <OddBadge value={btts.yes} label="Sim" />
            <OddBadge value={btts.no} label="Não" />
          </div>
        </div>
      ) : onRefetch && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground font-medium">BTTS</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefetch}
            disabled={loading}
            className="h-6 text-[10px] px-2"
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", loading && "animate-spin")} />
            {loading ? 'Buscando...' : 'Buscar Odds'}
          </Button>
        </div>
      )}
    </div>
  );
}
