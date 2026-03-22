import React, { useState, useEffect } from 'react';
import {
  Calculator,
  AlertTriangle,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2
} from 'lucide-react';
import { useSupabaseBankroll } from '../../hooks/useSupabaseBankroll';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';

export const StakeCalculator: React.FC = () => {
  const { bankroll, calculateStakeFromCustomValue, isStakeSafe } = useSupabaseBankroll();
  const [percentage, setPercentage] = useState<number>(2);
  const [stake, setStake] = useState<number>(0);
  const [isSafe, setIsSafe] = useState<boolean>(true);

  useEffect(() => {
    const calculatedStake = calculateStakeFromCustomValue(percentage);
    setStake(calculatedStake);
    setIsSafe(isStakeSafe(calculatedStake));
  }, [percentage, bankroll.total, calculateStakeFromCustomValue, isStakeSafe]);

  const handlePercentageChange = (value: number[]) => {
    setPercentage(value[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setPercentage(val);
    }
  };

  return (
    <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-md overflow-hidden relative group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-50 group-hover:opacity-100 transition-opacity" />

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
            <Calculator className="h-5 w-5 text-indigo-400" />
            Análise de Risco
          </CardTitle>
          {isSafe ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex gap-1 items-center">
              <ShieldCheck className="h-3 w-3" />
              Seguro
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 flex gap-1 items-center">
              <AlertTriangle className="h-3 w-3" />
              Exposição Alta
            </Badge>
          )}
        </div>
        <CardDescription className="text-slate-400">
          Calcule a exposição ideal com base na sua gestão de portfólio.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="percentage" className="text-slate-300 font-medium">Porcentagem (%)</Label>
              <div className="relative">
                <Input
                  id="percentage"
                  type="number"
                  value={percentage}
                  onChange={handleInputChange}
                  className="w-24 bg-slate-800/50 border-slate-700 text-right pr-8 text-white font-mono"
                  step="0.1"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              </div>
            </div>

            <Slider
              value={[percentage]}
              onValueChange={handlePercentageChange}
              max={10}
              step={0.1}
              className="py-4"
            />

            <div className="flex justify-between text-xs text-slate-500 font-mono">
              <span>0%</span>
              <span>2.5%</span>
              <span>5%</span>
              <span>7.5%</span>
              <span>10%</span>
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl p-6 flex flex-col items-center justify-center border border-slate-800/50 relative overflow-hidden">
            <div className={`absolute top-0 right-0 p-2 ${isSafe ? 'text-emerald-500/20' : 'text-amber-500/20'}`}>
              <TrendingUp className="h-16 w-16" />
            </div>

            <span className="text-slate-500 text-sm mb-1 uppercase tracking-wider font-semibold">Sugestão de Entrada</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono text-white tracking-tighter">
                {stake.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs">
              <span className="text-slate-400">Banca Total:</span>
              <span className="font-mono text-indigo-400 font-bold">
                {bankroll.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800/50 flex gap-3 items-start">
          <div className={`mt-0.5 ${isSafe ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isSafe ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isSafe
              ? "Esta stake é considerada segura (≤ 5% da banca). Recomendado para manter longevidade."
              : "Cuidado! Esta stake ultrapassa os limites de gestão recomendados. O risco de quebra é elevado."
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
