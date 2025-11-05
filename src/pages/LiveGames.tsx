import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { updateGameStatuses } from '@/utils/gameStatus';
import { Game } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PressureChart } from '@/components/LiveStats/PressureChart';
import { StatsComparison } from '@/components/LiveStats/StatsComparison';
import { EventTimeline } from '@/components/LiveStats/EventTimeline';
import { useLiveStats } from '@/hooks/useLiveStats';
import { FixtureLinker } from '@/components/LiveStats/FixtureLinker';

export default function LiveGames() {
  const { games, loading, refreshGames } = useSupabaseGames();
  const [liveGames, setLiveGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const updateStatuses = async () => {
    if (games.length === 0) return;
    
    const updatedGames = updateGameStatuses(games);
    const gamesLive = updatedGames.filter(game => game.status === 'Live');
    setLiveGames(gamesLive);
    
    // Auto-select first live game if none selected
    if (!selectedGameId && gamesLive.length > 0) {
      setSelectedGameId(gamesLive[0].id);
    }
  };

  useEffect(() => {
    updateStatuses();
  }, [games]);

  // Auto-update every 30 seconds
  useEffect(() => {
    const interval = setInterval(updateStatuses, 30000);
    return () => clearInterval(interval);
  }, [games]);

  const handleRefresh = async () => {
    await refreshGames();
    toast.success('Jogos atualizados!');
  };

  const selectedGame = liveGames.find(g => g.id === selectedGameId);
  const { stats } = useLiveStats(selectedGame?.api_fixture_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando jogos ao vivo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🔴 Jogos Ao Vivo</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe seus jogos em andamento
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {liveGames.length > 0 ? (
        <Tabs value={selectedGameId || undefined} onValueChange={setSelectedGameId} className="space-y-6">
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
            {liveGames.map((game) => (
              <TabsTrigger key={game.id} value={game.id} className="whitespace-nowrap">
                {game.homeTeam} vs {game.awayTeam}
              </TabsTrigger>
            ))}
          </TabsList>

          {liveGames.map((game) => (
            <TabsContent key={game.id} value={game.id} className="space-y-6">
              {/* Game Header */}
              <Card className="p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{game.league}</span>
                      <FixtureLinker
                        gameId={game.id}
                        gameDate={game.date}
                        homeTeam={game.homeTeam}
                        awayTeam={game.awayTeam}
                        currentFixtureId={game.api_fixture_id}
                        onLinked={() => {
                          refreshGames();
                          updateStatuses();
                        }}
                      />
                    </div>
                    <Badge variant="default" className="bg-red-500 animate-pulse">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        <span className="text-xs">AO VIVO</span>
                      </span>
                    </Badge>
                  </div>

                  {/* Teams */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    <div className="flex flex-col items-center gap-3">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={game.homeTeamLogo} alt={game.homeTeam} />
                        <AvatarFallback>
                          <Shield className="h-10 w-10" />
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-lg font-semibold text-center">{game.homeTeam}</h3>
                    </div>

                    <div className="flex items-center justify-center">
                      <span className="text-4xl font-bold text-muted-foreground">VS</span>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={game.awayTeamLogo} alt={game.awayTeam} />
                        <AvatarFallback>
                          <Shield className="h-10 w-10" />
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-lg font-semibold text-center">{game.awayTeam}</h3>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <span>{new Date(`${game.date}T${game.time}`).toLocaleDateString('pt-BR')}</span>
                    <span>•</span>
                    <span>{game.time}</span>
                  </div>

                  {/* Operations */}
                  {game.methodOperations && game.methodOperations.length > 0 && (
                    <div className="pt-4 border-t space-y-2">
                      <h4 className="text-sm font-semibold">Operações:</h4>
                      <div className="flex flex-wrap gap-2">
                        {game.methodOperations.map((op, idx) => (
                          <Badge key={idx} variant={op.result === 'Green' ? 'default' : op.result === 'Red' ? 'destructive' : 'outline'}>
                            Operação {idx + 1}: {op.result || 'Em andamento'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {game.notes && (
                    <p className="text-sm text-muted-foreground pt-4 border-t">
                      {game.notes}
                    </p>
                  )}
                </div>
              </Card>

              {/* Live Statistics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PressureChart
                  homeTeam={game.homeTeam}
                  awayTeam={game.awayTeam}
                  homePossession={stats?.homePossession}
                  awayPossession={stats?.awayPossession}
                  homeShots={stats?.homeShots}
                  awayShots={stats?.awayShots}
                  homeShotsOnTarget={stats?.homeShotsOnTarget}
                  awayShotsOnTarget={stats?.awayShotsOnTarget}
                />

                <StatsComparison
                  homeTeam={game.homeTeam}
                  awayTeam={game.awayTeam}
                  stats={[
                    { label: 'Escanteios', home: stats?.homeCorners || 0, away: stats?.awayCorners || 0 },
                    { label: 'Faltas', home: stats?.homeFouls || 0, away: stats?.awayFouls || 0 },
                    { label: 'Cartões Amarelos', home: stats?.homeYellowCards || 0, away: stats?.awayYellowCards || 0 },
                    { label: 'Cartões Vermelhos', home: stats?.homeRedCards || 0, away: stats?.awayRedCards || 0 },
                  ]}
                />
              </div>

              <EventTimeline events={[]} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <EmptyState
          icon={<RefreshCw className="h-6 w-6" />}
          title="Nenhum jogo ao vivo"
          description="Não há jogos acontecendo agora no seu planejamento."
        />
      )}

      <div className="text-center text-sm text-muted-foreground">
        Atualização automática a cada 30 segundos
      </div>
    </div>
  );
}
