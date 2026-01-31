import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, Calendar, Award, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthlyStats {
  totalOperations: number;
  greens: number;
  reds: number;
  winRate: number;
  profitMoney: number;
  profitStakes: number;
  maxDrawdown: number;
  maxGreenStreak: number;
  maxRedStreak: number;
  bestDayProfit: number;
  worstDayProfit: number;
  bestMethodName: string;
  bestMethodProfit: number;
}

interface MonthlyReportCardProps {
  stats: MonthlyStats;
  monthLabel: string;
}

export function MonthlyReportCard({ stats, monthLabel }: MonthlyReportCardProps) {
  const isProfit = stats.profitMoney >= 0;
  
  return (
    <div className="space-y-4">
      {/* Header with main result */}
      <Card className={cn(
        "border-2",
        isProfit ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="text-lg font-medium">Resultado de {monthLabel}</span>
            <span className={cn(
              "text-2xl font-bold",
              isProfit ? "text-green-500" : "text-red-500"
            )}>
              {isProfit ? '+' : ''}{stats.profitMoney.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{stats.profitStakes >= 0 ? '+' : ''}{stats.profitStakes.toFixed(2)} stakes</span>
            <span>•</span>
            <span>{stats.totalOperations} operações</span>
            <span>•</span>
            <span>WR: {stats.winRate.toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Greens/Reds */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Greens / Reds</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-green-500">{stats.greens}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-xl font-bold text-red-500">{stats.reds}</span>
            </div>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Win Rate</span>
            </div>
            <div className="text-xl font-bold">
              {stats.winRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        {/* Max Drawdown */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Drawdown Máx.</span>
            </div>
            <div className="text-xl font-bold text-red-500">
              -{stats.maxDrawdown.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        {/* Best Method */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Melhor Método</span>
            </div>
            <div className="text-lg font-bold truncate">{stats.bestMethodName || '-'}</div>
            <div className="text-sm text-green-500">
              +{stats.bestMethodProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Best Day */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Melhor Dia</span>
            </div>
            <div className="text-lg font-bold text-green-500">
              +{stats.bestDayProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        {/* Worst Day */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Pior Dia</span>
            </div>
            <div className="text-lg font-bold text-red-500">
              {stats.worstDayProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        {/* Max Green Streak */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Maior Sequência Verde</span>
            </div>
            <div className="text-xl font-bold text-green-500">
              {stats.maxGreenStreak}
            </div>
          </CardContent>
        </Card>

        {/* Max Red Streak */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Maior Sequência Vermelha</span>
            </div>
            <div className="text-xl font-bold text-red-500">
              {stats.maxRedStreak}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
