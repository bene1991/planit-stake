import { cn } from "@/lib/utils";

interface Prediction {
  predictions: {
    winner: { id: number; name: string; comment: string } | null;
    win_or_draw: boolean;
    under_over: string | null;
    goals: { home: string; away: string };
    advice: string | null;
    percent: { home: string; draw: string; away: string };
  };
  comparison: Record<string, { home: string; away: string }>;
}

interface Props {
  prediction: Prediction | null;
  homeTeam: string;
  awayTeam: string;
}

function PercentBar({ label, homePercent, awayPercent }: { label: string; homePercent: string; awayPercent: string }) {
  const h = parseInt(homePercent) || 0;
  const a = parseInt(awayPercent) || 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{homePercent}</span>
        <span>{label}</span>
        <span className="font-medium text-foreground">{awayPercent}</span>
      </div>
      <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden bg-muted">
        <div className="bg-primary/70 rounded-l-full" style={{ width: `${h}%` }} />
        <div className="bg-destructive/70 rounded-r-full" style={{ width: `${a}%` }} />
      </div>
    </div>
  );
}

const comparisonLabels: Record<string, string> = {
  form: 'Forma',
  att: 'Ataque',
  def: 'Defesa',
  poisson_distribution: 'Distribuição Poisson',
  h2h: 'Confronto Direto',
  goals: 'Gols',
  total: 'Total',
};

export function PredictionsSection({ prediction, homeTeam, awayTeam }: Props) {
  if (!prediction) return <p className="text-muted-foreground text-sm text-center py-4">Predições indisponíveis</p>;

  const { predictions, comparison } = prediction;

  // Fix negative/invalid goal values - ensure they show as positive numbers
  const formatGoals = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) return '0';
    return val;
  };

  return (
    <div className="space-y-4">
      {/* Advice */}
      {predictions.advice && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
          <span className="text-xs font-semibold text-primary">{predictions.advice}</span>
        </div>
      )}

      {/* Win percentages */}
      <div className="space-y-3">
        <div className="flex justify-between text-xs font-semibold text-muted-foreground">
          <span className="text-primary">{homeTeam}</span>
          <span className="text-destructive">{awayTeam}</span>
        </div>

        <div className="flex items-center justify-around text-center py-3 bg-muted/30 rounded-lg">
          <div>
            <div className="text-xl font-bold text-primary">{predictions.percent.home}</div>
            <div className="text-[10px] text-muted-foreground">Vitória</div>
          </div>
          <div>
            <div className="text-xl font-bold text-yellow-400">{predictions.percent.draw}</div>
            <div className="text-[10px] text-muted-foreground">Empate</div>
          </div>
          <div>
            <div className="text-xl font-bold text-destructive">{predictions.percent.away}</div>
            <div className="text-[10px] text-muted-foreground">Vitória</div>
          </div>
        </div>

        {/* Goals prediction */}
        <div className="flex justify-center gap-6 text-xs">
          <div className="text-center">
            <span className="text-muted-foreground">Gols esperados:</span>
            <span className="ml-1 font-semibold text-foreground">{formatGoals(predictions.goals.home)} - {formatGoals(predictions.goals.away)}</span>
          </div>
          {predictions.under_over && (
            <div className="text-center">
              <span className="text-muted-foreground">Acima/Abaixo:</span>
              <span className="ml-1 font-semibold text-foreground">{predictions.under_over}</span>
            </div>
          )}
        </div>
      </div>

      {/* Comparison bars */}
      {comparison && Object.keys(comparison).length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/20">
          <h4 className="text-xs font-semibold text-muted-foreground text-center">Comparação</h4>
          {Object.entries(comparison).map(([key, val]) => (
            <PercentBar key={key} label={comparisonLabels[key] || key.replace(/_/g, ' ')} homePercent={val.home} awayPercent={val.away} />
          ))}
        </div>
      )}
    </div>
  );
}
