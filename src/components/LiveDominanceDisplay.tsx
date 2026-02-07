import { DominanceResult, MomentumTrend } from '@/hooks/useDominanceAnalysis';
import { LdiSnapshot } from '@/hooks/useLdiHistory';
import { NormalizedStats } from '@/hooks/useFixtureCache';
import { LdiSparkline } from '@/components/LdiSparkline';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Info, Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LiveDominanceDisplayProps {
  result: DominanceResult;
  homeTeam: string;
  awayTeam: string;
  ldiHistory?: LdiSnapshot[];
  normalizedStats?: NormalizedStats;
}

function calcTrend(history: LdiSnapshot[]): { home: MomentumTrend; away: MomentumTrend } {
  if (history.length < 3) return { home: 'stable', away: 'stable' };
  
  const recent = history.slice(-5);
  const first = recent[0].ldi;
  const last = recent[recent.length - 1].ldi;
  const diff = last - first;
  
  // Home LDI = dominanceIndex, so rising LDI = home rising
  const homeTrend: MomentumTrend = diff > 5 ? 'rising' : diff < -5 ? 'falling' : 'stable';
  const awayTrend: MomentumTrend = diff < -5 ? 'rising' : diff > 5 ? 'falling' : 'stable';
  
  return { home: homeTrend, away: awayTrend };
}

function getTooltipText(ldi: number, teamName: string): { title: string; description: string } {
  if (ldi >= 60) return {
    title: `${teamName} — LDI ${ldi}/100`,
    description: `${teamName} domina o jogo. Controla posse, finaliza mais e pressiona o adversário.`,
  };
  if (ldi >= 40) return {
    title: `${teamName} — LDI ${ldi}/100`,
    description: `Jogo equilibrado para ${teamName}. Nenhum time tem domínio claro.`,
  };
  return {
    title: `${teamName} — LDI ${ldi}/100`,
    description: `${teamName} está sendo dominado. Adversário controla as ações do jogo.`,
  };
}

const TrendIcon = ({ trend }: { trend: MomentumTrend }) => {
  switch (trend) {
    case 'rising': return <TrendingUp className="h-3 w-3 text-emerald-400" />;
    case 'falling': return <TrendingDown className="h-3 w-3 text-red-400" />;
    default: return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
};

export function LiveDominanceDisplay({ result, homeTeam, awayTeam, ldiHistory = [], normalizedStats }: LiveDominanceDisplayProps) {
  const { dataStatus, dataStatusMessage, homeLdi, awayLdi, dominanceIndex } = result;

  if (dataStatus === 'no_coverage') {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/50">
        <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <span className="text-[10px] text-muted-foreground">⚠️ Dados insuficientes para análise ao vivo</span>
      </div>
    );
  }

  if (dataStatus === 'unavailable') {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/50">
        <Loader2 className="h-3 w-3 text-muted-foreground animate-spin flex-shrink-0" />
        <span className="text-[10px] text-muted-foreground">{dataStatusMessage}</span>
      </div>
    );
  }

  if (homeLdi === null || awayLdi === null || dominanceIndex === null) return null;

  const trends = calcTrend(ldiHistory);
  const homeTooltip = getTooltipText(homeLdi, homeTeam);
  const awayTooltip = getTooltipText(awayLdi, awayTeam);

  // Truncate team names
  const shortHome = homeTeam.length > 12 ? homeTeam.slice(0, 12) + '…' : homeTeam;
  const shortAway = awayTeam.length > 12 ? awayTeam.slice(0, 12) + '…' : awayTeam;
  
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-1">
        {/* Per-team LDI display */}
        <div className="flex items-center justify-between gap-2">
          {/* Home team */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <span className="text-[10px] sm:text-[11px] font-medium truncate max-w-[80px] sm:max-w-[100px]">{shortHome}</span>
                <span className={cn(
                  "text-[10px] sm:text-[11px] font-bold tabular-nums",
                  homeLdi >= 60 ? "text-emerald-400" : homeLdi < 40 ? "text-red-400" : "text-muted-foreground"
                )}>{homeLdi}</span>
                <TrendIcon trend={trends.home} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px]">
              <p className="text-[10px] font-semibold mb-0.5">{homeTooltip.title}</p>
              <p className="text-[10px] text-muted-foreground">{homeTooltip.description}</p>
              {normalizedStats && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Posse: {normalizedStats.home.possession}% | Chutes: {normalizedStats.home.shots_total} ({normalizedStats.home.shots_on} no gol)
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">Calculado a partir de posse de bola, chutes, chutes no gol e escanteios.</p>
            </TooltipContent>
          </Tooltip>

          {/* Sparkline in center */}
          {ldiHistory.length >= 2 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help flex-shrink-0">
                  <LdiSparkline data={ldiHistory} width={60} height={16} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-[10px]">Evolução do LDI</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Away team */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <TrendIcon trend={trends.away} />
                <span className={cn(
                  "text-[10px] sm:text-[11px] font-bold tabular-nums",
                  awayLdi >= 60 ? "text-emerald-400" : awayLdi < 40 ? "text-red-400" : "text-muted-foreground"
                )}>{awayLdi}</span>
                <span className="text-[10px] sm:text-[11px] font-medium truncate max-w-[80px] sm:max-w-[100px]">{shortAway}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px]">
              <p className="text-[10px] font-semibold mb-0.5">{awayTooltip.title}</p>
              <p className="text-[10px] text-muted-foreground">{awayTooltip.description}</p>
              {normalizedStats && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Posse: {normalizedStats.away.possession}% | Chutes: {normalizedStats.away.shots_total} ({normalizedStats.away.shots_on} no gol)
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">Calculado a partir de posse de bola, chutes, chutes no gol e escanteios.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Dominance bar */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-muted cursor-help">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${dominanceIndex}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 rounded-full bg-violet-500 transition-all duration-700"
                style={{ width: `${100 - dominanceIndex}%` }}
              />
              <div className="absolute inset-y-0 left-1/2 w-px bg-background/60" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px]">
            <p className="text-[10px]">Barra de dominância: verde = controle da casa, roxo = controle do visitante. Quanto maior a faixa, maior o domínio.</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
