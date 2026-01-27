import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdvancedMetricsCardsProps {
  maxRunUp: number;
  maxDrawdown: number;
  recoveryRate: number;
  ruinCoefficient: number;
  maxProfit: number;
  maxLoss: number;
  stakeValueReais?: number;
}

export function AdvancedMetricsCards({
  maxRunUp,
  maxDrawdown,
  recoveryRate,
  ruinCoefficient,
  maxProfit,
  maxLoss,
  stakeValueReais = 100,
}: AdvancedMetricsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getRecoveryRateColor = () => {
    if (recoveryRate >= 1.5) return "text-emerald-500";
    if (recoveryRate >= 1) return "text-blue-500";
    if (recoveryRate >= 0.5) return "text-yellow-500";
    return "text-red-500";
  };

  const getRecoveryRateLabel = () => {
    if (recoveryRate >= 1.5) return "Excelente";
    if (recoveryRate >= 1) return "Bom";
    if (recoveryRate >= 0.5) return "Regular";
    return "Atenção";
  };

  const getRuinRiskLevel = () => {
    if (ruinCoefficient < 0.1) return { label: "Baixo", color: "text-emerald-500", progress: 20 };
    if (ruinCoefficient < 0.25) return { label: "Moderado", color: "text-yellow-500", progress: 50 };
    if (ruinCoefficient < 0.5) return { label: "Alto", color: "text-orange-500", progress: 75 };
    return { label: "Crítico", color: "text-red-500", progress: 100 };
  };

  const ruinRisk = getRuinRiskLevel();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Run-up Máximo */}
      <Card className="p-4 bg-card border border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Run-up Máximo
          </span>
        </div>
        <p className="text-2xl font-bold text-emerald-500">
          {formatCurrency(maxRunUp)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Maior sequência positiva
        </p>
      </Card>

      {/* Drawdown Máximo */}
      <Card className="p-4 bg-card border border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="h-4 w-4 text-red-500" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Drawdown Máximo
          </span>
        </div>
        <p className="text-2xl font-bold text-red-500">
          {formatCurrency(maxDrawdown)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Maior queda acumulada
        </p>
      </Card>

      {/* Taxa de Recuperação */}
      <Card className="p-4 bg-card border border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Taxa Recuperação
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className={cn("text-2xl font-bold", getRecoveryRateColor())}>
            {recoveryRate.toFixed(2)}
          </p>
          <span className={cn("text-sm font-medium", getRecoveryRateColor())}>
            {getRecoveryRateLabel()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Lucro / Prejuízo total
        </p>
      </Card>

      {/* Coeficiente de Ruína */}
      <Card className="p-4 bg-card border border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Risco de Ruína
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <p className={cn("text-2xl font-bold", ruinRisk.color)}>
            {(ruinCoefficient * 100).toFixed(1)}%
          </p>
          <span className={cn("text-sm font-medium", ruinRisk.color)}>
            {ruinRisk.label}
          </span>
        </div>
        <Progress 
          value={ruinRisk.progress} 
          className="h-1.5"
        />
      </Card>

      {/* Maior Lucro Individual */}
      <Card className="p-4 bg-card border border-border/30 col-span-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Maior Lucro
          </span>
        </div>
        <p className="text-xl font-bold text-emerald-500">
          {formatCurrency(maxProfit)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {(maxProfit / stakeValueReais).toFixed(2)} stakes
        </p>
      </Card>

      {/* Maior Prejuízo Individual */}
      <Card className="p-4 bg-card border border-border/30 col-span-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Maior Prejuízo
          </span>
        </div>
        <p className="text-xl font-bold text-red-500">
          -{formatCurrency(maxLoss)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {(maxLoss / stakeValueReais).toFixed(2)} stakes
        </p>
      </Card>
    </div>
  );
}
