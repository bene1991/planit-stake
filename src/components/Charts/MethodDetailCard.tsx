import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DailyData {
  date: string;
  greens: number;
  reds: number;
  winRate: number;
  balance: number;
}

interface MethodDetailCardProps {
  methodId: string;
  methodName: string;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
  dailyData: DailyData[];
  previousWinRate?: number;
}

export function MethodDetailCard({
  methodName,
  total,
  greens,
  reds,
  winRate,
  dailyData,
  previousWinRate,
}: MethodDetailCardProps) {
  const winRateChange = previousWinRate !== undefined ? winRate - previousWinRate : 0;
  const balance = greens - reds;

  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return 'text-success';
    if (rate >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getBalanceColor = (bal: number) => {
    if (bal > 0) return 'text-success';
    if (bal < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const formattedDailyData = dailyData
    .slice(-7) // Últimos 7 dias
    .map((d) => ({
      ...d,
      // Adiciona T12:00:00 para evitar shift de timezone (UTC midnight -> dia anterior em Brasília)
      dateFormatted: format(new Date(`${d.date}T12:00:00`), 'dd/MM', { locale: ptBR }),
    }));

  return (
    <Card className="p-4 shadow-card">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold text-base">{methodName}</h4>
          <p className="text-xs text-muted-foreground">
            {total} operações • {greens}G / {reds}R
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${getWinRateColor(winRate)}`}>{winRate.toFixed(1)}%</div>
          {previousWinRate !== undefined && (
            <div className="flex items-center justify-end gap-1 text-xs">
              {winRateChange > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-success" />
                  <span className="text-success">+{winRateChange.toFixed(1)}%</span>
                </>
              ) : winRateChange < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 text-destructive" />
                  <span className="text-destructive">{winRateChange.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <Minus className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">0%</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-success">Greens: {greens}</span>
          <span className="text-destructive">Reds: {reds}</span>
        </div>
        <Progress value={total > 0 ? (greens / total) * 100 : 0} className="h-2" />
      </div>

      {/* Saldo */}
      <div className="flex items-center justify-between mb-4 p-2 rounded-lg bg-muted/30">
        <span className="text-xs text-muted-foreground">Saldo</span>
        <span className={`font-bold ${getBalanceColor(balance)}`}>
          {balance > 0 ? '+' : ''}{balance}
        </span>
      </div>

      {/* Mini chart */}
      {formattedDailyData.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2">Últimos 7 dias</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={formattedDailyData} barGap={2}>
              <XAxis dataKey="dateFormatted" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-card p-2 shadow-lg text-xs">
                        <p className="font-semibold">{data.dateFormatted}</p>
                        <p className="text-success">G: {data.greens}</p>
                        <p className="text-destructive">R: {data.reds}</p>
                        <p>Win Rate: {data.winRate.toFixed(1)}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="greens" stackId="a" fill="hsl(142 76% 36%)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="reds" stackId="a" fill="hsl(0 72% 51%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {formattedDailyData.length === 0 && (
        <div className="mt-4 text-center text-xs text-muted-foreground py-4">
          Sem dados no período selecionado
        </div>
      )}
    </Card>
  );
}
