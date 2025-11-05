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
    <Card className="p-6 shadow-card">
      <h3 className="mb-4 text-lg font-bold">Green vs Red</h3>
      {total === 0 ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
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
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-green-500/10 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{greens}</p>
          <p className="text-sm text-muted-foreground">Greens</p>
        </div>
        <div className="rounded-lg bg-red-500/10 p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{reds}</p>
          <p className="text-sm text-muted-foreground">Reds</p>
        </div>
      </div>
    </Card>
  );
}
