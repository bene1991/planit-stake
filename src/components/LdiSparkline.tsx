import { LdiSnapshot } from '@/hooks/useLdiHistory';
import { cn } from '@/lib/utils';

interface LdiSparklineProps {
  data: LdiSnapshot[];
  width?: number;
  height?: number;
  className?: string;
}

export function LdiSparkline({ data, width = 120, height = 24, className }: LdiSparklineProps) {
  if (data.length < 2) return null;

  const padding = 1;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const minMinute = data[0].minute;
  const maxMinute = data[data.length - 1].minute;
  const minuteRange = Math.max(maxMinute - minMinute, 1);

  const toX = (minute: number) => padding + ((minute - minMinute) / minuteRange) * w;
  const toY = (ldi: number) => padding + ((100 - ldi) / 100) * h;

  const points = data.map(d => `${toX(d.minute).toFixed(1)},${toY(d.ldi).toFixed(1)}`).join(' ');

  const lastLdi = data[data.length - 1].ldi;
  const strokeColor = lastLdi >= 55 ? 'hsl(var(--chart-2))' : lastLdi <= 45 ? 'hsl(var(--chart-5))' : 'hsl(var(--muted-foreground))';

  const midY = toY(50);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('flex-shrink-0', className)}
    >
      {/* Baseline at 50 */}
      <line
        x1={padding}
        y1={midY}
        x2={width - padding}
        y2={midY}
        stroke="hsl(var(--muted-foreground))"
        strokeWidth={0.5}
        strokeDasharray="2 2"
        opacity={0.4}
      />
      {/* LDI line */}
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Current value dot */}
      <circle
        cx={toX(data[data.length - 1].minute)}
        cy={toY(lastLdi)}
        r={2}
        fill={strokeColor}
      />
    </svg>
  );
}
