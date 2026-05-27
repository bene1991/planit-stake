import { cn } from "@/lib/utils";
import { Flame, Shield, TrendingUp, Zap } from "lucide-react";

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

const pct = (s?: string) => {
  const n = parseInt(s || '0');
  return isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
};

const num = (s?: string) => {
  const n = parseFloat(s || '0');
  return isNaN(n) ? 0 : n;
};

// Normaliza gols esperados (0 → 0, 3+ → 100)
const goalsToScore = (xg: number) => Math.max(0, Math.min(100, (Math.abs(xg) / 3) * 100));

function translateAdvice(advice: string) {
  if (!advice) return advice;
  if (advice.toLowerCase().includes('no predictions available')) return 'Nenhuma predição disponível';
  return advice
    .replace(/Combo Winner :/gi, 'Vencedor Combinado :')
    .replace(/Winner :/gi, 'Vencedor :')
    .replace(/Double chance :/gi, 'Dupla chance :')
    .replace(/\bor\b/gi, 'ou')
    .replace(/\bDraw\b/gi, 'Empate');
}

function classify(score: number): { label: string; tone: 'low' | 'mid' | 'high' | 'extreme' } {
  if (score >= 75) return { label: 'Muito alto', tone: 'extreme' };
  if (score >= 55) return { label: 'Alto', tone: 'high' };
  if (score >= 35) return { label: 'Médio', tone: 'mid' };
  return { label: 'Baixo', tone: 'low' };
}

function classifyFragility(score: number): { label: string; tone: 'low' | 'mid' | 'high' | 'extreme' } {
  if (score >= 75) return { label: 'Muito frágil', tone: 'extreme' };
  if (score >= 55) return { label: 'Frágil', tone: 'high' };
  if (score >= 35) return { label: 'Regular', tone: 'mid' };
  return { label: 'Sólida', tone: 'low' };
}

const toneColor = (tone: 'low' | 'mid' | 'high' | 'extreme') => ({
  low: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
  mid: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/5',
  extreme: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
}[tone]);

const toneFill = (tone: 'low' | 'mid' | 'high' | 'extreme') => ({
  low: 'bg-emerald-400',
  mid: 'bg-amber-400',
  high: 'bg-orange-400',
  extreme: 'bg-rose-400',
}[tone]);

interface TeamScores {
  goalPotential: number;
  defensiveFragility: number;
  expectedGoals: number; // gols que o time deve marcar
  expectedConceded: number; // gols que o time deve sofrer
}

function computeScores(
  comparison: Record<string, { home: string; away: string }> | undefined,
  predictions: Prediction['predictions']
): { home: TeamScores; away: TeamScores; totalExpected: number } {
  const c = comparison || {};
  const homeAtt = pct(c.att?.home);
  const awayAtt = pct(c.att?.away);
  const homeDef = pct(c.def?.home);
  const awayDef = pct(c.def?.away);
  const homeGoals = pct(c.goals?.home);
  const awayGoals = pct(c.goals?.away);
  const homePoisson = pct(c.poisson_distribution?.home);
  const awayPoisson = pct(c.poisson_distribution?.away);

  const homeXG = num(predictions.goals?.home);
  const awayXG = num(predictions.goals?.away);

  // Potencial de gols do TIME: ataque + finalização (goals%) + poisson + xG própria
  const homeGoalPotential = (homeAtt * 0.3 + homeGoals * 0.3 + homePoisson * 0.2 + goalsToScore(homeXG) * 0.2);
  const awayGoalPotential = (awayAtt * 0.3 + awayGoals * 0.3 + awayPoisson * 0.2 + goalsToScore(awayXG) * 0.2);

  // Fragilidade defensiva do TIME = 100 − defesa, ajustada pelo ataque do adversário
  const homeFragility = ((100 - homeDef) * 0.6 + awayAtt * 0.25 + goalsToScore(awayXG) * 0.15);
  const awayFragility = ((100 - awayDef) * 0.6 + homeAtt * 0.25 + goalsToScore(homeXG) * 0.15);

  return {
    home: { goalPotential: homeGoalPotential, defensiveFragility: homeFragility, expectedGoals: Math.abs(homeXG), expectedConceded: Math.abs(awayXG) },
    away: { goalPotential: awayGoalPotential, defensiveFragility: awayFragility, expectedGoals: Math.abs(awayXG), expectedConceded: Math.abs(homeXG) },
    totalExpected: Math.abs(homeXG) + Math.abs(awayXG),
  };
}

function Indicator({
  icon: Icon, title, score, sub, tone,
}: { icon: any; title: string; score: number; sub: string; tone: 'low' | 'mid' | 'high' | 'extreme' }) {
  return (
    <div className={cn('rounded-lg border p-3', toneColor(tone))}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-80">
        <Icon className="w-3 h-3" /> {title}
      </div>
      <div className="flex items-end justify-between mt-1.5">
        <span className="text-3xl font-extrabold leading-none">{Math.round(score)}</span>
        <span className="text-[11px] font-semibold opacity-80">{sub}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-black/30 overflow-hidden">
        <div className={cn('h-full rounded-full', toneFill(tone))} style={{ width: `${Math.round(score)}%` }} />
      </div>
    </div>
  );
}

export function PredictionsSection({ prediction, homeTeam, awayTeam }: Props) {
  if (!prediction) return <p className="text-muted-foreground text-sm text-center py-4">Predições indisponíveis</p>;

  const { predictions, comparison } = prediction;
  const scores = computeScores(comparison, predictions);
  const advice = predictions.advice ? translateAdvice(predictions.advice) : null;

  const homeGP = classify(scores.home.goalPotential);
  const awayGP = classify(scores.away.goalPotential);
  const homeDF = classifyFragility(scores.home.defensiveFragility);
  const awayDF = classifyFragility(scores.away.defensiveFragility);

  const totalTone: 'low' | 'mid' | 'high' | 'extreme' =
    scores.totalExpected >= 3.5 ? 'extreme' : scores.totalExpected >= 2.5 ? 'high' : scores.totalExpected >= 1.8 ? 'mid' : 'low';
  const totalLabel = scores.totalExpected >= 2.5 ? 'Jogo aberto' : scores.totalExpected >= 1.8 ? 'Equilibrado' : 'Travado';

  return (
    <div className="space-y-4">
      {advice && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
          <span className="text-xs font-semibold text-primary">{advice}</span>
        </div>
      )}

      {/* Win percentages */}
      <div className="flex items-center justify-around text-center py-3 bg-muted/30 rounded-lg">
        <div>
          <div className="text-xl font-bold text-primary">{predictions.percent.home}</div>
          <div className="text-[10px] text-muted-foreground">{homeTeam}</div>
        </div>
        <div>
          <div className="text-xl font-bold text-yellow-400">{predictions.percent.draw}</div>
          <div className="text-[10px] text-muted-foreground">Empate</div>
        </div>
        <div>
          <div className="text-xl font-bold text-destructive">{predictions.percent.away}</div>
          <div className="text-[10px] text-muted-foreground">{awayTeam}</div>
        </div>
      </div>

      {/* Tendência do jogo (linha resumo) */}
      <div className={cn('rounded-lg border p-3 flex items-center justify-between', toneColor(totalTone))}>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">Tendência do jogo</p>
            <p className="text-sm font-bold">{totalLabel}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] opacity-80">Gols esperados</p>
          <p className="text-xl font-extrabold leading-none">{scores.totalExpected.toFixed(1)}</p>
        </div>
      </div>

      {/* Indicadores por time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-xs font-bold text-primary text-center truncate">{homeTeam}</p>
          <Indicator icon={Flame} title="Potencial de gols" score={scores.home.goalPotential}
            sub={`${homeGP.label} · ${scores.home.expectedGoals.toFixed(1)} xG`} tone={homeGP.tone} />
          <Indicator icon={Shield} title="Fragilidade defensiva" score={scores.home.defensiveFragility}
            sub={`${homeDF.label} · sofre ${scores.home.expectedConceded.toFixed(1)}`} tone={homeDF.tone} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-destructive text-center truncate">{awayTeam}</p>
          <Indicator icon={Flame} title="Potencial de gols" score={scores.away.goalPotential}
            sub={`${awayGP.label} · ${scores.away.expectedGoals.toFixed(1)} xG`} tone={awayGP.tone} />
          <Indicator icon={Shield} title="Fragilidade defensiva" score={scores.away.defensiveFragility}
            sub={`${awayDF.label} · sofre ${scores.away.expectedConceded.toFixed(1)}`} tone={awayDF.tone} />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center opacity-70">
        <Zap className="inline w-3 h-3 mr-1 -mt-0.5" />
        Índices 0-100 calculados via ataque, finalização, distribuição Poisson e gols esperados
      </p>
    </div>
  );
}
