import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import type { MathAnalysisData } from "@/components/PreMatchAnalysis/MathAnalysisSection";

interface Props {
  mathData: MathAnalysisData | null;
  marketOdd: number; // away_odd from scanner criteria
  stakeReference: number;
}

export function Lay0x1RiskPanel({ mathData, marketOdd, stakeReference }: Props) {
  const analysis = useMemo(() => {
    if (!mathData || mathData.prob0x1 <= 0) return null;

    const fairOdd = mathData.fairOdd0x1;
    const diff = marketOdd - fairOdd;
    const diffPercent = ((diff / fairOdd) * 100);

    let risk: 'Baixo' | 'Médio' | 'Alto';
    if (marketOdd > fairOdd * 2) risk = 'Baixo';
    else if (marketOdd < fairOdd) risk = 'Alto';
    else risk = 'Médio';

    // Lay financial simulation
    const liability = stakeReference * (marketOdd - 1);
    const profitGreen = stakeReference; // win the stake
    const lossRed = liability; // lose the liability

    return { fairOdd, diff, diffPercent, risk, liability, profitGreen, lossRed };
  }, [mathData, marketOdd, stakeReference]);

  if (!analysis) {
    return null;
  }

  const riskConfig = {
    Baixo: { color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', icon: Shield },
    Médio: { color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10', icon: AlertTriangle },
    Alto: { color: 'text-red-400 border-red-500/30 bg-red-500/10', icon: TrendingDown },
  };

  const cfg = riskConfig[analysis.risk];
  const RiskIcon = cfg.icon;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5" />
        Risco Lay 0×1
      </h4>

      {/* Risk indicator */}
      <div className={`rounded-md border p-3 ${cfg.color}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RiskIcon className="h-4 w-4" />
            <span className="text-sm font-bold">Risco {analysis.risk}</span>
          </div>
          <Badge variant="outline" className={cfg.color}>
            {mathData ? `${(mathData.prob0x1 * 100).toFixed(1)}% real` : '—'}
          </Badge>
        </div>
      </div>

      {/* Odds comparison */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted/30 rounded-md p-2 text-center">
          <p className="text-[9px] text-muted-foreground">Odd Mercado</p>
          <p className="text-sm font-bold font-mono">{marketOdd.toFixed(2)}</p>
        </div>
        <div className="bg-muted/30 rounded-md p-2 text-center">
          <p className="text-[9px] text-muted-foreground">Odd Justa</p>
          <p className="text-sm font-bold font-mono">
            {analysis.fairOdd > 99 ? '99+' : analysis.fairOdd.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Diff */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-muted-foreground">Diferença</span>
        <span className={`font-mono font-semibold ${analysis.diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {analysis.diff > 0 ? '+' : ''}{analysis.diff.toFixed(2)} ({analysis.diffPercent.toFixed(0)}%)
        </span>
      </div>

      {/* Financial simulation */}
      <div className="rounded-md border border-border/30 overflow-hidden">
        <div className="bg-muted/20 px-3 py-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Simulação (Stake R$ {stakeReference.toFixed(2)})
          </span>
        </div>
        <div className="divide-y divide-border/20">
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-emerald-400" /> Green
            </span>
            <span className="font-mono font-bold text-emerald-400">
              +R$ {analysis.profitGreen.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingDown className="h-3 w-3 text-red-400" /> Red (responsabilidade)
            </span>
            <span className="font-mono font-bold text-red-400">
              -R$ {analysis.lossRed.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
