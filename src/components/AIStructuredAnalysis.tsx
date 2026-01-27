import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIStructuredAnalysisProps {
  positivePoints: string[];
  negativePoints: string[];
  suggestions: string[];
  isLoading?: boolean;
}

export function AIStructuredAnalysis({
  positivePoints,
  negativePoints,
  suggestions,
  isLoading,
}: AIStructuredAnalysisProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4 bg-card border border-border/30 animate-pulse">
            <div className="h-6 w-32 bg-muted rounded mb-4" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-4 w-5/6 bg-muted rounded" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const hasNoData = positivePoints.length === 0 && negativePoints.length === 0 && suggestions.length === 0;

  if (hasNoData) {
    return (
      <Card className="p-6 bg-card border border-border/30 text-center">
        <Lightbulb className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-muted-foreground">
          Clique em "Analisar" para obter insights da IA sobre sua performance.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Pontos Positivos */}
      <Card className="p-4 bg-card border border-emerald-500/30 hover:border-emerald-500/50 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <h4 className="font-semibold text-emerald-500">Pontos Positivos</h4>
        </div>
        <ul className="space-y-2">
          {positivePoints.map((point, index) => (
            <li 
              key={index} 
              className="text-sm text-foreground/90 flex items-start gap-2"
            >
              <span className="text-emerald-500 mt-1">•</span>
              <span>{point}</span>
            </li>
          ))}
          {positivePoints.length === 0 && (
            <li className="text-sm text-muted-foreground italic">
              Nenhum ponto positivo identificado
            </li>
          )}
        </ul>
      </Card>

      {/* Pontos Negativos */}
      <Card className="p-4 bg-card border border-orange-500/30 hover:border-orange-500/50 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <h4 className="font-semibold text-orange-500">Pontos de Atenção</h4>
        </div>
        <ul className="space-y-2">
          {negativePoints.map((point, index) => (
            <li 
              key={index} 
              className="text-sm text-foreground/90 flex items-start gap-2"
            >
              <span className="text-orange-500 mt-1">•</span>
              <span>{point}</span>
            </li>
          ))}
          {negativePoints.length === 0 && (
            <li className="text-sm text-muted-foreground italic">
              Nenhum ponto de atenção identificado
            </li>
          )}
        </ul>
      </Card>

      {/* Sugestões */}
      <Card className="p-4 bg-card border border-blue-500/30 hover:border-blue-500/50 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-blue-500" />
          <h4 className="font-semibold text-blue-500">Sugestões</h4>
        </div>
        <ul className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <li 
              key={index} 
              className="text-sm text-foreground/90 flex items-start gap-2"
            >
              <span className="text-blue-500 mt-1">•</span>
              <span>{suggestion}</span>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="text-sm text-muted-foreground italic">
              Nenhuma sugestão no momento
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
