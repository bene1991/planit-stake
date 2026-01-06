import { NormalizedStats } from '@/hooks/useFixtureCache';

interface MatchStatsOverviewProps {
  stats: NormalizedStats | null;
  loading?: boolean;
}

interface StatRowProps {
  label: string;
  homeValue: number;
  awayValue: number;
  isPercentage?: boolean;
}

function StatRow({ label, homeValue, awayValue, isPercentage = false }: StatRowProps) {
  const total = homeValue + awayValue;
  const homePercent = total > 0 ? (homeValue / total) * 100 : 50;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground w-8 text-left">
          {homeValue}{isPercentage ? '%' : ''}
        </span>
        <span className="text-xs text-muted-foreground flex-1 text-center">
          {label}
        </span>
        <span className="text-sm font-medium text-foreground w-8 text-right">
          {awayValue}{isPercentage ? '%' : ''}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
        <div 
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${homePercent}%` }}
        />
        <div 
          className="h-full bg-violet-500 transition-all duration-300"
          style={{ width: `${100 - homePercent}%` }}
        />
      </div>
    </div>
  );
}

function PossessionRow({ homeValue, awayValue }: { homeValue: number; awayValue: number }) {
  const total = homeValue + awayValue;
  const homePercent = total > 0 ? (homeValue / total) * 100 : 50;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white bg-emerald-500 px-2 py-0.5 rounded">
          {homeValue}%
        </span>
        <span className="text-xs text-muted-foreground flex-1 text-center">
          Posse de bola
        </span>
        <span className="text-sm font-bold text-white bg-violet-500 px-2 py-0.5 rounded">
          {awayValue}%
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
        <div 
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${homePercent}%` }}
        />
        <div 
          className="h-full bg-violet-500 transition-all duration-300"
          style={{ width: `${100 - homePercent}%` }}
        />
      </div>
    </div>
  );
}

function hasValidStats(stats: NormalizedStats): boolean {
  const total = 
    stats.home.possession + stats.away.possession +
    stats.home.shots_total + stats.away.shots_total +
    stats.home.corners + stats.away.corners +
    stats.home.fouls + stats.away.fouls;
  return total > 0;
}

export function MatchStatsOverview({ stats, loading }: MatchStatsOverviewProps) {
  if (loading) {
    return (
      <div className="bg-muted/30 rounded-lg p-3 space-y-3">
        <div className="h-4 bg-muted rounded w-32 mx-auto animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1 animate-pulse">
            <div className="flex justify-between">
              <div className="h-4 w-8 bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-4 w-8 bg-muted rounded" />
            </div>
            <div className="h-1.5 bg-muted rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }


  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-3">
      <h4 className="text-xs font-medium text-muted-foreground text-center mb-3">
        Visão geral da partida
      </h4>

      <PossessionRow 
        homeValue={stats.home.possession} 
        awayValue={stats.away.possession} 
      />

      <StatRow 
        label="Finalizações" 
        homeValue={stats.home.shots_total} 
        awayValue={stats.away.shots_total} 
      />

      <StatRow 
        label="Chutes no Gol" 
        homeValue={stats.home.shots_on} 
        awayValue={stats.away.shots_on} 
      />

      <StatRow 
        label="Chutes Fora" 
        homeValue={stats.home.shots_off} 
        awayValue={stats.away.shots_off} 
      />

      <StatRow 
        label="Escanteios" 
        homeValue={stats.home.corners} 
        awayValue={stats.away.corners} 
      />

      <StatRow 
        label="Faltas" 
        homeValue={stats.home.fouls} 
        awayValue={stats.away.fouls} 
      />

      <StatRow 
        label="Impedimentos" 
        homeValue={stats.home.offsides} 
        awayValue={stats.away.offsides} 
      />

      <StatRow 
        label="Cartões Amarelos" 
        homeValue={stats.home.yellow} 
        awayValue={stats.away.yellow} 
      />

      <StatRow 
        label="Cartões Vermelhos" 
        homeValue={stats.home.red} 
        awayValue={stats.away.red} 
      />
    </div>
  );
}
