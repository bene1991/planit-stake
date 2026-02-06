import { ChevronRight, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock, XCircle, Shield, Timer, BarChart2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MethodAnalysisData, MethodPhase } from "@/hooks/useMethodAnalysis";
import { cn } from "@/lib/utils";

interface MethodAnalysisCardProps {
  data: MethodAnalysisData;
  onClick: () => void;
}

const phaseConfig: Record<MethodPhase, { color: string; icon: React.ReactNode; bgClass: string }> = {
  'Em Validação': { 
    color: 'text-blue-500', 
    icon: <Clock className="h-3 w-3" />,
    bgClass: 'bg-blue-500/10 border-blue-500/20'
  },
  'Sinal Fraco': { 
    color: 'text-yellow-500', 
    icon: <AlertCircle className="h-3 w-3" />,
    bgClass: 'bg-yellow-500/10 border-yellow-500/20'
  },
  'Validado': { 
    color: 'text-green-500', 
    icon: <CheckCircle2 className="h-3 w-3" />,
    bgClass: 'bg-green-500/10 border-green-500/20'
  },
  'Reprovado': { 
    color: 'text-red-500', 
    icon: <XCircle className="h-3 w-3" />,
    bgClass: 'bg-red-500/10 border-red-500/20'
  },
};

export function MethodAnalysisCard({ data, onClick }: MethodAnalysisCardProps) {
  const { phase, scores, stats, methodName, alerts } = data;
  const config = phaseConfig[phase];
  const hasAlerts = alerts.filter(a => a.type === 'danger' || a.type === 'warning').length > 0;

  const edgeColor = scores.edge > 10 
    ? 'text-green-500' 
    : scores.edge < -10 
      ? 'text-red-500' 
      : 'text-yellow-500';

  return (
    <Card
      className={cn(
        "p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border",
        config.bgClass
      )}
      onClick={onClick}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{methodName}</h3>
            <Badge variant="outline" className={cn("mt-1 gap-1", config.color)}>
              {config.icon}
              {phase}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            {hasAlerts && <AlertCircle className="h-4 w-4 text-yellow-500" />}
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Operações</p>
            <p className="font-semibold">{stats.totalOperations}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className="font-semibold">{stats.winRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lucro</p>
            <p className={cn("font-semibold", stats.profitStakes >= 0 ? "text-green-500" : "text-red-500")}>
              {stats.profitStakes >= 0 ? '+' : ''}{stats.profitStakes.toFixed(1)}st
            </p>
          </div>
        </div>

        {/* Scores */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Confiança</span>
            <span className="font-medium">{scores.confidence}/100</span>
          </div>
          <Progress value={scores.confidence} className="h-1.5" />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Risco</span>
            <span className="font-medium">{scores.risk}/100</span>
          </div>
          <Progress 
            value={scores.risk} 
            className="h-1.5 [&>div]:bg-red-500" 
          />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Edge</span>
            <span className={cn("font-medium", edgeColor)}>
              {scores.edge > 0 ? '+' : ''}{scores.edge}
            </span>
          </div>
        </div>

        {/* Current Streak */}
        <div className="flex items-center justify-center gap-2 text-xs">
          {stats.currentStreak.type === 'green' ? (
            <TrendingUp className="h-3 w-3 text-green-500" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <span className="text-muted-foreground">
            Sequência atual: {stats.currentStreak.count} {stats.currentStreak.type === 'green' ? 'greens' : 'reds'}
          </span>
        </div>

        {/* Validation Badges */}
        {data.validations && (
          <TooltipProvider delayDuration={300}>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <ValidationBadge
                icon={<Shield className="h-3 w-3" />}
                label={data.validations.robustness.label === 'Robusto' ? 'Robusto' : data.validations.robustness.label === 'Sensivel' ? 'Sensível' : 'Frágil'}
                level={data.validations.robustness.label === 'Robusto' ? 'good' : data.validations.robustness.label === 'Sensivel' ? 'warn' : 'bad'}
                tooltip={data.validations.robustness.label === 'Robusto' ? 'O método funciona bem em diferentes ligas e faixas de odds, sem depender de cenários específicos.' : data.validations.robustness.label === 'Sensivel' ? 'O desempenho varia conforme o contexto (liga, odds). Funciona melhor em cenários específicos.' : 'O método depende fortemente de condições específicas. Fora do cenário ideal, o desempenho cai muito.'}
              />
              <ValidationBadge
                icon={<Timer className="h-3 w-3" />}
                label={data.validations.stability.label === 'Estavel' ? 'Estável' : data.validations.stability.label === 'Oscilante' ? 'Oscilante' : 'Deterioração'}
                level={data.validations.stability.label === 'Estavel' ? 'good' : data.validations.stability.label === 'Oscilante' ? 'warn' : 'bad'}
                tooltip={data.validations.stability.label === 'Estavel' ? 'O desempenho recente é consistente com o histórico. O método mantém sua performance ao longo do tempo.' : data.validations.stability.label === 'Oscilante' ? 'Há variação entre o desempenho recente e o histórico. Requer acompanhamento.' : 'O desempenho das últimas 30 operações caiu significativamente em relação ao histórico.'}
              />
              <ValidationBadge
                icon={<BarChart2 className="h-3 w-3" />}
                label={data.validations.variance.label === 'Distribuido' ? 'Distribuído' : data.validations.variance.label === 'Concentrado' ? 'Concentrado' : 'Evento Raro'}
                level={data.validations.variance.label === 'Distribuido' ? 'good' : data.validations.variance.label === 'Concentrado' ? 'warn' : 'bad'}
                tooltip={data.validations.variance.label === 'Distribuido' ? 'O lucro é bem distribuído entre as operações. Não depende de poucos acertos grandes.' : data.validations.variance.label === 'Concentrado' ? 'Boa parte do lucro vem de poucas operações. Risco moderado de variância.' : 'O lucro depende de poucos eventos de alto retorno. Sem eles, o método seria negativo.'}
              />
            </div>
          </TooltipProvider>
        )}
      </div>
    </Card>
  );
}

function ValidationBadge({ icon, label, level, tooltip }: { icon: React.ReactNode; label: string; level: 'good' | 'warn' | 'bad'; tooltip: string }) {
  const colors = {
    good: 'bg-green-500/10 text-green-600 border-green-500/30',
    warn: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
    bad: 'bg-red-500/10 text-red-600 border-red-500/30',
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border cursor-help", colors[level])}>
          {icon}{label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-center">
        <p className="text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
