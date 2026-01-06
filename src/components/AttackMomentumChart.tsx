import { useMemo } from 'react';
import { MomentumPoint } from '@/hooks/useFixtureCache';

interface AttackMomentumChartProps {
  momentumSeries: MomentumPoint[];
  minuteNow: number;
  homeTeam?: string;
  awayTeam?: string;
}

export function AttackMomentumChart({ 
  momentumSeries, 
  minuteNow, 
  homeTeam = 'Casa',
  awayTeam = 'Fora'
}: AttackMomentumChartProps) {
  // Calculate max intensity for normalization
  const maxIntensity = useMemo(() => {
    if (!momentumSeries?.length) return 1;
    let max = 0;
    for (const point of momentumSeries) {
      max = Math.max(max, point.home, point.away);
    }
    return max || 1;
  }, [momentumSeries]);

  // Calculate current minute position as percentage
  const currentMinutePercent = useMemo(() => {
    if (!momentumSeries?.length || minuteNow <= 0) return 0;
    const totalMinutes = momentumSeries.length;
    return Math.min((minuteNow / totalMinutes) * 100, 100);
  }, [momentumSeries, minuteNow]);

  // Check if there's any actual momentum data (any non-zero values)
  const hasAnyMomentum = useMemo(() => {
    if (!momentumSeries?.length) return false;
    return momentumSeries.some(p => p.home > 0 || p.away > 0);
  }, [momentumSeries]);

  if (!momentumSeries?.length) {
    return (
      <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
        Sem dados de momentum
      </div>
    );
  }

  if (!hasAnyMomentum) {
    return (
      <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
        Nenhum evento registrado ainda
      </div>
    );
  }

  const barWidth = `${100 / momentumSeries.length}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-muted-foreground truncate max-w-[100px]">{homeTeam}</span>
        </div>
        <span className="text-muted-foreground font-medium">Momento de Ataque</span>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground truncate max-w-[100px]">{awayTeam}</span>
          <div className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
        </div>
      </div>

      <div className="relative h-20 bg-card/50 rounded-md overflow-hidden border border-border/50">
        {/* Baseline */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border z-10" />

        {/* Bars container */}
        <div className="absolute inset-0 flex items-center">
          {momentumSeries.map((point, index) => {
            const homeHeight = (point.home / maxIntensity) * 50;
            const awayHeight = (point.away / maxIntensity) * 50;

            return (
              <div
                key={point.m}
                className="flex flex-col items-center justify-center h-full group"
                style={{ width: barWidth }}
              >
              {/* Home bar (above baseline) */}
                <div className="flex-1 flex items-end justify-center">
                  <div
                    className="w-full max-w-[4px] bg-emerald-500 rounded-t-sm transition-all duration-300 group-hover:bg-emerald-400"
                    style={{ height: `${Math.max(homeHeight, point.home > 0 ? 8 : 0)}%` }}
                  />
                </div>

                {/* Away bar (below baseline) */}
                <div className="flex-1 flex items-start justify-center">
                  <div
                    className="w-full max-w-[4px] bg-violet-500 rounded-b-sm transition-all duration-300 group-hover:bg-violet-400"
                    style={{ height: `${Math.max(awayHeight, point.away > 0 ? 8 : 0)}%` }}
                  />
                </div>

                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 pointer-events-none">
                  <div className="bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap border border-border">
                    {point.m}' - Casa: {point.home.toFixed(1)} / Fora: {point.away.toFixed(1)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current minute indicator (red line) */}
        {minuteNow > 0 && currentMinutePercent > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 transition-all duration-300"
            style={{ left: `${currentMinutePercent}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] font-medium text-red-500 bg-card px-0.5 rounded">
              {minuteNow}'
            </div>
          </div>
        )}

        {/* Time labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[8px] text-muted-foreground">
          <span>0'</span>
          <span>45'</span>
          <span>90'</span>
        </div>
      </div>
    </div>
  );
}