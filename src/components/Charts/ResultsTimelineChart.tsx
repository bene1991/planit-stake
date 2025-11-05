import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimelineData {
  date: string;
  greens: number;
  reds: number;
  cumulative: number;
}

interface ResultsTimelineChartProps {
  data: TimelineData[];
}

export function ResultsTimelineChart({ data }: ResultsTimelineChartProps) {
  const formattedData = data.map(item => ({
    ...item,
    dateFormatted: format(new Date(item.date), 'dd/MM', { locale: ptBR }),
  }));

  return (
    <Card className="p-6 shadow-card">
      <h3 className="mb-4 text-lg font-bold">Evolução de Resultados</h3>
      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Nenhum dado temporal disponível
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="dateFormatted" 
              className="text-xs"
              tick={{ fontSize: 12 }}
            />
            <YAxis className="text-xs" />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-card p-3 shadow-lg">
                      <p className="font-semibold">{data.dateFormatted}</p>
                      <p className="text-sm text-green-600">
                        Greens: {data.greens}
                      </p>
                      <p className="text-sm text-red-600">
                        Reds: {data.reds}
                      </p>
                      <p className="text-sm font-bold">
                        Saldo: {data.cumulative > 0 ? '+' : ''}{data.cumulative}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="greens" 
              stroke="hsl(142 76% 36%)" 
              strokeWidth={2}
              name="Greens"
              dot={{ fill: 'hsl(142 76% 36%)' }}
            />
            <Line 
              type="monotone" 
              dataKey="reds" 
              stroke="hsl(0 72% 51%)" 
              strokeWidth={2}
              name="Reds"
              dot={{ fill: 'hsl(0 72% 51%)' }}
            />
            <Line 
              type="monotone" 
              dataKey="cumulative" 
              stroke="hsl(var(--primary))" 
              strokeWidth={3}
              name="Saldo Acumulado"
              dot={{ fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
