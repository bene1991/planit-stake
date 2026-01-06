import { PreMatchOdds, LiveOdds } from "@/hooks/useFixtureOdds";
import { cn } from "@/lib/utils";
import { TrendingUp, Radio, Target, CornerDownRight, Goal, Check, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OddsDisplayProps {
  preMatch: PreMatchOdds | null;
  live?: LiveOdds | null;
  loading?: boolean;
  isLive?: boolean;
  // BTTS from database (fetched once at planning time from The Odds API)
  savedBtts?: {
    yes?: number;
    no?: number;
    bookmaker?: string;
    isBetfair?: boolean;
  };
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

function OverUnderBadge({ 
  line, 
  over, 
  under, 
  icon: Icon 
}: { 
  line: string; 
  over: number; 
  under: number;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
      <span className="text-[9px] text-muted-foreground">{line}</span>
      <div className="flex gap-0.5">
        <div className="flex flex-col items-center px-1.5 py-0.5 rounded bg-muted/50 min-w-[36px]">
          <span className="text-[8px] text-muted-foreground">Over</span>
          <span className="text-[10px] font-semibold tabular-nums text-foreground">{over.toFixed(2)}</span>
        </div>
        <div className="flex flex-col items-center px-1.5 py-0.5 rounded bg-muted/50 min-w-[36px]">
          <span className="text-[8px] text-muted-foreground">Under</span>
          <span className="text-[10px] font-semibold tabular-nums text-foreground">{under.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

export function OddsDisplay({ preMatch, live, loading, isLive, savedBtts }: OddsDisplayProps) {
  if (loading) {
    return (
      <div className="animate-pulse flex gap-2">
        <div className="h-8 w-24 bg-muted/50 rounded-md" />
        <div className="h-8 w-16 bg-muted/50 rounded-md" />
      </div>
    );
  }
  
  const hasPreMatch = preMatch && (preMatch.matchOdds || preMatch.btts || preMatch.overUnder25);
  const hasLive = live && (live.goalsOU || live.cornersOU || live.nextGoal);
  const hasSavedBtts = savedBtts?.yes && savedBtts?.no;
  
  if (!hasPreMatch && !hasLive && !hasSavedBtts) {
    return null;
  }
  
  // Find the lowest odd (favorite) for match odds
  const matchOddsValues = preMatch?.matchOdds 
    ? [preMatch.matchOdds.home, preMatch.matchOdds.draw, preMatch.matchOdds.away] 
    : [];
  const minMatchOdd = Math.min(...matchOddsValues.filter(Boolean));
  
  return (
    <div className="space-y-3">
      {/* Pre-match Odds Section */}
      {hasPreMatch && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Odds Kickoff ({preMatch.bookmaker})</span>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Match Odds (1X2) */}
            {preMatch.matchOdds && (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-muted-foreground font-medium">1X2</span>
                <div className="flex gap-1">
                  <OddBadge 
                    value={preMatch.matchOdds.home} 
                    label="1" 
                    highlight={preMatch.matchOdds.home === minMatchOdd}
                  />
                  <OddBadge 
                    value={preMatch.matchOdds.draw} 
                    label="X" 
                    highlight={preMatch.matchOdds.draw === minMatchOdd}
                  />
                  <OddBadge 
                    value={preMatch.matchOdds.away} 
                    label="2" 
                    highlight={preMatch.matchOdds.away === minMatchOdd}
                  />
                </div>
              </div>
            )}
            
            {/* BTTS - prioritize saved BTTS from The Odds API */}
            {hasSavedBtts ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground font-medium">BTTS</span>
                  {savedBtts.isBetfair ? (
                    <span className="text-[8px] text-emerald-400 flex items-center gap-0.5">
                      <Check className="h-2.5 w-2.5" />
                      Betfair
                    </span>
                  ) : (
                    <span className="text-[8px] text-yellow-400 flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {savedBtts.bookmaker}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <OddBadge value={savedBtts.yes} label="Sim" />
                  <OddBadge value={savedBtts.no} label="Não" />
                </div>
              </div>
            ) : preMatch?.btts && (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-muted-foreground font-medium">BTTS</span>
                <div className="flex gap-1">
                  <OddBadge value={preMatch.btts.yes} label="Sim" />
                  <OddBadge value={preMatch.btts.no} label="Não" />
                </div>
              </div>
            )}
            
            {/* Over/Under 2.5 */}
            {preMatch.overUnder25 && (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-muted-foreground font-medium">O/U 2.5</span>
                <div className="flex gap-1">
                  <OddBadge value={preMatch.overUnder25.over} label="Over" />
                  <OddBadge value={preMatch.overUnder25.under} label="Under" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Live Odds Section */}
      {hasLive && isLive && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px]">
            <Radio className="h-3 w-3 text-primary animate-pulse" />
            <span className="text-primary font-medium">Odds Live</span>
            <span className="text-muted-foreground">
              ({formatDistanceToNow(live.lastUpdate, { addSuffix: false, locale: ptBR })})
            </span>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Goals Over/Under */}
            {live.goalsOU && (
              <OverUnderBadge 
                line={`Gols ${live.goalsOU.line}`} 
                over={live.goalsOU.over} 
                under={live.goalsOU.under}
                icon={Goal}
              />
            )}
            
            {/* Corners Over/Under */}
            {live.cornersOU && (
              <OverUnderBadge 
                line={`Escanteios ${live.cornersOU.line}`} 
                over={live.cornersOU.over} 
                under={live.cornersOU.under}
                icon={CornerDownRight}
              />
            )}
            
            {/* Next Goal */}
            {live.nextGoal && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Target className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground font-medium">Próx. Gol</span>
                </div>
                <div className="flex gap-1">
                  <OddBadge value={live.nextGoal.home} label="Casa" />
                  <OddBadge value={live.nextGoal.away} label="Fora" />
                  {live.nextGoal.none > 0 && (
                    <OddBadge value={live.nextGoal.none} label="Nenhum" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
