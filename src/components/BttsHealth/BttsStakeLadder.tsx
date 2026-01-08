import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BttsMetrics, StakeLadderCondition } from '@/types/btts';
import { cn } from '@/lib/utils';
import { TrendingUp, Check, X, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

interface BttsStakeLadderProps {
  metrics: BttsMetrics;
  bankrollCurrent: number;
  onStakeIncrease?: (amount: number) => void;
}

export function BttsStakeLadder({ metrics, bankrollCurrent, onStakeIncrease }: BttsStakeLadderProps) {
  const conditions: StakeLadderCondition[] = [
    {
      label: 'Profit 30 dias >= +10 stakes',
      required: '>= +10',
      current: `${metrics.profitStakes30Days >= 0 ? '+' : ''}${metrics.profitStakes30Days.toFixed(2)}`,
      met: metrics.profitStakes30Days >= 10,
    },
    {
      label: 'Win Rate 200 >= 50%',
      required: '>= 50%',
      current: `${metrics.winRate200.toFixed(1)}%`,
      met: metrics.winRate200 >= 50,
    },
    {
      label: 'Odd Média 100 entre 2.10 e 2.40',
      required: '2.10 - 2.40',
      current: metrics.oddAvg100.toFixed(2),
      met: metrics.oddAvg100 >= 2.10 && metrics.oddAvg100 <= 2.40,
    },
    {
      label: 'Max Bad Run 30 dias <= 10',
      required: '<= 10',
      current: String(metrics.maxBadRun30Days),
      met: metrics.maxBadRun30Days <= 10,
    },
    {
      label: 'Drawdown 30 dias <= 8 stakes',
      required: '<= 8',
      current: metrics.drawdownStakes.toFixed(2),
      met: metrics.drawdownStakes <= 8,
    },
  ];

  const allConditionsMet = conditions.every(c => c.met);
  const metCount = conditions.filter(c => c.met).length;

  // Suggested increment based on bankroll
  const suggestedIncrement = bankrollCurrent < 10000 ? 10 : bankrollCurrent <= 30000 ? 25 : 50;

  const handleStakeIncrease = () => {
    if (!allConditionsMet) return;
    
    if (onStakeIncrease) {
      onStakeIncrease(suggestedIncrement);
    }
    
    toast.success(`Stake aumentada em R$ ${suggestedIncrement}!`);
  };

  return (
    <Card className={cn(
      "border-border/50 bg-card/50 backdrop-blur-sm",
      allConditionsMet && "border-green-500/30 bg-green-500/5"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Escada de Stake
          <span className={cn(
            "text-xs font-normal px-2 py-0.5 rounded-full",
            allConditionsMet 
              ? "bg-green-500/20 text-green-500" 
              : "bg-muted text-muted-foreground"
          )}>
            {metCount}/{conditions.length} condições
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {conditions.map((condition, index) => (
          <div 
            key={index}
            className={cn(
              "flex items-center justify-between p-2 rounded-lg border",
              condition.met 
                ? "border-green-500/30 bg-green-500/5" 
                : "border-border/30 bg-muted/5"
            )}
          >
            <div className="flex items-center gap-2">
              {condition.met ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn(
                "text-sm",
                condition.met ? "text-foreground" : "text-muted-foreground"
              )}>
                {condition.label}
              </span>
            </div>
            <span className={cn(
              "text-sm font-medium",
              condition.met ? "text-green-500" : "text-muted-foreground"
            )}>
              {condition.current}
            </span>
          </div>
        ))}

        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">
              Incremento sugerido:
            </span>
            <span className="text-lg font-semibold">
              +R$ {suggestedIncrement}
            </span>
          </div>

          <Button
            onClick={handleStakeIncrease}
            disabled={!allConditionsMet}
            className={cn(
              "w-full",
              allConditionsMet 
                ? "bg-green-600 hover:bg-green-700" 
                : ""
            )}
          >
            {allConditionsMet ? (
              <>
                <Unlock className="h-4 w-4 mr-2" />
                Liberar Subida
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Bloqueado
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
