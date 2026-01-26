import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/utils/profitCalculator';

interface BankrollEvolutionData {
  date: string;
  cumulativeReais: number;
  dailyChangeReais: number;
}

interface BankrollEvolutionChartProps {
  data: BankrollEvolutionData[];
}

export const BankrollEvolutionChart = ({ data }: BankrollEvolutionChartProps) => {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução da Banca (R$)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            Sem dados para exibir
          </div>
        </CardContent>
      </Card>
    );
  }

  const minValue = Math.min(...data.map(d => d.cumulativeReais));
  const maxValue = Math.max(...data.map(d => d.cumulativeReais));
  const padding = Math.max(Math.abs(minValue), Math.abs(maxValue)) * 0.1 || 10;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolução da Banca (R$)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorNegative" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => format(new Date(`${value}T12:00:00`), 'dd/MM', { locale: ptBR })}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => formatCurrency(value).replace('R$', '').trim()}
                className="text-muted-foreground"
                domain={[minValue - padding, maxValue + padding]}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelFormatter={(value) => format(new Date(`${value}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })}
                formatter={(value: number, name: string) => {
                  const label = name === 'cumulativeReais' ? 'Saldo Acumulado' : 'Variação do Dia';
                  return [
                    <span key={name} className={value >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                      {formatCurrency(value)}
                    </span>,
                    label
                  ];
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Area
                type="monotone"
                dataKey="cumulativeReais"
                stroke="none"
                fill="url(#colorPositive)"
                fillOpacity={1}
                baseLine={0}
              />
              <Line
                type="monotone"
                dataKey="cumulativeReais"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
