import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Trophy, AlertTriangle, ChevronDown, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MethodLeagueRanking, LeagueMethodStats } from '@/hooks/useLeagueRankingByMethod';
import { useState } from 'react';

interface LeagueRankingByMethodProps {
  rankings: MethodLeagueRanking[];
  periodLabel: string;
}

function LeagueItem({ league, position, type }: { league: LeagueMethodStats; position: number; type: 'best' | 'worst' }) {
  const isPositive = league.profit >= 0;
  
  return (
    <div className="flex items-start gap-3 py-2">
      <span className={cn(
        "font-bold text-lg w-6 shrink-0",
        type === 'best' ? 'text-success' : 'text-destructive'
      )}>
        {position}.
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" title={league.league}>
          {league.league}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
          <Badge variant="outline" className="text-xs">
            {league.winRate}% WR
          </Badge>
          <span className="text-muted-foreground">
            {league.total} ops
          </span>
          <span className={cn(
            "font-semibold",
            isPositive ? 'text-success' : 'text-destructive'
          )}>
            {isPositive ? '+' : ''}{league.profit}st
          </span>
        </div>
      </div>
    </div>
  );
}

function MethodRankingCard({ ranking }: { ranking: MethodLeagueRanking }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="font-semibold">{ranking.methodName}</span>
            <Badge variant="secondary" className="text-xs">
              {ranking.bestLeagues.length + ranking.worstLeagues.length} ligas
            </Badge>
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          {/* Best Leagues */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <Trophy className="h-4 w-4" />
              MELHORES
            </div>
            <div className="space-y-1 divide-y divide-border/50">
              {ranking.bestLeagues.length > 0 ? (
                ranking.bestLeagues.map((league, idx) => (
                  <LeagueItem
                    key={league.league}
                    league={league}
                    position={idx + 1}
                    type="best"
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  Sem dados suficientes
                </p>
              )}
            </div>
          </div>

          {/* Worst Leagues */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              PIORES
            </div>
            <div className="space-y-1 divide-y divide-border/50">
              {ranking.worstLeagues.length > 0 ? (
                ranking.worstLeagues.map((league, idx) => (
                  <LeagueItem
                    key={league.league}
                    league={league}
                    position={idx + 1}
                    type="worst"
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  Sem dados suficientes
                </p>
              )}
            </div>
          </div>
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
          Melhores e piores ligas para cada método • {periodLabel}
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
