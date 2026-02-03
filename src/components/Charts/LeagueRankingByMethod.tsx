import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Trophy, ChevronDown, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MethodLeagueRanking, LeagueMethodStats } from '@/hooks/useLeagueRankingByMethod';
import { useState } from 'react';

interface LeagueRankingByMethodProps {
  rankings: MethodLeagueRanking[];
  periodLabel: string;
}

function LeagueRow({ league, position, totalCount }: { league: LeagueMethodStats; position: number; totalCount: number }) {
  const isPositive = league.profit >= 0;
  
  // Determine if this is in top third (best), bottom third (worst), or middle
  const topThreshold = Math.ceil(totalCount / 3);
  const bottomThreshold = totalCount - Math.ceil(totalCount / 3);
  
  const isBest = position <= topThreshold;
  const isWorst = position > bottomThreshold;
  
  return (
    <div className={cn(
      "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors",
      isBest && "bg-success/5 border-l-2 border-success",
      isWorst && "bg-destructive/5 border-l-2 border-destructive",
      !isBest && !isWorst && "bg-secondary/30"
    )}>
      <span className={cn(
        "font-bold text-sm w-6 shrink-0 text-center",
        isBest && "text-success",
        isWorst && "text-destructive",
        !isBest && !isWorst && "text-muted-foreground"
      )}>
        {position}
      </span>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate" title={league.league}>
          {league.league}
        </p>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="text-xs font-mono">
          {league.winRate}%
        </Badge>
        <span className="text-xs text-muted-foreground w-12 text-center">
          {league.total} ops
        </span>
        <span className={cn(
          "text-xs font-semibold w-16 text-right",
          isPositive ? 'text-success' : 'text-destructive'
        )}>
          {isPositive ? '+' : ''}{league.profit}st
        </span>
        {isBest && <TrendingUp className="h-3 w-3 text-success" />}
        {isWorst && <TrendingDown className="h-3 w-3 text-destructive" />}
      </div>
    </div>
  );
}

function MethodRankingCard({ ranking }: { ranking: MethodLeagueRanking }) {
  const [isOpen, setIsOpen] = useState(true);
  
  const totalProfit = ranking.allLeagues.reduce((sum, l) => sum + l.profit, 0);
  const avgWinRate = ranking.allLeagues.length > 0
    ? ranking.allLeagues.reduce((sum, l) => sum + l.winRate, 0) / ranking.allLeagues.length
    : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="font-semibold">{ranking.methodName}</span>
            <Badge variant="secondary" className="text-xs">
              {ranking.allLeagues.length} ligas
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Média: {avgWinRate.toFixed(1)}%
            </span>
            <span className={cn(
              "text-xs font-semibold",
              totalProfit >= 0 ? 'text-success' : 'text-destructive'
            )}>
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}st
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1">
          {/* Header */}
          <div className="flex items-center gap-3 py-1 px-3 text-xs text-muted-foreground font-medium">
            <span className="w-6 text-center">#</span>
            <span className="flex-1">Liga</span>
            <span className="w-12 text-center">WR</span>
            <span className="w-12 text-center">Vol</span>
            <span className="w-16 text-right">Lucro</span>
            <span className="w-3"></span>
          </div>
          
          {/* Leagues */}
          {ranking.allLeagues.map((league, idx) => (
            <LeagueRow
              key={league.league}
              league={league}
              position={idx + 1}
              totalCount={ranking.allLeagues.length}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function LeagueRankingByMethod({ rankings, periodLabel }: LeagueRankingByMethodProps) {
  if (rankings.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-primary" />
          Ranking de Ligas por Método
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Todas as ligas ordenadas por performance (mínimo 3 operações) • {periodLabel}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {rankings.map((ranking) => (
          <MethodRankingCard key={ranking.methodId} ranking={ranking} />
        ))}
      </CardContent>
    </Card>
  );
}
