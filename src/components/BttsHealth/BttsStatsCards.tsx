import { Card, CardContent } from '@/components/ui/card';
import { BttsMetrics } from '@/types/btts';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Wallet, Target, BarChart3, Activity, Flame } from 'lucide-react';

interface BttsStatsCardsProps {
  metrics: BttsMetrics;
  stakeValue: number;
}

export function BttsStatsCards({ metrics, stakeValue }: BttsStatsCardsProps) {
  const stats = [
    {
      label: 'Lucro R$',
      value: `R$ ${metrics.profitReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: metrics.profitReais >= 0 ? TrendingUp : TrendingDown,
      positive: metrics.profitReais >= 0,
    },
    {
      label: 'Lucro Stakes',
      value: `${metrics.profitStakes >= 0 ? '+' : ''}${metrics.profitStakes.toFixed(2)}`,
      icon: Target,
      positive: metrics.profitStakes >= 0,
    },
    {
      label: 'Banca Atual',
      value: `R$ ${metrics.bankrollCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      icon: Wallet,
      subtitle: `Pico: R$ ${metrics.bankrollPeak.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
    },
    {
      label: 'Drawdown',
      value: `-${metrics.drawdownPercent.toFixed(1)}%`,
      icon: Activity,
      warning: metrics.drawdownPercent >= 8,
      danger: metrics.drawdownPercent >= 12,
    },
    {
      label: 'WR 30',
      value: `${metrics.winRate30.toFixed(1)}%`,
      icon: BarChart3,
      positive: metrics.winRate30 >= 50,
    },
    {
      label: 'WR 100',
      value: `${metrics.winRate100.toFixed(1)}%`,
      icon: BarChart3,
      positive: metrics.winRate100 >= 48,
    },
    {
      label: 'WR 200',
      value: `${metrics.winRate200.toFixed(1)}%`,
      icon: BarChart3,
      positive: metrics.winRate200 >= 48,
      warning: metrics.winRate200 > 0 && metrics.winRate200 < 48,
    },
    {
      label: 'Odd Média',
      value: metrics.oddAvg100.toFixed(2),
      icon: Target,
      warning: metrics.oddAvg100 > 0 && (metrics.oddAvg100 < 2.10 || metrics.oddAvg100 > 2.40),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card 
          key={stat.label} 
          className={cn(
            "border-border/50 bg-card/50 backdrop-blur-sm transition-colors",
            stat.danger && "border-destructive/50 bg-destructive/5",
            stat.warning && !stat.danger && "border-yellow-500/50 bg-yellow-500/5"
          )}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </span>
              <stat.icon className={cn(
                "h-3.5 w-3.5",
                stat.positive && "text-green-500",
                stat.positive === false && "text-red-500",
                stat.warning && "text-yellow-500",
                stat.danger && "text-destructive"
              )} />
            </div>
            <p className={cn(
              "text-lg font-semibold",
              stat.positive && "text-green-500",
              stat.positive === false && "text-red-500",
              stat.danger && "text-destructive"
            )}>
              {stat.value}
            </p>
            {stat.subtitle && (
              <p className="text-[10px] text-muted-foreground">{stat.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function BttsStreakCard({ metrics }: { metrics: BttsMetrics }) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium">Sequências</span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Atual</p>
            <p className={cn(
              "text-lg font-semibold",
              metrics.currentStreak.type === 'Green' && "text-green-500",
              metrics.currentStreak.type === 'Red' && "text-red-500"
            )}>
              {metrics.currentStreak.count > 0 
                ? `${metrics.currentStreak.count} ${metrics.currentStreak.type}s`
                : '-'
              }
            </p>
          </div>
          
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Max Bad (30d)</p>
            <p className="text-lg font-semibold text-red-500">
              {metrics.maxBadRun30Days || '-'}
            </p>
          </div>
          
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Max Good (30d)</p>
            <p className="text-lg font-semibold text-green-500">
              {metrics.maxGoodRun30Days || '-'}
            </p>
          </div>
          
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">EV/Entrada</p>
            <p className={cn(
              "text-lg font-semibold",
              metrics.evStakes100 >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {metrics.evStakes100.toFixed(3)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
