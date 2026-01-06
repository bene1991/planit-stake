import { FixtureOdds } from "@/hooks/useFixtureOdds";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface OddsDisplayProps {
  odds: FixtureOdds | null;
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

export function OddsDisplay({ odds, loading }: OddsDisplayProps) {
  if (loading) {
    return (
      <div className="animate-pulse flex gap-2">
        <div className="h-8 w-24 bg-muted/50 rounded-md" />
        <div className="h-8 w-16 bg-muted/50 rounded-md" />
      </div>
    );
  }
  
  if (!odds || (!odds.matchOdds && !odds.btts)) {
    return null;
  }
  
  // Find the lowest odd (favorite) for match odds
  const matchOddsValues = odds.matchOdds 
    ? [odds.matchOdds.home, odds.matchOdds.draw, odds.matchOdds.away] 
    : [];
  const minMatchOdd = Math.min(...matchOddsValues.filter(Boolean));
  
  return (
    <div className="space-y-2">
      {/* Header with bookmaker */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <TrendingUp className="h-3 w-3" />
        <span>Odds ({odds.bookmaker})</span>
        {odds.isLive && (
          <span className="px-1 py-0.5 text-[8px] font-bold bg-primary/20 text-primary rounded">
            LIVE
          </span>
        )}
      </div>
      
      <div className="flex flex-wrap gap-3">
        {/* Match Odds (1X2) */}
        {odds.matchOdds && (
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-muted-foreground font-medium">Match Odds</span>
            <div className="flex gap-1">
              <OddBadge 
                value={odds.matchOdds.home} 
                label="1" 
                highlight={odds.matchOdds.home === minMatchOdd}
              />
              <OddBadge 
                value={odds.matchOdds.draw} 
                label="X" 
                highlight={odds.matchOdds.draw === minMatchOdd}
              />
              <OddBadge 
                value={odds.matchOdds.away} 
                label="2" 
                highlight={odds.matchOdds.away === minMatchOdd}
              />
            </div>
          </div>
        )}
        
        {/* BTTS */}
        {odds.btts && (
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-muted-foreground font-medium">BTTS</span>
            <div className="flex gap-1">
              <OddBadge 
                value={odds.btts.yes} 
                label="Sim"
              />
              <OddBadge 
                value={odds.btts.no} 
                label="Não"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
