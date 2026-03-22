import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { useSupabaseBankroll } from "@/hooks/useSupabaseBankroll";
import { TrendingUp, TrendingDown } from "lucide-react";

export function MethodPerformanceList() {
  const { games, loading: gamesLoading } = useSupabaseGames();
  const { bankroll, isLoading: bankrollLoading } = useSupabaseBankroll();

  const performance = useMemo(() => {
    if (!games || !bankroll.methods) return [];

    const stats = bankroll.methods.map(method => {
      const methodGames = games.filter(g => g.methodOperations.some(op => op.methodId === method.id));
      const totalProfit = methodGames.reduce((acc, g) => {
        const op = g.methodOperations.find(op => op.methodId === method.id);
        return acc + (op?.profit || 0);
      }, 0);
      const winRate = methodGames.length > 0 
        ? (methodGames.filter(g => {
            const op = g.methodOperations.find(op => op.methodId === method.id);
            return op?.result === "Green";
          }).length / methodGames.length) * 100 
        : 0;

      return {
        id: method.id,
        name: method.name,
        profit: totalProfit,
        winRate,
        count: methodGames.length
      };
    });

    return stats.sort((a, b) => b.profit - a.profit);
  }, [games, bankroll.methods]);

  if (gamesLoading || bankrollLoading) {
    return (
      <Card className="shadow-card animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-secondary rounded"></div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 w-full bg-secondary/50 rounded"></div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card bg-gradient-card">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Desempenho por Estratégia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {performance.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma análise disponível
          </p>
        ) : (
          performance.map((item) => (
            <div key={item.id} className="space-y-2 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {item.count} eventos
                  </Badge>
                </div>
                <div className={`flex items-center gap-1 font-bold ${item.profit >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {item.profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  R$ {item.profit.toFixed(2)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Taxa de Assertividade</span>
                  <span>{item.winRate.toFixed(1)}%</span>
                </div>
                <Progress value={item.winRate} className="h-1.5" />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
