import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Brain, Sparkles, TrendingUp, AlertTriangle, Lightbulb, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIAnalysis {
  score: number;
  summary: string;
  positivePoints: string[];
  negativePoints: string[];
  suggestions: string[];
}

interface MonthlyAIAnalysisProps {
  analysis: AIAnalysis | null;
  isLoading: boolean;
  onRequestAnalysis: () => void;
  disabled?: boolean;
}

export function MonthlyAIAnalysis({ 
  analysis, 
  isLoading, 
  onRequestAnalysis,
  disabled = false 
}: MonthlyAIAnalysisProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (!analysis && !isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Brain className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Análise de IA</h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            Obtenha insights detalhados sobre o seu desempenho neste mês, incluindo pontos fortes, 
            áreas de melhoria e sugestões para o próximo mês.
          </p>
          <Button 
            onClick={onRequestAnalysis} 
            disabled={disabled}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Gerar Análise com IA
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <h3 className="text-lg font-medium mb-2">Analisando seu mês...</h3>
          <p className="text-sm text-muted-foreground">
            A IA está processando seus dados e gerando insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-4">
      {/* Score Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Análise de IA do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 mb-4">
            <div className="flex flex-col items-center">
              <span className={cn("text-4xl font-bold", getScoreColor(analysis.score))}>
                {analysis.score}
              </span>
              <span className="text-xs text-muted-foreground">Score</span>
            </div>
            <div className="flex-1">
              <Progress 
                value={analysis.score} 
                className="h-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Crítico</span>
                <span>Regular</span>
                <span>Bom</span>
                <span>Excelente</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {analysis.summary}
          </p>
        </CardContent>
      </Card>

      {/* Points Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Positive Points */}
        <Card className="border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-500 text-base">
              <TrendingUp className="h-4 w-4" />
              Pontos Positivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.positivePoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Negative Points */}
        <Card className="border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-500 text-base">
              <AlertTriangle className="h-4 w-4" />
              Pontos de Atenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.negativePoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-red-500 mt-0.5">!</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Suggestions */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-blue-500 text-base">
            <Lightbulb className="h-4 w-4" />
            Sugestões para o Próximo Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {analysis.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-blue-500 font-bold mt-0.5">{index + 1}.</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Regenerate button */}
      <div className="flex justify-center">
        <Button 
          variant="outline" 
          onClick={onRequestAnalysis}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Gerar Nova Análise
        </Button>
      </div>
    </div>
  );
}
