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
  // Total minutes for the match (90 or 120 for extra time)
  const totalMinutes = minuteNow > 90 ? 120 : 90;
  
  // Time markers based on total minutes
  const timeMarkers = useMemo(() => {
    if (totalMinutes > 90) {
      return [0, 15, 30, 45, 60, 75, 90, 105, 120];
    }
    return [0, 15, 30, 45, 60, 75, 90];
  }, [totalMinutes]);

  // Filter points to show only up to current minute (no future bars)
  const visiblePoints = useMemo(() => {
    if (!momentumSeries?.length) return [];
    return momentumSeries.filter(p => p.m <= minuteNow);
  }, [momentumSeries, minuteNow]);

  // Calculate max intensity for normalization
  const maxIntensity = useMemo(() => {
    if (!visiblePoints.length) return 1;
    let max = 0;
    for (const point of visiblePoints) {
      max = Math.max(max, point.home, point.away);
    }
    return Math.max(max, 0.5); // Minimum threshold for visibility
  }, [visiblePoints]);

  // Check if there's any actual momentum data
  const hasAnyMomentum = useMemo(() => {
    return visiblePoints.some(p => p.home > 0 || p.away > 0);
  }, [visiblePoints]);

  // Current minute position as percentage
  const currentMinutePercent = useMemo(() => {
    if (minuteNow <= 0) return 0;
    return Math.min((minuteNow / totalMinutes) * 100, 99);
  }, [minuteNow, totalMinutes]);

  if (!momentumSeries?.length) {
    return (
      <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
        Sem dados de momentum
      </div>
    );
  }

  if (!hasAnyMomentum && minuteNow > 5) {
    return (
      <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
        Nenhum evento registrado ainda
      </div>
    );
  }

  // Bar width as percentage (slightly less than 1 minute to have gaps)
  const barWidthPercent = 100 / totalMinutes * 0.8;

  return (
    <div className="space-y-1.5">
      {/* Header with team legends */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-muted-foreground truncate max-w-[80px]">{homeTeam}</span>
        </div>
        <span className="text-muted-foreground font-medium text-[10px]">Momento de Ataque</span>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground truncate max-w-[80px]">{awayTeam}</span>
          <div className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
        </div>
      </div>

      {/* Chart container */}
      <div className="relative h-20 bg-card/50 rounded-md overflow-hidden border border-border/50">
        {/* Baseline (center line) */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border z-10" />

        {/* Interval line at 45' (or 90' for extra time) */}
        <div 
          className="absolute top-0 bottom-0 w-px bg-border/70 z-10"
          style={{ left: `${(45 / totalMinutes) * 100}%` }}
        />
        {totalMinutes > 90 && (
          <div 
            className="absolute top-0 bottom-0 w-px bg-border/70 z-10"
            style={{ left: `${(90 / totalMinutes) * 100}%` }}
          />
        )}

        {/* Momentum bars - absolutely positioned by minute */}
        {visiblePoints.map((point) => {
          const leftPercent = (point.m / totalMinutes) * 100;
          const homeHeightPercent = (point.home / maxIntensity) * 100;
          const awayHeightPercent = (point.away / maxIntensity) * 100;

          return (
            <div
              key={point.m}
              className="absolute flex flex-col group"
              style={{ 
                left: `${leftPercent}%`,
                width: `${barWidthPercent}%`,
                minWidth: '2px',
                height: '100%',
                transform: 'translateX(-50%)'
              }}
            >
              {/* Home bar (above baseline - grows upward) */}
              <div className="flex-1 flex items-end justify-center">
                {point.home > 0 && (
                  <div
                    className="w-full bg-emerald-500 rounded-t-sm transition-colors group-hover:bg-emerald-400"
                    style={{ 
                      height: `${Math.max(homeHeightPercent, 8)}%`,
                      minHeight: '2px'
                    }}
                  />
                )}
              </div>

              {/* Away bar (below baseline - grows downward) */}
              <div className="flex-1 flex items-start justify-center">
                {point.away > 0 && (
                  <div
                    className="w-full bg-violet-500 rounded-b-sm transition-colors group-hover:bg-violet-400"
                    style={{ 
                      height: `${Math.max(awayHeightPercent, 8)}%`,
                      minHeight: '2px'
                    }}
                  />
                )}
              </div>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-30 pointer-events-none">
                <div className="bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap border border-border">
                  {point.m}' - {homeTeam}: {point.home.toFixed(1)} / {awayTeam}: {point.away.toFixed(1)}
                </div>
              </div>
            </div>
          );
        })}

        {/* Current minute indicator (red line) */}
        {minuteNow > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
            style={{ left: `${currentMinutePercent}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-red-500 bg-card/90 px-1 rounded border border-red-500/30">
              {minuteNow}'
            </div>
          </div>
        )}

        {/* Time markers at bottom */}
        <div className="absolute bottom-0.5 left-0 right-0 flex justify-between px-1 pointer-events-none z-10">
          {timeMarkers.map((minute) => (
            <span 
              key={minute}
              className="text-[8px] text-muted-foreground/70 font-medium"
              style={{ 
                position: 'absolute',
                left: `${(minute / totalMinutes) * 100}%`,
                transform: 'translateX(-50%)'
              }}
            >
              {minute}'
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
