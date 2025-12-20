import { useMemo, useState } from 'react';
import { ApiFootballEvent } from '@/hooks/useApiFootball';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import { RefreshCw } from 'lucide-react';

interface AttackMomentumProps {
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  events: ApiFootballEvent[];
  statistics?: {
    homePossession?: number;
    awayPossession?: number;
    homeShots?: number;
    awayShots?: number;
    homeShotsOnTarget?: number;
    awayShotsOnTarget?: number;
    homeCorners?: number;
    awayCorners?: number;
    homeFouls?: number;
    awayFouls?: number;
  } | null;
  currentMinute?: number;
  fixtureId?: number;
  onFetchDetails?: (fixtureId: number) => Promise<{ success: boolean; statistics?: any; events?: ApiFootballEvent[] }>;
}

interface MomentumPoint {
  minute: number;
  home: number;
  away: number;
  events: { type: string; team: 'home' | 'away'; player?: string }[];
}

// Pontos de pressão por tipo de evento
const EVENT_WEIGHTS: Record<string, number> = {
  'Goal': 15,
  'Penalty - Scored': 15,
  'Own Goal': 15,
  'Missed Penalty': 8,
  'Penalty - Missed': 8,
  'Shot on Target': 6,
  'Shot off Target': 3,
  'Corner': 4,
  'Foul': 2,
  'Yellow Card': 3,
  'Red Card': 5,
  'subst': 1,
};

function getEventWeight(type: string, detail?: string): number {
  // Checar detalhes específicos primeiro
  if (detail) {
    const fullKey = `${type} - ${detail}`;
    if (EVENT_WEIGHTS[fullKey]) return EVENT_WEIGHTS[fullKey];
    if (EVENT_WEIGHTS[detail]) return EVENT_WEIGHTS[detail];
  }
  return EVENT_WEIGHTS[type] || 2;
}

export function AttackMomentum({
  homeTeam,
  awayTeam,
  homeTeamId,
  awayTeamId,
  events,
  statistics,
  currentMinute = 90,
  fixtureId,
  onFetchDetails
}: AttackMomentumProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Se não há eventos nem estatísticas, mostrar mensagem de aguardando
  const hasData = (events && events.length > 0) || (statistics && (statistics.homePossession || statistics.homeShots));

  const handleFetchData = async () => {
    if (!fixtureId || !onFetchDetails) return;
    setIsLoading(true);
    try {
      await onFetchDetails(fixtureId);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Calcular momentum baseado em eventos
  const momentumData = useMemo(() => {
    // Criar intervalos de 5 minutos
    const intervals: MomentumPoint[] = [];
    const maxMinute = Math.min(currentMinute, 95);
    
    for (let i = 0; i <= maxMinute; i += 5) {
      intervals.push({
        minute: i,
        home: 0,
        away: 0,
        events: []
      });
    }

    // Se não há eventos, usar estatísticas para distribuição base
    if (events.length === 0 && statistics) {
      const baseHomePressure = (statistics.homePossession || 50) / 100;
      const baseAwayPressure = (statistics.awayPossession || 50) / 100;
      
      intervals.forEach((point, idx) => {
        // Adicionar variação aleatória mas determinística baseada no minuto
        const variance = Math.sin(point.minute * 0.5) * 0.3;
        point.home = (baseHomePressure + variance) * 10;
        point.away = (baseAwayPressure - variance) * 10;
      });
      
      return intervals;
    }

    // Processar eventos
    events.forEach(event => {
      const minute = event.time.elapsed;
      const intervalIndex = Math.floor(minute / 5);
      
      if (intervalIndex >= 0 && intervalIndex < intervals.length) {
        const isHomeTeam = homeTeamId ? event.team.id === homeTeamId : event.team.name === homeTeam;
        const weight = getEventWeight(event.type, event.detail);
        
        if (isHomeTeam) {
          intervals[intervalIndex].home += weight;
          intervals[intervalIndex].events.push({
            type: event.type,
            team: 'home',
            player: event.player?.name
          });
        } else {
          intervals[intervalIndex].away += weight;
          intervals[intervalIndex].events.push({
            type: event.type,
            team: 'away',
            player: event.player?.name
          });
        }
      }
    });

    // Aplicar suavização (média móvel)
    const smoothed = intervals.map((point, idx) => {
      const prevIdx = Math.max(0, idx - 1);
      const nextIdx = Math.min(intervals.length - 1, idx + 1);
      
      return {
        ...point,
        home: (intervals[prevIdx].home + point.home * 2 + intervals[nextIdx].home) / 4,
        away: (intervals[prevIdx].away + point.away * 2 + intervals[nextIdx].away) / 4,
      };
    });

    // Normalizar valores
    const maxValue = Math.max(
      ...smoothed.map(p => Math.max(p.home, p.away)),
      1
    );

    return smoothed.map(point => ({
      ...point,
      home: (point.home / maxValue) * 10,
      away: -(point.away / maxValue) * 10, // Negativo para ficar abaixo
    }));
  }, [events, statistics, homeTeam, awayTeam, homeTeamId, awayTeamId, currentMinute]);

  // Encontrar gols para marcar no gráfico
  const goals = useMemo(() => {
    return events
      .filter(e => e.type === 'Goal' || e.detail?.includes('Goal'))
      .map(e => ({
        minute: e.time.elapsed,
        team: homeTeamId ? (e.team.id === homeTeamId ? 'home' : 'away') : (e.team.name === homeTeam ? 'home' : 'away'),
        player: e.player?.name
      }));
  }, [events, homeTeam, homeTeamId]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const homeVal = Math.abs(payload.find((p: any) => p.dataKey === 'home')?.value || 0);
      const awayVal = Math.abs(payload.find((p: any) => p.dataKey === 'away')?.value || 0);
      const point = momentumData.find(p => p.minute === label);
      
      return (
        <div className="bg-background/95 border border-border rounded-lg p-2 shadow-lg text-xs">
          <p className="font-medium text-foreground mb-1">{label}'</p>
          {homeVal > 0 && (
            <p className="text-emerald-500">
              {homeTeam}: {homeVal.toFixed(1)}
            </p>
          )}
          {awayVal > 0 && (
            <p className="text-rose-500">
              {awayTeam}: {awayVal.toFixed(1)}
            </p>
          )}
          {point?.events && point.events.length > 0 && (
            <div className="mt-1 pt-1 border-t border-border/50">
              {point.events.slice(0, 3).map((e, i) => (
                <p key={i} className="text-muted-foreground truncate">
                  {e.type === 'Goal' ? '⚽' : e.type === 'Card' ? '🟨' : '•'} {e.player}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Mostrar estado de carregamento se não há dados
  if (!hasData) {
    return (
      <Card className="p-3 bg-card/50">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-muted-foreground">Attack Momentum</h4>
        </div>
        <div className="h-[80px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            {isLoading ? (
              <>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-75" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-150" />
                </div>
                <span className="text-xs text-muted-foreground">Carregando...</span>
              </>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">Sem dados de momentum</span>
                {fixtureId && onFetchDetails && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleFetchData}
                    className="h-7 text-xs gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Buscar dados
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 bg-card/50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-muted-foreground">Attack Momentum</h4>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {homeTeam}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            {awayTeam}
          </span>
        </div>
      </div>
      
      <div className="h-[120px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={momentumData}
            margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="homeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="awayGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            
            <XAxis 
              dataKey="minute" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => value % 15 === 0 ? `${value}'` : ''}
            />
            <YAxis 
              domain={[-10, 10]} 
              hide 
            />
            
            {/* Linha central */}
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            
            {/* Marcador de intervalo */}
            <ReferenceLine 
              x={45} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            
            {/* Marcadores de gols */}
            {goals.map((goal, idx) => (
              <ReferenceLine
                key={idx}
                x={Math.floor(goal.minute / 5) * 5}
                stroke={goal.team === 'home' ? '#10b981' : '#f43f5e'}
                strokeWidth={2}
                strokeOpacity={0.8}
              />
            ))}
            
            <Tooltip content={<CustomTooltip />} />
            
            {/* Área do time da casa (positivo) */}
            <Area
              type="monotone"
              dataKey="home"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#homeGradient)"
              animationDuration={500}
            />
            
            {/* Área do time visitante (negativo) */}
            <Area
              type="monotone"
              dataKey="away"
              stroke="#f43f5e"
              strokeWidth={2}
              fill="url(#awayGradient)"
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Timeline labels */}
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1 px-1">
        <span>0'</span>
        <span>HT</span>
        <span>90'</span>
      </div>
      
      {/* Indicadores de gols */}
      {goals.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/30">
          {goals.map((goal, idx) => (
            <span 
              key={idx}
              className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                goal.team === 'home' 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              ⚽ {goal.minute}' {goal.player?.split(' ').pop()}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
