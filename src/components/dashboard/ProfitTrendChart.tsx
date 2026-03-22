import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainerProps } from "recharts";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChartDataPoint {
  date: string;
  profit: number;
}

export function ProfitTrendChart() {
  const { games, isLoading } = useSupabaseGames();

  const chartData = useMemo(() => {
    if (!games || games.length === 0) return [];

    // Group profit by date
    const dailyProfit: Record<string, number> = {};
    
    // Sort games by date ascending
    const sortedGames = [...games].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let cumulativeProfit = 0;
    
    return sortedGames.map(game => {
      const profit = game.profit || 0;
      cumulativeProfit += profit;
      return {
        date: format(new Date(game.date), "dd/MM"),
        profit: cumulativeProfit
      };
    });
  }, [games]);

  if (isLoading) {
    return (
      <Card className="col-span-1 md:col-span-2 shadow-card animate-pulse">
        <CardHeader>
          <div className="h-6 w-32 bg-secondary rounded"></div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full bg-secondary/50 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 md:col-span-2 shadow-card bg-gradient-card">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Tendência de Lucro</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(value) => `R$${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px"
                }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Lucro Acumulado"]}
              />
              <Area 
                type="monotone" 
                dataKey="profit" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#profitGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
