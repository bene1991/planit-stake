import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NormalizedStats, MomentumPoint } from '@/hooks/useFixtureCache';
import { AttackMomentumChart } from './AttackMomentumChart';

interface MatchDetailsAccordionProps {
  stats: NormalizedStats | null;
  momentumSeries: MomentumPoint[];
  minuteNow: number;
  homeTeam: string;
  awayTeam: string;
  loading?: boolean;
}

interface StatRowProps {
  label: string;
  homeValue: number;
  awayValue: number;
}

function StatRow({ label, homeValue, awayValue }: StatRowProps) {
  const total = homeValue + awayValue;
  const homePercent = total > 0 ? (homeValue / total) * 100 : 50;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-muted-foreground text-left shrink-0">{label}</span>
      <span className="w-5 text-right font-medium shrink-0">{homeValue}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex min-w-0">
        <div 
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${homePercent}%` }}
        />
        <div 
          className="h-full bg-violet-500 transition-all duration-300"
          style={{ width: `${100 - homePercent}%` }}
        />
      </div>
      <span className="w-5 text-left font-medium shrink-0">{awayValue}</span>
    </div>
  );
}

export function MatchDetailsAccordion({ 
  stats, 
  momentumSeries, 
  minuteNow,
  homeTeam,
  awayTeam,
  loading 
}: MatchDetailsAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!stats && !loading) {
    return null;
  }

  return (
    <div className="border-t border-border/50">
      <Button
        variant="ghost"
        size="sm"
        className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <>
            <ChevronUp className="h-3 w-3 mr-1" />
            Ocultar detalhes
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3 mr-1" />
            Ver detalhes
          </>
        )}
      </Button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Detailed Stats Table */}
              {stats && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Estatísticas Detalhadas</h4>
                  <StatRow label="Chutes Gol" homeValue={stats.home.shots_on} awayValue={stats.away.shots_on} />
                  <StatRow label="Chutes Fora" homeValue={stats.home.shots_off} awayValue={stats.away.shots_off} />
                  <StatRow label="Faltas" homeValue={stats.home.fouls} awayValue={stats.away.fouls} />
                  <StatRow label="Impedim." homeValue={stats.home.offsides} awayValue={stats.away.offsides} />
                  <StatRow label="Amarelos" homeValue={stats.home.yellow} awayValue={stats.away.yellow} />
                  <StatRow label="Vermelhos" homeValue={stats.home.red} awayValue={stats.away.red} />
                </div>
              )}

              {/* Momentum Chart */}
              {momentumSeries?.length > 0 && (
                <div className="pt-2 border-t border-border/30">
                  <AttackMomentumChart 
                    momentumSeries={momentumSeries}
                    minuteNow={minuteNow}
                    homeTeam={homeTeam}
                    awayTeam={awayTeam}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}