import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MethodStats {
  methodId: string;
  methodName: string;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
}

interface MethodComparisonChartProps {
  data: MethodStats[];
}

export function MethodComparisonChart({ data }: MethodComparisonChartProps) {
  const getColor = (winRate: number) => {
    if (winRate >= 60) return 'hsl(142 76% 36%)';
    if (winRate >= 50) return 'hsl(45 93% 47%)';
    return 'hsl(0 72% 51%)';
  };

  return (
    <Card className="p-6 shadow-card">
      <h3 className="mb-4 text-lg font-bold">Comparação de Métodos</h3>
      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Nenhum método com operações
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="methodName" 
              className="text-xs"
              tick={{ fontSize: 12 }}
            />
            <YAxis domain={[0, 100]} className="text-xs" />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-card p-3 shadow-lg">
                      <p className="font-semibold">{data.methodName}</p>
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
            <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.winRate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
