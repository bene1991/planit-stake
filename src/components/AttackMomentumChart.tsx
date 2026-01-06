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
  // Calculate max intensity for normalization - use minimum threshold for visibility
  const maxIntensity = useMemo(() => {
    if (!momentumSeries?.length) return 1;
    let max = 0;
    for (const point of momentumSeries) {
      max = Math.max(max, point.home, point.away);
    }
    // Minimum threshold to ensure bars are visible even with low values
    return Math.max(max, 0.5);
  }, [momentumSeries]);

  // Calculate current minute position as percentage based on 90 minutes (or 120 for extra time)
  const currentMinutePercent = useMemo(() => {
    if (minuteNow <= 0) return 0;
    const totalMinutes = minuteNow > 90 ? 120 : 90;
    // Clamp between 1% and 98% to keep indicator visible
    return Math.max(1, Math.min((minuteNow / totalMinutes) * 100, 98));
  }, [minuteNow]);

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

      <div className="relative h-24 bg-card/50 rounded-md overflow-hidden border border-border/50">
        {/* Baseline */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border z-10" />

        {/* Bars container - using CSS grid for consistent bar width */}
        <div 
          className="absolute inset-0 px-1"
          style={{ 
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: 'minmax(3px, 1fr)',
            alignItems: 'center',
            gap: '1px'
          }}
        >
          {momentumSeries.map((point) => {
            // Calculate height as percentage of half-chart (50% = full half)
            const homeHeightPercent = (point.home / maxIntensity) * 100;
            const awayHeightPercent = (point.away / maxIntensity) * 100;

            return (
              <div
                key={point.m}
                className="flex flex-col items-center justify-center h-full group relative"
              >
                {/* Home bar (above baseline) */}
                <div className="flex-1 flex items-end justify-center w-full">
                  <div
                    className="w-full bg-emerald-500 rounded-t-sm transition-all duration-300 group-hover:bg-emerald-400"
                    style={{ 
                      height: point.home > 0 ? `${Math.max(homeHeightPercent, 15)}%` : '0%',
                      minHeight: point.home > 0 ? '3px' : '0'
                    }}
                  />
                </div>

                {/* Away bar (below baseline) */}
                <div className="flex-1 flex items-start justify-center w-full">
                  <div
                    className="w-full bg-violet-500 rounded-b-sm transition-all duration-300 group-hover:bg-violet-400"
                    style={{ 
                      height: point.away > 0 ? `${Math.max(awayHeightPercent, 15)}%` : '0%',
                      minHeight: point.away > 0 ? '3px' : '0'
                    }}
                  />
                </div>

                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-30 pointer-events-none">
                  <div className="bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap border border-border">
                    {point.m}' - Casa: {point.home.toFixed(1)} / Fora: {point.away.toFixed(1)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current minute indicator (red line) - always visible */}
        {minuteNow > 0 && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-red-500 z-20 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
            style={{ left: `${currentMinutePercent}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-red-500 bg-card/90 px-1 rounded border border-red-500/30">
              {minuteNow}'
            </div>
          </div>
        )}

        {/* Time labels */}
        <div className="absolute bottom-0.5 left-0 right-0 flex justify-between px-2 text-[9px] text-muted-foreground font-medium pointer-events-none z-10">
          <span className="bg-card/80 px-0.5 rounded">0'</span>
          <span className="bg-card/80 px-0.5 rounded">45'</span>
          <span className="bg-card/80 px-0.5 rounded">90'</span>
        </div>
      </div>
    </div>
  );
}