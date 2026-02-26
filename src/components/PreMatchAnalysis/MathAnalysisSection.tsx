import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, BarChart3, AlertTriangle } from "lucide-react";

interface H2HFixture {
  fixture: { id: number; date: string };
  league: { name: string; logo: string };
  teams: { home: { id: number; name: string; logo: string; winner: boolean | null }; away: { id: number; name: string; logo: string; winner: boolean | null } };
  goals: { home: number | null; away: number | null };
}

interface Props {
  homeLastMatches: H2HFixture[] | null;
  awayLastMatches: H2HFixture[] | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function computeLambdas(
  homeMatches: H2HFixture[],
  awayMatches: H2HFixture[],
  homeTeamId: number,
  awayTeamId: number
) {
  // Filter home team's HOME matches and get goals scored
  const homeAsHome = homeMatches.filter(m => m.teams.home.id === homeTeamId);
  const homeGoals = homeAsHome
    .filter(m => m.goals.home !== null)
    .map(m => m.goals.home!);

  // Filter away team's AWAY matches and get goals scored
  const awayAsAway = awayMatches.filter(m => m.teams.away.id === awayTeamId);
  const awayGoals = awayAsAway
    .filter(m => m.goals.away !== null)
    .map(m => m.goals.away!);

  // Try 20, fallback to 15, then 10
  let sampleSize = 20;
  let homeSlice = homeGoals.slice(0, 20);
  let awaySlice = awayGoals.slice(0, 20);

  if (homeSlice.length < 15 || awaySlice.length < 15) {
    sampleSize = Math.min(homeSlice.length, awaySlice.length);
  }
  
  const effectiveHome = homeSlice.length;
  const effectiveAway = awaySlice.length;
  const effectiveSample = Math.min(effectiveHome, effectiveAway);

  let confidence: 'Alta' | 'Média' | 'Baixa' = 'Baixa';
  if (effectiveSample >= 15) confidence = 'Alta';
  else if (effectiveSample >= 10) confidence = 'Média';

  const lambdaHome = homeSlice.length > 0
    ? homeSlice.reduce((a, b) => a + b, 0) / homeSlice.length
    : 0;
  const lambdaAway = awaySlice.length > 0
    ? awaySlice.reduce((a, b) => a + b, 0) / awaySlice.length
    : 0;
  const lambdaTotal = lambdaHome + lambdaAway;

  return { lambdaHome, lambdaAway, lambdaTotal, confidence, effectiveHome, effectiveAway };
}

export interface MathAnalysisData {
  lambdaHome: number;
  lambdaAway: number;
  lambdaTotal: number;
  prob0x1: number;
  fairOdd0x1: number;
  probOver15: number;
  probOver25: number;
  probOver35: number;
  probBtts: number;
  confidence: 'Alta' | 'Média' | 'Baixa';
}

export function MathAnalysisSection({ homeLastMatches, awayLastMatches, homeTeam, awayTeam, homeTeamId, awayTeamId }: Props) {
  const analysis = useMemo<MathAnalysisData | null>(() => {
    if (!homeLastMatches?.length || !awayLastMatches?.length) return null;

    const { lambdaHome, lambdaAway, lambdaTotal, confidence } = computeLambdas(
      homeLastMatches, awayLastMatches, homeTeamId, awayTeamId
    );

    if (lambdaTotal === 0) return null;

    // Over probabilities using total lambda
    const p0 = poisson(0, lambdaTotal);
    const p1 = poisson(1, lambdaTotal);
    const p2 = poisson(2, lambdaTotal);
    const p3 = poisson(3, lambdaTotal);

    const probOver15 = 1 - p0 - p1;
    const probOver25 = 1 - p0 - p1 - p2;
    const probOver35 = 1 - p0 - p1 - p2 - p3;

    // BTTS
    const pHomeZero = poisson(0, lambdaHome);
    const pAwayZero = poisson(0, lambdaAway);
    const probBtts = (1 - pHomeZero) * (1 - pAwayZero);

    // P(0x1) = P(home=0) * P(away=1)
    const prob0x1 = pHomeZero * poisson(1, lambdaAway);
    const fairOdd0x1 = prob0x1 > 0 ? 1 / prob0x1 : 999;

    return {
      lambdaHome, lambdaAway, lambdaTotal,
      prob0x1, fairOdd0x1,
      probOver15, probOver25, probOver35,
      probBtts, confidence,
    };
  }, [homeLastMatches, awayLastMatches, homeTeamId, awayTeamId]);

  if (!analysis) {
    return (
      <div className="text-center py-4 text-xs text-muted-foreground">
        Dados insuficientes para análise matemática
      </div>
    );
  }

  const confidenceColor = {
    Alta: 'text-emerald-400 border-emerald-500/30',
    Média: 'text-yellow-400 border-yellow-500/30',
    Baixa: 'text-red-400 border-red-500/30',
  };

  const rows = [
    { label: 'Over 1.5', prob: analysis.probOver15, fairOdd: 1 / analysis.probOver15 },
    { label: 'Over 2.5', prob: analysis.probOver25, fairOdd: 1 / analysis.probOver25 },
    { label: 'Over 3.5', prob: analysis.probOver35, fairOdd: 1 / analysis.probOver35 },
    { label: 'BTTS', prob: analysis.probBtts, fairOdd: 1 / analysis.probBtts },
    { label: '0×1', prob: analysis.prob0x1, fairOdd: analysis.fairOdd0x1 },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" />
          Análise Matemática (Poisson)
        </h4>
        <Badge variant="outline" className={`text-[10px] ${confidenceColor[analysis.confidence]}`}>
          {analysis.confidence === 'Alta' ? '📊' : analysis.confidence === 'Média' ? '⚠️' : '❗'} {analysis.confidence}
        </Badge>
      </div>

      {/* Lambdas */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/30 rounded-md p-2 text-center">
          <p className="text-[9px] text-muted-foreground">λ Casa</p>
          <p className="text-sm font-bold font-mono text-primary">{analysis.lambdaHome.toFixed(2)}</p>
          <p className="text-[9px] text-muted-foreground truncate">{homeTeam}</p>
        </div>
        <div className="bg-muted/30 rounded-md p-2 text-center">
          <p className="text-[9px] text-muted-foreground">λ Fora</p>
          <p className="text-sm font-bold font-mono text-destructive">{analysis.lambdaAway.toFixed(2)}</p>
          <p className="text-[9px] text-muted-foreground truncate">{awayTeam}</p>
        </div>
        <div className="bg-muted/30 rounded-md p-2 text-center">
          <p className="text-[9px] text-muted-foreground">λ Total</p>
          <p className="text-sm font-bold font-mono">{analysis.lambdaTotal.toFixed(2)}</p>
          <p className="text-[9px] text-muted-foreground">Esperado</p>
        </div>
      </div>

      {/* Probabilities table */}
      <div className="rounded-md border border-border/30 overflow-hidden">
        <div className="bg-muted/20 px-3 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Mercado</span>
          <div className="flex gap-8">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Prob.</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Odd Justa</span>
          </div>
        </div>
        <div className="divide-y divide-border/20">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="font-medium">{row.label}</span>
              <div className="flex gap-6">
                <span className={`font-mono font-semibold w-14 text-right ${row.prob >= 0.6 ? 'text-emerald-400' : row.prob >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {(row.prob * 100).toFixed(1)}%
                </span>
                <span className="font-mono font-semibold w-12 text-right text-muted-foreground">
                  {row.fairOdd > 99 ? '99+' : row.fairOdd.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
