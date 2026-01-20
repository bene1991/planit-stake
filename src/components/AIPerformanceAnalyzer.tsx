import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, RefreshCw, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FilteredStatisticsResult, LeagueStats, TeamStats } from '@/hooks/useFilteredStatistics';
import { cn } from '@/lib/utils';

interface AIPerformanceAnalyzerProps {
  statistics: FilteredStatisticsResult;
  leagueStats: LeagueStats[];
  teamStats: TeamStats[];
  period: string;
  profit: number;
}

export function AIPerformanceAnalyzer({ 
  statistics, 
  leagueStats, 
  teamStats,
  period,
  profit 
}: AIPerformanceAnalyzerProps) {
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const analyzePerformance = useCallback(async () => {
    if (statistics.overallStats.total === 0) {
      toast({
        title: "Sem dados para análise",
        description: "Registre algumas operações para receber insights da IA.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setAnalysis('');

    try {
      // Prepare data for AI
      const sortedLeaguesByWR = [...leagueStats].sort((a, b) => b.winRate - a.winRate);
      const topLeagues = sortedLeaguesByWR.slice(0, 3);
      const bottomLeagues = sortedLeaguesByWR.filter(l => l.total >= 3).slice(-3).reverse();

      const sortedTeamsByWR = [...teamStats].sort((a, b) => b.winRate - a.winRate);
      const topTeams = sortedTeamsByWR.slice(0, 3);
      const bottomTeams = sortedTeamsByWR.filter(t => t.operations >= 3).slice(-3).reverse();

      const performanceData = {
        period,
        overallStats: statistics.overallStats,
        profit,
        averageOdd: statistics.averageOdd,
        breakevenRate: statistics.breakevenRate,
        methodStats: statistics.methodDetailStats.map(m => ({
          methodName: m.methodName,
          total: m.total,
          greens: m.greens,
          reds: m.reds,
          winRate: m.winRate,
        })),
        topLeagues: topLeagues.map(l => ({
          league: l.league,
          winRate: l.winRate,
          profit: l.profit,
          total: l.total,
        })),
        bottomLeagues: bottomLeagues.map(l => ({
          league: l.league,
          winRate: l.winRate,
          profit: l.profit,
          total: l.total,
        })),
        topTeams: topTeams.map(t => ({
          team: t.team,
          winRate: t.winRate,
          profit: t.profit,
          operations: t.operations,
        })),
        bottomTeams: bottomTeams.map(t => ({
          team: t.team,
          winRate: t.winRate,
          profit: t.profit,
          operations: t.operations,
        })),
        oddRangeStats: statistics.oddRangeStats.map(o => ({
          range: o.range,
          winRate: o.winRate,
          profit: o.profit,
          total: o.total,
        })),
        comparison: {
          winRateChange: statistics.comparison.winRateChange,
          volumeChange: statistics.comparison.volumeChange,
        },
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-performance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ performanceData }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao analisar desempenho');
      }

      if (!response.body) {
        throw new Error('Resposta vazia da IA');
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullAnalysis = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullAnalysis += content;
              setAnalysis(fullAnalysis);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullAnalysis += content;
              setAnalysis(fullAnalysis);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      toast({
        title: "Erro na análise",
        description: error instanceof Error ? error.message : "Não foi possível analisar o desempenho",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [statistics, leagueStats, teamStats, period, profit, toast]);

  // Simple markdown to HTML conversion
  const renderMarkdown = (text: string) => {
    return text
      .replace(/## (.*?)(?=\n|$)/g, '<h3 class="text-base font-bold mt-4 mb-2 text-foreground">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/- (.*?)(?=\n|$)/g, '<li class="ml-4 text-sm">$1</li>')
      .replace(/\n/g, '<br />');
  };

  return (
    <Card className="shadow-card overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Análise IA
          </CardTitle>
          <Button
            onClick={analyzePerformance}
            disabled={isLoading}
            size="sm"
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : analysis ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analisar
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!analysis && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Clique em "Analisar" para receber insights personalizados sobre seu desempenho com base nos seus dados.
            </p>
          </div>
        )}

        {isLoading && !analysis && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Analisando seus dados...</p>
          </div>
        )}

        {analysis && (
          <div 
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none",
              "text-sm leading-relaxed"
            )}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }}
          />
        )}
      </CardContent>
    </Card>
  );
}
