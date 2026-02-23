import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLay0x1Weights } from '@/hooks/useLay0x1Weights';
import { Progress } from '@/components/ui/progress';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const WEIGHT_LABELS: Record<string, string> = {
  offensive_weight: 'Força Ofensiva Mandante',
  defensive_weight: 'Fragilidade Defensiva Visitante',
  over_weight: 'Tendência Over 1.5',
  league_avg_weight: 'Média de Gols da Liga',
  h2h_weight: 'Histórico H2H',
  odds_weight: 'Faixa de Odds',
};

const WEIGHT_COLORS: Record<string, string> = {
  offensive_weight: 'bg-emerald-500',
  defensive_weight: 'bg-red-500',
  over_weight: 'bg-blue-500',
  league_avg_weight: 'bg-yellow-500',
  h2h_weight: 'bg-purple-500',
  odds_weight: 'bg-orange-500',
};

export const Lay0x1Evolution = () => {
  const { weights, resetWeights, loading } = useLay0x1Weights();

  const weightKeys = Object.keys(WEIGHT_LABELS) as (keyof typeof WEIGHT_LABELS)[];
  const totalWeight = weightKeys.reduce((sum, k) => sum + ((weights as any)[k] || 0), 0);

  const handleReset = async () => {
    await resetWeights();
    toast.success('Pesos resetados para valores padrão');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Pesos Adaptativos</CardTitle>
            <Button size="sm" variant="ghost" onClick={handleReset} className="gap-1 text-xs">
              <RotateCcw className="w-3 h-3" /> Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {weightKeys.map(key => {
            const value = (weights as any)[key] || 0;
            const pct = totalWeight > 0 ? (value / totalWeight) * 100 : 0;
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{WEIGHT_LABELS[key]}</span>
                  <span className="font-medium">{value.toFixed(1)} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${WEIGHT_COLORS[key]}`}
                    style={{ width: `${(value / 30) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Thresholds Atuais</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-muted-foreground">Mín. gols mandante</p>
              <p className="text-lg font-bold">{weights.min_home_goals_avg}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-muted-foreground">Mín. gols sofridos</p>
              <p className="text-lg font-bold">{weights.min_away_conceded_avg}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-muted-foreground">Máx. odd visitante</p>
              <p className="text-lg font-bold">{weights.max_away_odd}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-muted-foreground">Mín. Over 1.5</p>
              <p className="text-lg font-bold">{weights.min_over15_combined}%</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground text-center">
            Ciclo de calibração: #{weights.cycle_count}
            {weights.last_calibration_at && ` • Última: ${new Date(weights.last_calibration_at).toLocaleDateString('pt-BR')}`}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
