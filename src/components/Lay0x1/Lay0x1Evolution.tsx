import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLay0x1Weights } from '@/hooks/useLay0x1Weights';
import { useLay0x1BlockedLeagues } from '@/hooks/useLay0x1BlockedLeagues';
import { RotateCcw, Brain, TrendingUp, TrendingDown, Minus, Ban, X } from 'lucide-react';
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

const THRESHOLD_CONFIG: { key: string; label: string; suffix: string; defaultValue: number }[] = [
  { key: 'min_home_goals_avg', label: 'Mín. gols mandante', suffix: '', defaultValue: 1.5 },
  { key: 'min_away_conceded_avg', label: 'Mín. gols sofridos', suffix: '', defaultValue: 1.5 },
  { key: 'min_over15_combined', label: 'Mín. Over 1.5', suffix: '%', defaultValue: 70 },
  { key: 'max_h2h_0x1', label: 'Máx. H2H 0x1', suffix: '', defaultValue: 0 },
];

export const Lay0x1Evolution = () => {
  const { weights, resetWeights } = useLay0x1Weights();
  const { blockedLeagues, unblockLeague } = useLay0x1BlockedLeagues();

  const weightKeys = Object.keys(WEIGHT_LABELS) as (keyof typeof WEIGHT_LABELS)[];
  const totalWeight = weightKeys.reduce((sum, k) => sum + ((weights as any)[k] || 0), 0);

  const handleReset = async () => {
    await resetWeights();
    toast.success('Pesos resetados para valores padrão');
  };

  const getThresholdDelta = (key: string, defaultValue: number) => {
    const current = (weights as any)[key] ?? defaultValue;
    const diff = current - defaultValue;
    if (Math.abs(diff) < 0.05) return null;
    return diff;
  };

  return (
    <div className="space-y-4">
      {/* Weights */}
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
                  <div className={`h-full rounded-full transition-all ${WEIGHT_COLORS[key]}`}
                    style={{ width: `${(value / 30) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Thresholds */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">Thresholds Adaptativos (IA)</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ajustados automaticamente pela IA a cada recalibração
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {THRESHOLD_CONFIG.map(({ key, label, suffix, defaultValue }) => {
              const value = (weights as any)[key] ?? defaultValue;
              const delta = getThresholdDelta(key, defaultValue);
              return (
                <div key={key} className="bg-muted/30 rounded-lg p-3 relative">
                  <p className="text-muted-foreground">{label}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-lg font-bold">{value}{suffix}</p>
                    {delta !== null && (
                      <span className={`flex items-center text-[10px] font-medium ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                      </span>
                    )}
                    {delta === null && (
                      <span className="flex items-center text-[10px] text-muted-foreground">
                        <Minus className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 bg-muted/20 rounded-lg p-3 border border-dashed border-muted-foreground/20">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Máx. odd visitante (fixo)</span>
              <span className="font-bold">{weights.max_away_odd}</span>
            </div>
          </div>

          <div className="mt-3 text-xs text-muted-foreground text-center">
            Ciclo de calibração: #{weights.cycle_count}
            {weights.last_calibration_at && ` • Última: ${new Date(weights.last_calibration_at).toLocaleDateString('pt-BR')}`}
          </div>
        </CardContent>
      </Card>

      {/* Blocked Leagues */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-400" />
            <CardTitle className="text-sm">Ligas Bloqueadas</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ligas removidas das análises do scanner
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {blockedLeagues.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma liga bloqueada. Use o Dashboard ou jogos pendentes para bloquear ligas indesejadas.
            </p>
          ) : (
            <div className="space-y-2">
              {blockedLeagues.map(bl => (
                <div key={bl.league_name} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-xs font-medium">{bl.league_name}</p>
                    <Badge variant="outline" className="text-[10px] mt-0.5">
                      {bl.reason === 'performance_ruim' ? 'Performance ruim' : 'Não disponível'}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                    onClick={() => unblockLeague(bl.league_name)}>
                    <X className="w-3 h-3" /> Desbloquear
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
