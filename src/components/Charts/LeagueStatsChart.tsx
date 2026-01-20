import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { LeagueGamesModal } from './LeagueGamesModal';
import { Game, Method } from '@/types';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { LeagueStats } from '@/hooks/useFilteredStatistics';
import { cn } from '@/lib/utils';

interface LeagueStatsChartProps {
  data: LeagueStats[];
  games?: Game[];
  methods?: Method[];
}

export function LeagueStatsChart({ data, games = [], methods = [] }: LeagueStatsChartProps) {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Mostrar todas ou top 10
  const displayLeagues = showAll ? data : data.slice(0, 10);
  const hasMore = data.length > 10;

  // Altura dinâmica baseada no número de ligas
  const chartHeight = Math.max(300, displayLeagues.length * 40);

  // Cor baseada no win rate
  const getColor = (winRate: number) => {
    if (winRate >= 60) return 'hsl(142 76% 36%)'; // Verde
    if (winRate >= 50) return 'hsl(45 93% 47%)'; // Amarelo
    return 'hsl(0 72% 51%)'; // Vermelho
  };

  // Get games for selected league
  const leagueGames = games.filter(g => g.league === selectedLeague);
  const leagueStats = data.find(d => d.league === selectedLeague);

  const handleBarClick = (leagueName: string) => {
    if (games.length > 0 && methods.length > 0) {
      setSelectedLeague(leagueName);
    }
  };

  return (
    <>
      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">
            Performance por Liga
            {games.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                (clique para ver jogos)
              </span>
            )}
          </h3>
          <span className="text-sm text-muted-foreground">
            {data.length} ligas
          </span>
        </div>
        {displayLeagues.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Nenhuma estatística disponível
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={displayLeagues} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} className="text-xs" />
                <YAxis 
                  dataKey="league" 
                  type="category" 
                  width={150} 
                  className="text-xs"
                  tick={{ fontSize: 11, cursor: games.length > 0 ? 'pointer' : 'default' }}
                  onClick={(e: any) => {
                    if (e && e.value) {
                      handleBarClick(e.value);
                    }
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as LeagueStats;
                      return (
                        <div className="rounded-lg border bg-card p-3 shadow-lg">
                          <p className="font-semibold">{data.league}</p>
                          <p className="text-sm">
                            Win Rate: <span className="font-bold">{data.winRate}%</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {data.total} operações • {data.greens}G / {data.reds}R
                          </p>
                          {data.averageOdd > 0 && (
                            <p className="text-sm">
                              Odd Média: <span className="font-bold">{data.averageOdd.toFixed(2)}</span>
                            </p>
                          )}
                          <p className={cn(
                            "text-sm font-bold",
                            data.profit >= 0 ? "text-emerald-500" : "text-red-500"
                          )}>
                            Lucro: {data.profit >= 0 ? '+' : ''}{data.profit.toFixed(2)} stakes
                          </p>
                          {games.length > 0 && (
                            <p className="text-xs text-primary mt-1">Clique para ver jogos</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="winRate" 
                  radius={[0, 4, 4, 0]}
                  cursor={games.length > 0 ? 'pointer' : 'default'}
                  onClick={(data) => handleBarClick(data.league)}
                >
                  {displayLeagues.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getColor(entry.winRate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(142 76% 36%)' }} />
                  <span className="text-muted-foreground">≥ 60% Win Rate</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(45 93% 47%)' }} />
                  <span className="text-muted-foreground">50-60% Win Rate</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'hsl(0 72% 51%)' }} />
                  <span className="text-muted-foreground">&lt; 50% Win Rate</span>
                </div>
              </div>
              
              {hasMore && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAll(!showAll)}
                  className="text-primary"
                >
                  {showAll ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Ver todas ({data.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      {/* League Games Modal */}
      {selectedLeague && leagueStats && (
        <LeagueGamesModal
          open={!!selectedLeague}
          onOpenChange={(open) => !open && setSelectedLeague(null)}
          league={selectedLeague}
          games={leagueGames}
          methods={methods}
          stats={{
            total: leagueStats.total,
            greens: leagueStats.greens,
            reds: leagueStats.reds,
            winRate: leagueStats.winRate,
            profit: leagueStats.profit,
            averageOdd: leagueStats.averageOdd,
          }}
        />
      )}
    </>
  );
}
