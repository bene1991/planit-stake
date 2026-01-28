import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/profitCalculator';

interface MethodStats {
  methodId: string;
  methodName: string;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
  profitReais: number;
  combinedScore: number;
  activeDays: number;
}

interface MethodsRankingTableProps {
  methodStats: MethodStats[];
}

export function MethodsRankingTable({ methodStats }: MethodsRankingTableProps) {
  const sortedMethods = useMemo(() => {
    return [...methodStats].sort((a, b) => b.combinedScore - a.combinedScore);
  }, [methodStats]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm text-muted-foreground font-medium">{index + 1}</span>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bom';
    if (score >= 40) return 'Regular';
    if (score >= 20) return 'Atenção';
    return 'Crítico';
  };

  const getProfitIcon = (profit: number) => {
    if (profit > 0) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    if (profit < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  if (sortedMethods.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Ranking de Métodos
          <Badge variant="secondary" className="ml-auto text-xs">
            Por Score Combinado
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-12">#</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Método</th>
                <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Score</th>
                <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">WR%</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Lucro R$</th>
                <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Volume</th>
                <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Dias</th>
              </tr>
            </thead>
            <tbody>
              {sortedMethods.map((method, index) => (
                <tr 
                  key={method.methodId} 
                  className={cn(
                    "border-b border-border/30 hover:bg-muted/30 transition-colors",
                    index === 0 && "bg-yellow-500/5"
                  )}
                >
                  <td className="px-4 py-3">
                    {getRankIcon(index)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-sm">{method.methodName}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Badge 
                        className={cn(
                          "text-white text-xs font-bold px-2",
                          getScoreColor(method.combinedScore)
                        )}
                      >
                        {method.combinedScore}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        {getScoreLabel(method.combinedScore)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "font-medium text-sm",
                      method.winRate >= 60 ? "text-emerald-500" : 
                      method.winRate >= 50 ? "text-yellow-500" : "text-red-500"
                    )}>
                      {method.winRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {getProfitIcon(method.profitReais)}
                      <span className={cn(
                        "font-mono text-sm font-medium",
                        method.profitReais >= 0 ? "text-emerald-500" : "text-red-500"
                      )}>
                        {formatCurrency(method.profitReais)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-medium text-sm">{method.total}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {method.greens}G/{method.reds}R
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className="text-sm text-muted-foreground">{method.activeDays}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Legend */}
        <div className="px-4 py-3 border-t border-border/30 bg-muted/20">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-500"></span> Excelente (80+)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-500"></span> Bom (60-79)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-yellow-500"></span> Regular (40-59)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-orange-500"></span> Atenção (20-39)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-500"></span> Crítico (0-19)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
