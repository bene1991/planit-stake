import { useMemo, useState } from 'react';
import { MomentumPoint, KeyEvent } from '@/hooks/useFixtureCache';

interface AttackMomentumChartProps {
  momentumSeries: MomentumPoint[];
  minuteNow: number;
  homeTeam?: string;
  awayTeam?: string;
  keyEvents?: KeyEvent[];
}

export function AttackMomentumChart({ 
  momentumSeries, 
  minuteNow, 
  homeTeam = 'Casa',
  awayTeam = 'Fora',
  keyEvents = [],
}: AttackMomentumChartProps) {
  const [hoveredMinute, setHoveredMinute] = useState<number | null>(null);

  // Total minutes for the match (90 or 120 for extra time)
  const totalMinutes = minuteNow > 90 ? 120 : 90;
  
  // Simplified time markers - only key intervals
  const timeMarkers = useMemo(() => {
    if (totalMinutes > 90) {
      return [0, 45, 90, 120];
    }
    return [0, 45, 90];
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
    return Math.max(max, 1); // No artificial minimum
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

  // Group key events by minute for easy lookup
  const eventsByMinute = useMemo(() => {
    const map = new Map<number, KeyEvent[]>();
    for (const event of keyEvents) {
      const existing = map.get(event.minute) || [];
      existing.push(event);
      map.set(event.minute, existing);
    }
    return map;
  }, [keyEvents]);

  // Get goals for markers
  const goalEvents = useMemo(() => {
    return keyEvents.filter(e => e.type === 'goal' && e.minute <= minuteNow);
  }, [keyEvents, minuteNow]);

  // Get hovered point info
  const hoveredInfo = useMemo(() => {
    if (hoveredMinute === null) return null;
    const point = visiblePoints.find(p => p.m === hoveredMinute);
    const events = eventsByMinute.get(hoveredMinute) || [];
    return { point, events };
  }, [hoveredMinute, visiblePoints, eventsByMinute]);

  if (!momentumSeries?.length) {
    return (
      <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
        Sem dados de momentum
      </div>
    );
  }

  if (!hasAnyMomentum && minuteNow > 5) {
    return (
      <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
        Nenhum evento registrado ainda
      </div>
    );
  }

  // Bar width as percentage
  const barWidthPercent = 100 / totalMinutes * 0.85;

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
      <div className="relative h-28 bg-card/50 rounded-md overflow-hidden border border-border/50">
        {/* Goal markers layer - on top */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {goalEvents.map((event, idx) => {
            const leftPercent = (event.minute / totalMinutes) * 100;
            const isHome = event.team === 'home';
            return (
              <div
                key={`goal-${event.minute}-${idx}`}
                className="absolute flex flex-col items-center"
                style={{ 
                  left: `${leftPercent}%`,
                  transform: 'translateX(-50%)',
                  top: isHome ? '4px' : 'auto',
                  bottom: isHome ? 'auto' : '16px',
                }}
              >
                <span className="text-xs drop-shadow-sm">⚽</span>
                {/* Vertical line marking the goal minute */}
                <div 
                  className="absolute w-px bg-yellow-400/50" 
                  style={{
                    height: '50%',
                    top: isHome ? '14px' : 'auto',
                    bottom: isHome ? 'auto' : '14px'
                  }}
                />
              </div>
            );
          })}
        </div>

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
          // Real intensity scaling - limited to 95% max to stay within bounds
          const homeHeightPercent = maxIntensity > 0 ? (point.home / maxIntensity) * 100 : 0;
          const awayHeightPercent = maxIntensity > 0 ? (point.away / maxIntensity) * 100 : 0;
          const hasEvent = eventsByMinute.has(point.m);
          const isHovered = hoveredMinute === point.m;

          return (
            <div
              key={point.m}
              className="absolute flex flex-col cursor-pointer"
              style={{ 
                left: `${leftPercent}%`,
                width: `${barWidthPercent}%`,
                minWidth: '3px',
                top: '8px',
                bottom: '16px',
                transform: 'translateX(-50%)'
              }}
              onMouseEnter={() => setHoveredMinute(point.m)}
              onMouseLeave={() => setHoveredMinute(null)}
            >
              {/* Home bar (above baseline - grows upward) */}
              <div className="h-1/2 flex items-end justify-center overflow-hidden">
                {point.home > 0 && (
                  <div
                    className={`w-full rounded-t-sm transition-all duration-150 ${
                      isHovered ? 'bg-emerald-400' : hasEvent ? 'bg-emerald-400' : 'bg-emerald-500'
                    }`}
                    style={{ 
                      height: `${Math.min(Math.max(homeHeightPercent, 3), 95)}%`,
                      opacity: homeHeightPercent < 20 ? 0.6 : 1,
                    }}
                  />
                )}
              </div>

              {/* Away bar (below baseline - grows downward) */}
              <div className="h-1/2 flex items-start justify-center overflow-hidden">
                {point.away > 0 && (
                  <div
                    className={`w-full rounded-b-sm transition-all duration-150 ${
                      isHovered ? 'bg-violet-400' : hasEvent ? 'bg-violet-400' : 'bg-violet-500'
                    }`}
                    style={{ 
                      height: `${Math.min(Math.max(awayHeightPercent, 3), 95)}%`,
                      opacity: awayHeightPercent < 20 ? 0.6 : 1,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Hover tooltip */}
        {hoveredInfo && hoveredMinute !== null && (
          <div 
            className="absolute z-30 pointer-events-none"
            style={{ 
              left: `${(hoveredMinute / totalMinutes) * 100}%`,
              top: '4px',
              transform: 'translateX(-50%)'
            }}
          >
            <div className="bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-lg border border-border min-w-[100px]">
              <div className="font-bold text-center mb-0.5">{hoveredMinute}'</div>
              {hoveredInfo.point && (
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-500">{homeTeam}: {hoveredInfo.point.home.toFixed(1)}</span>
                  <span className="text-violet-500">{awayTeam}: {hoveredInfo.point.away.toFixed(1)}</span>
                </div>
              )}
              {hoveredInfo.events.length > 0 && (
                <div className="mt-0.5 pt-0.5 border-t border-border/50">
                  {hoveredInfo.events.map((e, i) => (
                    <div key={i} className="text-[9px]">
                      {e.type === 'goal' && '⚽ '}
                      {e.type === 'red_card' && '🟥 '}
                      {e.player && <span className="font-medium">{e.player}</span>}
                      <span className="text-muted-foreground ml-1">
                        ({e.team === 'home' ? homeTeam : awayTeam})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Current minute indicator (red line) */}
        {minuteNow > 0 && (
          <div
            className="absolute top-0 bottom-4 w-0.5 bg-red-500 z-20 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
            style={{ left: `${currentMinutePercent}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-red-500 bg-card/90 px-1 rounded border border-red-500/30">
              {minuteNow}'
            </div>
          </div>
        )}

        {/* Time markers at bottom - simplified */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pointer-events-none z-10 text-[7px] text-muted-foreground/60">
          <span>0'</span>
          <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>45'</span>
          <span className="ml-auto">{totalMinutes > 90 ? '120' : '90'}'</span>
        </div>
      </div>
    </div>
  );
}
