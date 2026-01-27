import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BankrollHealthScoreProps {
  score: number;
  classification: "Excelente" | "Bom" | "Regular" | "Atenção" | "Crítico";
  classificationColor: string;
  isAnalyzing: boolean;
  lastAnalysisDate?: Date;
  onAnalyze: () => void;
  summary?: string;
  previousScore?: number;
}

export function BankrollHealthScore({
  score,
  classification,
  classificationColor,
  isAnalyzing,
  lastAnalysisDate,
  onAnalyze,
  summary,
  previousScore,
}: BankrollHealthScoreProps) {
  const getProgressColor = () => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-blue-500";
    if (score >= 40) return "bg-yellow-500";
    if (score >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  const getScoreTrend = () => {
    if (previousScore === undefined) return null;
    const diff = score - previousScore;
    if (diff > 0) return { icon: TrendingUp, color: "text-emerald-500", diff: `+${diff}` };
    if (diff < 0) return { icon: TrendingDown, color: "text-red-500", diff: `${diff}` };
    return { icon: Minus, color: "text-muted-foreground", diff: "0" };
  };

  const trend = getScoreTrend();

  return (
    <Card className="p-6 bg-card border border-border/30 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-neon-subtle">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Score da Banca</h3>
            <p className="text-xs text-muted-foreground">
              {lastAnalysisDate 
                ? `Última análise: ${format(lastAnalysisDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                : "Nenhuma análise realizada"
              }
            </p>
          </div>
        </div>
        <Button 
          onClick={onAnalyze} 
          disabled={isAnalyzing}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isAnalyzing && "animate-spin")} />
          {isAnalyzing ? "Analisando..." : "Analisar"}
        </Button>
      </div>

      <div className="space-y-4">
        {/* Score Bar */}
        <div className="relative">
          <div className="flex items-end justify-between mb-2">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold">{score}</span>
              <div className="flex flex-col">
                <span className={cn("text-lg font-semibold", classificationColor)}>
                  {classification}
                </span>
                {trend && (
                  <span className={cn("text-xs flex items-center gap-1", trend.color)}>
                    <trend.icon className="h-3 w-3" />
                    {trend.diff} pts
                  </span>
                )}
              </div>
            </div>
            <span className="text-muted-foreground text-sm">/ 100</span>
          </div>
          
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all duration-500", getProgressColor())}
              style={{ width: `${score}%` }}
            />
          </div>
          
          {/* Scale markers */}
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>0</span>
            <span>20</span>
            <span>40</span>
            <span>60</span>
            <span>80</span>
            <span>100</span>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div className="pt-4 border-t border-border/30">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {summary}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
