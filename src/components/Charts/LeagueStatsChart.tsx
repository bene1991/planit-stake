import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface LeagueStats {
  league: string;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
}

interface LeagueStatsChartProps {
  data: LeagueStats[];
}

export function LeagueStatsChart({ data }: LeagueStatsChartProps) {
  // Pegar top 10 ligas
  const topLeagues = data.slice(0, 10);

  // Cor baseada no win rate
  const getColor = (winRate: number) => {
    if (winRate >= 60) return 'hsl(142 76% 36%)'; // Verde
    if (winRate >= 50) return 'hsl(45 93% 47%)'; // Amarelo
    return 'hsl(0 72% 51%)'; // Vermelho
  };

  return (
    <Card className="p-6 shadow-card">
      <h3 className="mb-4 text-lg font-bold">Performance por Liga</h3>
      {topLeagues.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Nenhuma estatística disponível
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topLeagues} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} className="text-xs" />
              <YAxis 
                dataKey="league" 
                type="category" 
                width={120} 
                className="text-xs"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-card p-3 shadow-lg">
                        <p className="font-semibold">{data.league}</p>
                        <p className="text-sm">
                          Win Rate: <span className="font-bold">{data.winRate}%</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {data.total} operações • {data.greens}G / {data.reds}R
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                {topLeagues.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry.winRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(142 76% 36%)' }} />
              <span className="text-muted-foreground">≥ 60% Win Rate</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(45 93% 47%)' }} />
              <span className="text-muted-foreground">50-60% Win Rate</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(0 72% 51%)' }} />
              <span className="text-muted-foreground">&lt; 50% Win Rate</span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
