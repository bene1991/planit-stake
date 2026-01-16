import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Game, Method } from '@/types';
import { TeamGamesModal } from './TeamGamesModal';

export interface TeamStats {
  team: string;
  gamesCount: number;
  operations: number;
  greens: number;
  reds: number;
  winRate: number;
  profit: number;
}

interface TeamStatsChartProps {
  data: TeamStats[];
  games?: Game[];
  methods?: Method[];
}

export function TeamStatsChart({ data, games, methods }: TeamStatsChartProps) {
  const [showAll, setShowAll] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const displayData = showAll ? data : data.slice(0, 10);
  const chartHeight = Math.max(200, displayData.length * 36);

  const getBarColor = (winRate: number) => {
    if (winRate >= 60) return 'hsl(var(--chart-2))'; // Green
    if (winRate >= 50) return 'hsl(var(--chart-4))'; // Yellow
    return 'hsl(var(--destructive))'; // Red
  };

  const chartConfig = {
    winRate: {
      label: 'Win Rate',
    },
  };

  const handleBarClick = (data: TeamStats) => {
    if (games && methods) {
      setSelectedTeam(data.team);
    }
  };

  const handleYAxisClick = (team: string) => {
    if (games && methods) {
      setSelectedTeam(team);
    }
  };

  return (
    <>
      <Card className="p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Estatísticas por Time</h3>
          </div>
          <Badge variant="outline">{data.length} times</Badge>
        </div>

        {games && methods && (
          <p className="mb-4 text-sm text-muted-foreground">
            Clique em um time para ver detalhes
          </p>
        )}

        {displayData.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            Nenhum time com 2+ jogos no período
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={displayData}
                  layout="vertical"
                  margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="team"
                    width={120}
                    tick={({ x, y, payload }) => (
                      <text
                        x={x}
                        y={y}
                        dy={4}
                        textAnchor="end"
                        fill="currentColor"
                        fontSize={12}
                        className={games && methods ? 'cursor-pointer hover:fill-primary' : ''}
                        onClick={() => handleYAxisClick(payload.value)}
                      >
                        {payload.value.length > 15 ? `${payload.value.slice(0, 15)}...` : payload.value}
                      </text>
                    )}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, item) => {
                          const stat = item.payload as TeamStats;
                          return (
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{stat.team}</span>
                              <span>Win Rate: {stat.winRate.toFixed(1)}%</span>
                              <span className="text-green-500">Greens: {stat.greens}</span>
                              <span className="text-red-500">Reds: {stat.reds}</span>
                              <span>Operações: {stat.operations}</span>
                              <span>Jogos: {stat.gamesCount}</span>
                              {stat.profit !== 0 && (
                                <span className={stat.profit >= 0 ? 'text-green-500' : 'text-red-500'}>
                                  Lucro: {stat.profit >= 0 ? '+' : ''}{stat.profit.toFixed(2)} stakes
                                </span>
                              )}
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="winRate"
                    radius={[0, 4, 4, 0]}
                    onClick={(data) => handleBarClick(data)}
                    className={games && methods ? 'cursor-pointer' : ''}
                  >
                    {displayData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.winRate)} />
                    ))}
                    <LabelList
                      dataKey="winRate"
                      position="right"
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      style={{ fontSize: 11, fill: 'currentColor' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                  <span>≥60% WR</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-4))' }} />
                  <span>50-60% WR</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(var(--destructive))' }} />
                  <span>&lt;50% WR</span>
                </div>
              </div>
              {data.length > 10 && (
                <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
                  {showAll ? 'Ver top 10' : `Ver todos (${data.length})`}
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      {selectedTeam && games && methods && (
        <TeamGamesModal
          team={selectedTeam}
          games={games}
          methods={methods}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </>
  );
}
