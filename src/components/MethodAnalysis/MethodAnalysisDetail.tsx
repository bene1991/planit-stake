import { 
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock, XCircle,
  Target, Activity, BarChart3, Sparkles, Info, AlertTriangle, CheckCircle, XOctagon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MethodAnalysisData, MethodPhase, AlertType } from "@/hooks/useMethodAnalysis";
import { cn } from "@/lib/utils";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from "recharts";

interface MethodAnalysisDetailProps {
  data: MethodAnalysisData;
  aiRecommendation: { action: string; explanation: string } | null;
  aiLoading: boolean;
}

const phaseConfig: Record<MethodPhase, { color: string; icon: React.ReactNode; description: string }> = {
  'Em Validação': { 
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30', 
    icon: <Clock className="h-5 w-5" />,
    description: 'Menos de 21 operações. Continue coletando dados.'
  },
  'Sinal Fraco': { 
    color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30', 
    icon: <AlertCircle className="h-5 w-5" />,
    description: 'Entre 21 e 50 operações. Resultados preliminares.'
  },
  'Validado': { 
    color: 'text-green-500 bg-green-500/10 border-green-500/30', 
    icon: <CheckCircle2 className="h-5 w-5" />,
    description: 'Mais de 50 operações com edge positivo.'
  },
  'Reprovado': { 
    color: 'text-red-500 bg-red-500/10 border-red-500/30', 
    icon: <XCircle className="h-5 w-5" />,
    description: 'Performance abaixo do esperado estatisticamente.'
  },
};

const alertIcons: Record<AlertType, React.ReactNode> = {
  info: <Info className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  success: <CheckCircle className="h-4 w-4" />,
  danger: <XOctagon className="h-4 w-4" />,
};

const alertColors: Record<AlertType, string> = {
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600',
  success: 'bg-green-500/10 border-green-500/30 text-green-600',
  danger: 'bg-red-500/10 border-red-500/30 text-red-600',
};

export function MethodAnalysisDetail({ data, aiRecommendation, aiLoading }: MethodAnalysisDetailProps) {
  const { phase, scores, stats, methodName, alerts, evolutionByBlocks, contextAnalysis } = data;
  const config = phaseConfig[phase];

  const breakevenRate = stats.avgOdd > 1 ? (1 / stats.avgOdd) * 100 : 50;

  return (
    <div className="space-y-6">
      {/* Phase Banner */}
      <Card className={cn("border-2", config.color)}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn("p-3 rounded-full", config.color.split(' ')[1])}>
            {config.icon}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{methodName}</h2>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
          <Badge variant="outline" className={cn("text-lg px-4 py-2", config.color)}>
            {phase}
          </Badge>
        </CardContent>
      </Card>

      {/* Scores Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Confidence Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Confidence Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{scores.confidence}</span>
                <span className="text-muted-foreground">/100</span>
              </div>
              <Progress value={scores.confidence} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Baseado em volume ({stats.totalOperations} ops) e consistência
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Risk Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500" />
              Risk Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{scores.risk}</span>
                <span className="text-muted-foreground">/100</span>
              </div>
              <Progress value={scores.risk} className="h-2 [&>div]:bg-red-500" />
              <p className="text-xs text-muted-foreground">
                Drawdown: {stats.maxDrawdown.toFixed(1)}st | Odd média: {stats.avgOdd.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Edge Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-green-500" />
              Edge Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-3xl font-bold",
                  scores.edge > 10 ? "text-green-500" : scores.edge < -10 ? "text-red-500" : "text-yellow-500"
                )}>
                  {scores.edge > 0 ? '+' : ''}{scores.edge}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all",
                    scores.edge >= 0 ? "bg-green-500" : "bg-red-500"
                  )}
                  style={{ 
                    width: `${Math.min(100, Math.abs(scores.edge))}%`,
                    marginLeft: scores.edge < 0 ? `${100 - Math.min(100, Math.abs(scores.edge))}%` : undefined
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                WR: {stats.winRate.toFixed(1)}% vs Breakeven: {breakevenRate.toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estatísticas Gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{stats.totalOperations}</p>
              <p className="text-xs text-muted-foreground">Operações</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-green-500">{stats.greens}</p>
              <p className="text-xs text-muted-foreground">Greens</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-red-500">{stats.reds}</p>
              <p className="text-xs text-muted-foreground">Reds</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className={cn("text-2xl font-bold", stats.roi >= 0 ? "text-green-500" : "text-red-500")}>
                {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">ROI</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{stats.activeDays}</p>
              <p className="text-xs text-muted-foreground">Dias Ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Alertas Inteligentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map(alert => (
              <div 
                key={alert.id} 
                className={cn("p-3 rounded-lg border flex items-start gap-3", alertColors[alert.type])}
              >
                <div className="mt-0.5">{alertIcons[alert.type]}</div>
                <div>
                  <p className="font-medium">{alert.title}</p>
                  <p className="text-sm opacity-80">{alert.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI Recommendation */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Recomendação da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aiLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : aiRecommendation ? (
            <div className="space-y-3">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-lg px-4 py-2",
                  aiRecommendation.action === 'Continuar' && "bg-green-500/10 text-green-600 border-green-500/30",
                  aiRecommendation.action === 'Pausar' && "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
                  aiRecommendation.action === 'Ajustar' && "bg-blue-500/10 text-blue-600 border-blue-500/30",
                  aiRecommendation.action === 'Encerrar' && "bg-red-500/10 text-red-600 border-red-500/30",
                )}
              >
                {aiRecommendation.action}
              </Badge>
              <p className="text-sm text-muted-foreground">{aiRecommendation.explanation}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Clique em "Análise de IA" para gerar uma recomendação personalizada baseada nos seus dados.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Evolution Chart */}
      {evolutionByBlocks.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução por Blocos de 10 Operações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionByBlocks}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="block" 
                    tickFormatter={(v) => `Bloco ${v}`}
                    className="text-xs"
                  />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'winRate' ? `${value.toFixed(1)}%` : `${value.toFixed(2)}st`,
                      name === 'winRate' ? 'Win Rate' : 'Lucro'
                    ]}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="winRate" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="profit" 
                    stroke="hsl(142.1 76.2% 36.3%)" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(142.1 76.2% 36.3%)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Context Analysis */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By League */}
        {contextAnalysis.byLeague.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance por Liga</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {contextAnalysis.byLeague.map(league => (
                  <div key={league.league} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{league.league}</p>
                      <p className="text-xs text-muted-foreground">{league.operations} ops</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{league.winRate.toFixed(1)}%</p>
                      <p className={cn("text-xs", league.profit >= 0 ? "text-green-500" : "text-red-500")}>
                        {league.profit >= 0 ? '+' : ''}{league.profit.toFixed(1)}st
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* By Odd Range */}
        {contextAnalysis.byOddRange.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance por Faixa de Odd</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contextAnalysis.byOddRange}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="range" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))' 
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Win Rate']}
                    />
                    <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                      {contextAnalysis.byOddRange.map((entry, index) => (
                        <Cell 
                          key={index} 
                          fill={entry.winRate >= breakevenRate ? 'hsl(142.1 76.2% 36.3%)' : 'hsl(0 84.2% 60.2%)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
