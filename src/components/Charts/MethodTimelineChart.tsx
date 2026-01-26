import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/utils/profitCalculator';

interface MethodTimelineData {
  date: string;
  [methodName: string]: number | string; // method cumulative profit in R$
}

interface MethodTimelineChartProps {
  data: MethodTimelineData[];
  methodNames: string[];
}

const METHOD_COLORS = [
  'hsl(142 76% 36%)', // green
  'hsl(217 91% 60%)', // blue
  'hsl(280 65% 60%)', // purple
  'hsl(25 95% 53%)', // orange
  'hsl(340 75% 55%)', // pink
  'hsl(180 65% 45%)', // cyan
  'hsl(45 93% 47%)', // yellow
  'hsl(0 72% 51%)', // red
];

export function MethodTimelineChart({ data, methodNames }: MethodTimelineChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    // Adiciona T12:00:00 para evitar shift de timezone
    dateFormatted: format(new Date(`${item.date}T12:00:00`), 'dd/MM', { locale: ptBR }),
  }));

  if (data.length === 0 || methodNames.length === 0) {
    return (
      <Card className="p-6 shadow-card">
        <h3 className="mb-4 text-lg font-bold">Evolução por Método</h3>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Sem dados para exibir
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-card">
      <h3 className="mb-4 text-lg font-bold">Evolução por Método</h3>
      <p className="text-xs text-muted-foreground mb-4">Lucro acumulado em R$ ao longo do tempo</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="dateFormatted" className="text-xs" tick={{ fontSize: 11 }} />
          <YAxis 
            className="text-xs" 
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => formatCurrency(value).replace('R$', '').trim()}
            width={70}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border bg-card p-3 shadow-lg">
                    <p className="font-semibold mb-2">{label}</p>
                    {payload.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span>{entry.name}:</span>
                        <span className={`font-bold ${(entry.value as number) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {formatCurrency(entry.value as number)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          {methodNames.map((methodName, index) => (
            <Line
              key={methodName}
              type="monotone"
              dataKey={methodName}
              stroke={METHOD_COLORS[index % METHOD_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: METHOD_COLORS[index % METHOD_COLORS.length] }}
              name={methodName}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
