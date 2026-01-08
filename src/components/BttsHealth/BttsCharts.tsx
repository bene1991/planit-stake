import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BttsEntry } from '@/types/btts';
import { cn } from '@/lib/utils';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { format, parseISO, startOfWeek, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';

interface BttsChartsProps {
  entries: BttsEntry[];
  bankrollInitial: number;
}

export function BttsCharts({ entries, bankrollInitial }: BttsChartsProps) {
  // Prepare bankroll evolution data (last 30 days)
  const bankrollData = useMemo(() => {
    if (entries.length === 0) return [];

    const sortedEntries = [...entries]
      .filter(e => e.result !== 'Void')
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA.getTime() - dateB.getTime();
      });

    let runningBankroll = bankrollInitial;
    const data: { date: string; bankroll: number }[] = [];

    sortedEntries.forEach(entry => {
      runningBankroll += entry.profit || 0;
      data.push({
        date: format(parseISO(entry.date), 'dd/MM'),
        bankroll: runningBankroll,
      });
    });

    // Return last 30 points max
    return data.slice(-30);
  }, [entries, bankrollInitial]);

  // Prepare weekly profit data (last 8 weeks)
  const weeklyProfitData = useMemo(() => {
    if (entries.length === 0) return [];

    const now = new Date();
    const weekMap = new Map<string, number>();

    // Initialize last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(now, i * 7), { locale: ptBR });
      const weekKey = format(weekStart, 'dd/MM');
      weekMap.set(weekKey, 0);
    }

    // Calculate profit per week
    entries
      .filter(e => e.result !== 'Void')
      .forEach(entry => {
        const entryDate = parseISO(entry.date);
        const weekStart = startOfWeek(entryDate, { locale: ptBR });
        const weekKey = format(weekStart, 'dd/MM');
        
        if (weekMap.has(weekKey)) {
          const profitStakes = entry.stake_value ? (entry.profit || 0) / entry.stake_value : 0;
          weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + profitStakes);
        }
      });

    return Array.from(weekMap.entries()).map(([week, profit]) => ({
      week,
      profit: Number(profit.toFixed(2)),
    }));
  }, [entries]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Bankroll Evolution Chart */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4" />
            Evolução da Banca
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {bankrollData.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bankrollData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Banca']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bankroll" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Adicione entradas para ver o gráfico
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Profit Chart */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4" />
            Lucro Semanal (Stakes)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {weeklyProfitData.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyProfitData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value.toFixed(2)} stakes`, 'Lucro']}
                  />
                  <Bar 
                    dataKey="profit" 
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Adicione entradas para ver o gráfico
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
