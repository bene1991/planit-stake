import { PreMatchPanel } from "./PreMatchPanel";
import { MathAnalysisSection } from "./MathAnalysisSection";
import { Lay0x1RiskPanel } from "@/components/Lay0x1/Lay0x1RiskPanel";
import { usePreMatchAnalysis } from "@/hooks/usePreMatchAnalysis";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Shield, Loader2, BarChart3 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";
import type { MathAnalysisData } from "./MathAnalysisSection";

interface Lay0x1Data {
  awayOdd: number;
  stakeReference: number;
  scoreValue: number;
  classification: string;
}

interface Props {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  league?: string;
  time?: string;
  lay0x1Data?: Lay0x1Data;
}

// Duplicated Poisson helpers to compute MathAnalysisData for Lay0x1RiskPanel
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

export function FixtureDetailPanel({ fixtureId, homeTeam, awayTeam, homeTeamLogo, awayTeamLogo, league, time, lay0x1Data }: Props) {
  const { data, loading } = usePreMatchAnalysis(fixtureId);

  // Compute math data for Lay0x1RiskPanel
  const mathData = useMemo<MathAnalysisData | null>(() => {
    if (!data.homeLastMatches?.length || !data.awayLastMatches?.length) return null;
    const homeId = data.fixtureInfo?.homeTeamId || 0;
    const awayId = data.fixtureInfo?.awayTeamId || 0;

    const homeAsHome = data.homeLastMatches.filter(m => m.teams.home.id === homeId);
    const awayAsAway = data.awayLastMatches.filter(m => m.teams.away.id === awayId);

    const homeGoals = homeAsHome.filter(m => m.goals.home !== null).map(m => m.goals.home!).slice(0, 20);
    const awayGoals = awayAsAway.filter(m => m.goals.away !== null).map(m => m.goals.away!).slice(0, 20);

    if (homeGoals.length === 0 || awayGoals.length === 0) return null;

    const lambdaHome = homeGoals.reduce((a, b) => a + b, 0) / homeGoals.length;
    const lambdaAway = awayGoals.reduce((a, b) => a + b, 0) / awayGoals.length;
    const lambdaTotal = lambdaHome + lambdaAway;

    if (lambdaTotal === 0) return null;

    const p0 = poisson(0, lambdaTotal);
    const p1 = poisson(1, lambdaTotal);
    const p2 = poisson(2, lambdaTotal);
    const p3 = poisson(3, lambdaTotal);
    const pHomeZero = poisson(0, lambdaHome);
    const pAwayZero = poisson(0, lambdaAway);

    const prob0x1 = pHomeZero * poisson(1, lambdaAway);
    const effectiveSample = Math.min(homeGoals.length, awayGoals.length);

    return {
      lambdaHome, lambdaAway, lambdaTotal,
      prob0x1,
      fairOdd0x1: prob0x1 > 0 ? 1 / prob0x1 : 999,
      probOver15: 1 - p0 - p1,
      probOver25: 1 - p0 - p1 - p2,
      probOver35: 1 - p0 - p1 - p2 - p3,
      probBtts: (1 - pHomeZero) * (1 - pAwayZero),
      confidence: effectiveSample >= 15 ? 'Alta' as const : effectiveSample >= 10 ? 'Média' as const : 'Baixa' as const,
    };
  }, [data]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 p-4 flex-shrink-0">
        {league && (
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">{league}{time ? ` • ${time}` : ''}</p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={homeTeamLogo} alt={homeTeam} />
              <AvatarFallback className="text-[8px] bg-secondary"><Shield className="h-3 w-3" /></AvatarFallback>
            </Avatar>
            <span className="text-sm font-bold text-primary">{homeTeam}</span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">vs</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-destructive">{awayTeam}</span>
            <Avatar className="h-7 w-7">
              <AvatarImage src={awayTeamLogo} alt={awayTeam} />
              <AvatarFallback className="text-[8px] bg-secondary"><Shield className="h-3 w-3" /></AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Pre-match analysis tabs */}
          <PreMatchPanel fixtureId={fixtureId} homeTeam={homeTeam} awayTeam={awayTeam} />

          {/* Math analysis */}
          {!loading && data.homeLastMatches && data.awayLastMatches && (
            <MathAnalysisSection
              homeLastMatches={data.homeLastMatches}
              awayLastMatches={data.awayLastMatches}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              homeTeamId={data.fixtureInfo?.homeTeamId || 0}
              awayTeamId={data.fixtureInfo?.awayTeamId || 0}
            />
          )}

          {/* Lay 0x1 risk panel (only in Lay 0x1 tab) */}
          {lay0x1Data && !loading && (
            <Lay0x1RiskPanel
              mathData={mathData}
              marketOdd={lay0x1Data.awayOdd}
              stakeReference={lay0x1Data.stakeReference}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
