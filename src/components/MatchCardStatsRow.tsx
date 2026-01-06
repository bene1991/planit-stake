import { NormalizedStats } from '@/hooks/useFixtureCache';

interface MatchCardStatsRowProps {
  stats: NormalizedStats | null;
  loading?: boolean;
}

interface StatItemProps {
  label: string;
  homeValue: number;
  awayValue: number;
  isPercentage?: boolean;
}

function StatItem({ label, homeValue, awayValue, isPercentage = false }: StatItemProps) {
  const total = homeValue + awayValue;
  const homePercent = total > 0 ? (homeValue / total) * 100 : 50;
  
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] text-muted-foreground text-center mb-0.5 truncate">
        {label}
      </div>
      <div className="flex items-center justify-center gap-1 text-xs font-medium">
        <span className="text-foreground">{homeValue}{isPercentage ? '%' : ''}</span>
        <span className="text-muted-foreground">-</span>
        <span className="text-foreground">{awayValue}{isPercentage ? '%' : ''}</span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden mt-0.5">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${homePercent}%` }}
        />
      </div>
    </div>
  );
}

export function MatchCardStatsRow({ stats, loading }: MatchCardStatsRowProps) {
  if (loading) {
    return (
      <div className="flex gap-3 px-3 py-2 bg-muted/30 rounded-md animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 h-8 bg-muted rounded" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="flex gap-3 px-3 py-2 bg-muted/30 rounded-md">
      <StatItem 
        label="Posse" 
        homeValue={stats.home.possession} 
        awayValue={stats.away.possession}
        isPercentage
      />
      <StatItem 
        label="Chutes" 
        homeValue={stats.home.shots_total} 
        awayValue={stats.away.shots_total}
      />
      <StatItem 
        label="No Gol" 
        homeValue={stats.home.shots_on} 
        awayValue={stats.away.shots_on}
      />
      <StatItem 
        label="Escanteios" 
        homeValue={stats.home.corners} 
        awayValue={stats.away.corners}
      />
    </div>
  );
}