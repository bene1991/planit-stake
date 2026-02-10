import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Game, Method } from "@/types";
import { OddRangeGamesModal } from "./OddRangeGamesModal";

interface OddRangeData {
  range: string;
  min: number;
  max: number;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
  breakeven: number;
  profit: number;
}

interface OddRangeStatsChartProps {
  data: OddRangeData[];
  games?: Game[];
  methods?: Method[];
}

export const OddRangeStatsChart = ({ data, games, methods }: OddRangeStatsChartProps) => {
  const [selectedRange, setSelectedRange] = useState<OddRangeData | null>(null);

  if (!data || data.length === 0) {
    return null;
  }

  const maxWinRate = Math.max(...data.map(d => d.winRate), 100);

  const getPerformanceColor = (winRate: number, breakeven: number) => {
    const diff = winRate - breakeven;
    if (diff >= 10) return "bg-green-500";
    if (diff >= 0) return "bg-green-400";
    if (diff >= -10) return "bg-amber-500";
    return "bg-red-500";
  };

  const getPerformanceIcon = (winRate: number, breakeven: number) => {
    const diff = winRate - breakeven;
    if (diff >= 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (diff <= -5) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getProfitColor = (profit: number) => {
    if (profit > 0) return "text-green-500";
    if (profit < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  // Filter games that fall within the selected odd range
  const getGamesForRange = (range: OddRangeData): Game[] => {
    if (!games) return [];
    return games.filter(game =>
      game.methodOperations.some(op => {
        const odd = op.odd || 0;
        return odd >= range.min && odd <= range.max && op.result;
      })
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            📊 Win Rate por Faixa de Odd
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.map((item) => (
            <div
              key={item.range}
              className="space-y-1 cursor-pointer hover:bg-muted/30 rounded-lg p-1 -m-1 transition-colors"
              onClick={() => games && methods && setSelectedRange(item)}
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium min-w-[100px]">{item.range}</span>
                  <span className="text-muted-foreground text-xs">
                    ({item.total} ops)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${getProfitColor(item.profit)}`}>
                    {item.profit >= 0 ? '+' : ''}{item.profit.toFixed(2)} stakes
                  </span>
                  <div className="flex items-center gap-1">
                    {getPerformanceIcon(item.winRate, item.breakeven)}
                    <span className={`font-bold ${
                      item.winRate >= item.breakeven ? "text-green-500" : "text-red-500"
                    }`}>
                      {item.winRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="relative h-6 bg-muted rounded-full overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full ${getPerformanceColor(item.winRate, item.breakeven)} transition-all duration-300`}
                  style={{ width: `${(item.winRate / maxWinRate) * 100}%` }}
                />
                <div
                  className="absolute top-0 h-full w-0.5 bg-foreground/50"
                  style={{ left: `${(item.breakeven / maxWinRate) * 100}%` }}
                  title={`Breakeven: ${item.breakeven.toFixed(1)}%`}
                />
                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs">
                  <span className="text-white font-medium drop-shadow-sm">
                    {item.greens}G / {item.reds}R
                  </span>
                  <span className="text-foreground/70 text-[10px]">
                    BE: {item.breakeven.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          <div className="pt-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-0.5 h-3 bg-foreground/50" />
              <span>Linha = Breakeven (100 ÷ odd média da faixa)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedRange && games && methods && (
        <OddRangeGamesModal
          open={!!selectedRange}
          onOpenChange={(open) => !open && setSelectedRange(null)}
          range={selectedRange.range}
          games={getGamesForRange(selectedRange)}
          methods={methods}
          oddMin={selectedRange.min}
          oddMax={selectedRange.max}
          stats={{
            total: selectedRange.total,
            greens: selectedRange.greens,
            reds: selectedRange.reds,
            winRate: selectedRange.winRate,
            profit: selectedRange.profit,
          }}
        />
      )}
    </>
  );
};
