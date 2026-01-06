import { cn } from "@/lib/utils";
import { Check, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BttsOdds } from "@/hooks/useFixtureOdds";

interface OddsDisplayProps {
  btts?: BttsOdds | null;
  bookmaker?: string;
  isBetfair?: boolean;
  onRefetch?: () => void;
  loading?: boolean;
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

export function OddsDisplay({ btts, bookmaker, isBetfair, onRefetch, loading }: OddsDisplayProps) {
  const hasBtts = btts?.yes && btts?.no;
  
  if (!hasBtts && !onRefetch) {
    return null;
  }
  
  return (
    <div className="space-y-2">
      {hasBtts ? (
        <div className="flex flex-col gap-1">
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
