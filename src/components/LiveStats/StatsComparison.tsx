import { Card } from "@/components/ui/card";

interface Stat {
  label: string;
  home: number | string;
  away: number | string;
}

interface StatsComparisonProps {
  homeTeam: string;
  awayTeam: string;
  stats: Stat[];
}

export function StatsComparison({ homeTeam, awayTeam, stats }: StatsComparisonProps) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Estatísticas Comparativas</h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4 pb-2 border-b text-sm font-semibold">
          <div className="text-left">{homeTeam}</div>
          <div className="text-center text-muted-foreground">Estatística</div>
          <div className="text-right">{awayTeam}</div>
        </div>
        
        {stats.map((stat, index) => (
          <div key={index} className="grid grid-cols-3 gap-4 items-center">
            <div className="text-left font-semibold">{stat.home}</div>
            <div className="text-center text-sm text-muted-foreground">{stat.label}</div>
            <div className="text-right font-semibold">{stat.away}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
