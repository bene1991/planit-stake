import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, AlertTriangle, ShieldCheck, Percent, Target } from "lucide-react";
import { MathAnalysisData } from "@/components/PreMatchAnalysis/MathAnalysisSection";

interface Props {
  mathData: MathAnalysisData | null;
  marketOdd: number;
  stakeReference: number;
}

export function Lay0x1RiskPanel({ mathData, marketOdd, stakeReference }: Props) {
  if (!mathData) return null;

  const value = marketOdd > 0 ? (mathData.prob0x1 * marketOdd) - 1 : 0;
  const isValue = value > 0;
  const riskColor = mathData.confidence === 'Alta' ? 'text-emerald-400' : mathData.confidence === 'Média' ? 'text-amber-400' : 'text-red-400';

  return (
    <Card className="border-white/5 bg-zinc-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
      <CardHeader className="pb-2 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Análise de Risco Lay 0x1
          </CardTitle>
          <Badge variant="outline" className={`${riskColor} border-current/20 bg-current/5 text-[10px] font-black`}>
            CONFIANÇA {mathData.confidence.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Probabilidade Poisson</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-black text-white">{(mathData.prob0x1 * 100).toFixed(1)}</p>
              <span className="text-xs text-zinc-500 font-bold">%</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Odd Justa (Fair)</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-black text-white">{mathData.fairOdd0x1.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Valor Esperado (EV)</span>
            {isValue ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-black">
                <TrendingUp className="w-3 h-3 mr-1" /> +{(value * 100).toFixed(1)}%
              </Badge>
            ) : (
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] font-black">
                <TrendingDown className="w-3 h-3 mr-1" /> {(value * 100).toFixed(1)}%
              </Badge>
            )}
          </div>
          
          <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${isValue ? 'bg-emerald-500' : 'bg-red-500'}`} 
              style={{ width: `${Math.min(Math.max((value + 1) * 50, 5), 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
          {isValue ? (
            <ShieldCheck className="w-5 h-5 text-primary" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          )}
          <p className="text-[11px] font-bold text-zinc-300 leading-tight">
            {isValue 
              ? "A odd de mercado apresenta valor matemático positivo baseado na média de gols histórica." 
              : "Atenção: A odd de mercado está abaixo da odd justa calculada pelo modelo."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
