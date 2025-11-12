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
    <Card className="p-6 border border-border/30 hover:border-primary/20 transition-all">
      <h3 className="text-lg font-bold mb-6 text-foreground">Estatísticas Comparativas</h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4 pb-3 border-b border-border/30 text-sm font-bold">
          <div className="text-left text-foreground">{homeTeam}</div>
          <div className="text-center text-muted-foreground">Estatística</div>
          <div className="text-right text-foreground">{awayTeam}</div>
        </div>
        
        {stats.map((stat, index) => (
          <div key={index} className="grid grid-cols-3 gap-4 items-center py-2 hover:bg-gradient-neon-subtle rounded-lg px-2 transition-colors">
            <div className="text-left font-bold text-primary">{stat.home}</div>
            <div className="text-center text-xs text-muted-foreground uppercase tracking-wide">{stat.label}</div>
            <div className="text-right font-bold text-primary">{stat.away}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
