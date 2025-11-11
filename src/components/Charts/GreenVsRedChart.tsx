import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface GreenVsRedChartProps {
  greens: number;
  reds: number;
}

export function GreenVsRedChart({ greens, reds }: GreenVsRedChartProps) {
  const data = [
    { name: 'Green', value: greens, color: 'hsl(142 76% 36%)' },
    { name: 'Red', value: reds, color: 'hsl(0 72% 51%)' },
  ];

  const total = greens + reds;

  return (
    <Card className="p-8 animate-scale-in">
      <h3 className="mb-6 text-xl font-bold tracking-tight">Green vs Red</h3>
      {total === 0 ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground font-light">
          Nenhum resultado registrado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-success/10 p-4 text-center backdrop-blur-sm transition-all hover:bg-success/15">
          <p className="text-3xl font-bold text-success">{greens}</p>
          <p className="text-sm text-muted-foreground font-medium mt-1">Greens</p>
        </div>
        <div className="rounded-2xl bg-destructive/10 p-4 text-center backdrop-blur-sm transition-all hover:bg-destructive/15">
          <p className="text-3xl font-bold text-destructive">{reds}</p>
          <p className="text-sm text-muted-foreground font-medium mt-1">Reds</p>
        </div>
      </div>
    </Card>
  );
}
