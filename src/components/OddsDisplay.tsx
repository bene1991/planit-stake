import { cn } from "@/lib/utils";
import { Check, AlertTriangle, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OddsDisplayProps {
  // BTTS from database (fetched once at planning time from The Odds API)
  savedBtts?: {
    yes?: number;
    no?: number;
    bookmaker?: string;
    isBetfair?: boolean;
    isExchange?: boolean;
  };
  onFetchBtts?: () => void;
  fetchingBtts?: boolean;
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
  isExchange, 
  bookmaker 
}: { 
  isBetfair?: boolean; 
  isExchange?: boolean; 
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
  
  if (isExchange) {
    return (
      <span className="text-[8px] text-blue-400 flex items-center gap-0.5">
        <Zap className="h-2.5 w-2.5" />
        {bookmaker || 'Exchange'}
      </span>
    );
  }
  
  return (
    <span className="text-[8px] text-yellow-400 flex items-center gap-0.5">
      <AlertTriangle className="h-2.5 w-2.5" />
      {bookmaker}
    </span>
  );
}

export function OddsDisplay({ savedBtts, onFetchBtts, fetchingBtts }: OddsDisplayProps) {
  const hasSavedBtts = savedBtts?.yes && savedBtts?.no;
  
  // Se não tem BTTS salvo e não pode buscar, não mostra nada
  if (!hasSavedBtts && !onFetchBtts) {
    return null;
  }
  
  return (
    <div className="space-y-2">
      {/* BTTS Section */}
      {hasSavedBtts ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground font-medium">BTTS</span>
            <BookmakerIndicator 
              isBetfair={savedBtts.isBetfair} 
              isExchange={savedBtts.isExchange}
              bookmaker={savedBtts.bookmaker}
            />
            {/* Refresh button for existing BTTS */}
            {onFetchBtts && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onFetchBtts}
                disabled={fetchingBtts}
                className="h-4 w-4 p-0 ml-1"
                title="Atualizar BTTS"
              >
                <RefreshCw className={cn("h-2.5 w-2.5 text-muted-foreground", fetchingBtts && "animate-spin")} />
              </Button>
            )}
          </div>
          <div className="flex gap-1">
            <OddBadge value={savedBtts.yes} label="Sim" />
            <OddBadge value={savedBtts.no} label="Não" />
          </div>
        </div>
      ) : onFetchBtts && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground font-medium">BTTS</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onFetchBtts}
            disabled={fetchingBtts}
            className="h-6 text-[10px] px-2"
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", fetchingBtts && "animate-spin")} />
            {fetchingBtts ? 'Buscando...' : 'Buscar Betfair'}
          </Button>
        </div>
      )}
    </div>
  );
}
