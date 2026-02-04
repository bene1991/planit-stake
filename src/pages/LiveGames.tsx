import { useEffect, useState } from 'react';
import { RefreshCw, ExternalLink, Clock, Shield, Wifi, WifiOff, Users, Globe } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PressureChart } from '@/components/LiveStats/PressureChart';
import { StatsComparison } from '@/components/LiveStats/StatsComparison';
import { EventTimeline } from '@/components/LiveStats/EventTimeline';
import { MyLiveGames } from '@/components/LiveStats/MyLiveGames';
import { AttackMomentum } from '@/components/LiveStats/AttackMomentum';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  useLiveFixtures, 
  useFixtureStatistics, 
  useFixtureEvents,
  parseStatistics,
  getStatusDisplay,
  ApiFootballFixture,
  ApiFootballEvent
} from '@/hooks/useApiFootball';

export default function LiveGames() {
  const [activeTab, setActiveTab] = useState<'my-games' | 'all-games'>('my-games');
  // OPTIMIZATION: Removed auto-refresh (was 30s) - now manual only to save API credits
  const { data: liveFixtures, loading, error, refetch, cached } = useLiveFixtures(0);
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(null);
  
  // Auto-select first fixture
  useEffect(() => {
    if (liveFixtures && liveFixtures.length > 0 && !selectedFixtureId) {
      setSelectedFixtureId(liveFixtures[0].fixture.id);
    }
  }, [liveFixtures, selectedFixtureId]);

  const selectedFixture = liveFixtures?.find(f => f.fixture.id === selectedFixtureId);
  
  // Fetch statistics and events for selected fixture (MANUAL ONLY - no auto-refresh)
  const { data: statsData } = useFixtureStatistics(selectedFixtureId?.toString(), 0);
  const { data: eventsData } = useFixtureEvents(selectedFixtureId?.toString(), 0);
  
  const stats = parseStatistics(statsData || null);

  const handleRefresh = () => {
    refetch();
    toast.success('Jogos atualizados!');
  };

  // Convert events to timeline format
  const getTimelineEvents = (fixture: ApiFootballFixture | undefined, events: ApiFootballEvent[]) => {
    if (!fixture || !events) return [];
    return events.map((event) => ({
      time: `${event.time.elapsed}${event.time.extra ? `+${event.time.extra}` : ''}`,
      team: (event.team.id === fixture.teams.home.id ? 'home' : 'away') as 'home' | 'away',
      type: event.type.toLowerCase() as 'goal' | 'yellow' | 'red' | 'substitution' | 'shot',
      description: `${event.player.name}${event.assist.name ? ` (${event.assist.name})` : ''} - ${event.detail}`,
    }));
  };

  // Generate SofaScore search URL
  const getSofaScoreUrl = (fixture: ApiFootballFixture) => {
    const query = `${fixture.teams.home.name} ${fixture.teams.away.name}`;
    return `https://www.sofascore.com/search?q=${encodeURIComponent(query)}`;
  };

  // Generate FlashScore search URL
  const getFlashScoreUrl = (fixture: ApiFootballFixture) => {
    const query = `${fixture.teams.home.name} ${fixture.teams.away.name}`;
    return `https://www.flashscore.com/search/?q=${encodeURIComponent(query)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            Jogos Ao Vivo
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Acompanhe seus jogos em tempo real
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my-games' | 'all-games')}>
        <TabsList className="w-full grid grid-cols-2 mb-6">
          <TabsTrigger value="my-games" className="gap-2">
            <Users className="h-4 w-4" />
            <span>Meus Jogos</span>
          </TabsTrigger>
          <TabsTrigger value="all-games" className="gap-2">
            <Globe className="h-4 w-4" />
            <span>Todos ({liveFixtures?.length || 0})</span>
          </TabsTrigger>
        </TabsList>

        {/* My Games Tab */}
        <TabsContent value="my-games">
          <MyLiveGames />
        </TabsContent>

        {/* All Games Tab */}
        <TabsContent value="all-games">
          {loading && !liveFixtures ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Buscando jogos ao vivo...</p>
              </div>
            </div>
          ) : error ? (
            <Card className="p-6 border-destructive">
              <p className="text-destructive">Erro ao buscar jogos: {error}</p>
              <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-4">
                Tentar Novamente
              </Button>
            </Card>
          ) : liveFixtures && liveFixtures.length > 0 ? (
            <Tabs 
              value={selectedFixtureId?.toString()} 
              onValueChange={(v) => setSelectedFixtureId(Number(v))} 
              className="space-y-6"
            >
              <TabsList className="w-full overflow-x-auto flex-nowrap justify-start bg-secondary/50 h-auto py-2">
                {liveFixtures.map((fixture) => {
                  const statusInfo = getStatusDisplay(fixture.fixture.status);
                  return (
                    <TabsTrigger 
                      key={fixture.fixture.id} 
                      value={fixture.fixture.id.toString()} 
                      className="whitespace-nowrap data-[state=active]:bg-primary px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          statusInfo.isLive ? "bg-green-500 animate-pulse" : "bg-gray-400"
                        )} />
                        <span className="text-xs max-w-[80px] truncate">{fixture.teams.home.name}</span>
                        <span className="font-bold text-xs">
                          {fixture.goals.home ?? 0}-{fixture.goals.away ?? 0}
                        </span>
                        <span className="text-xs max-w-[80px] truncate">{fixture.teams.away.name}</span>
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {liveFixtures.map((fixture) => {
                const statusInfo = getStatusDisplay(fixture.fixture.status);
                const isSelected = fixture.fixture.id === selectedFixtureId;
                
                return (
                  <TabsContent key={fixture.fixture.id} value={fixture.fixture.id.toString()} className="space-y-6">
                    {/* Main Game Card */}
                    <Card className={cn(
                      "p-4 lg:p-6 relative overflow-hidden",
                      statusInfo.isLive && "border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.15)]"
                    )}>
                      {/* Status Badge */}
                      <div className="absolute top-3 right-3 lg:top-4 lg:right-4">
                        <Badge 
                          variant="default" 
                          className={cn(
                            "font-bold text-xs",
                            statusInfo.isLive && "bg-green-500 hover:bg-green-600 animate-pulse"
                          )}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {fixture.fixture.status.elapsed ? `${fixture.fixture.status.elapsed}'` : ''} {statusInfo.label}
                        </Badge>
                      </div>

                      {/* League Info */}
                      <div className="flex items-center gap-2 mb-4 lg:mb-6">
                        <Avatar className="h-5 w-5 lg:h-6 lg:w-6">
                          <AvatarImage src={fixture.league.logo} alt={fixture.league.name} />
                          <AvatarFallback className="text-[8px]">{fixture.league.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs lg:text-sm text-muted-foreground">
                          {fixture.league.name} • {fixture.league.country}
                        </span>
                      </div>

                      {/* Teams and Score */}
                      <div className="grid grid-cols-3 gap-2 lg:gap-8 items-center">
                        {/* Home Team */}
                        <div className="flex flex-col items-center gap-2">
                          <Avatar className="h-16 w-16 lg:h-24 lg:w-24 border-2 border-border">
                            <AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} />
                            <AvatarFallback>
                              <Shield className="h-8 w-8 lg:h-12 lg:w-12" />
                            </AvatarFallback>
                          </Avatar>
                          <h3 className="text-xs lg:text-lg font-bold text-center line-clamp-2">{fixture.teams.home.name}</h3>
                        </div>

                        {/* Score */}
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2 lg:gap-4">
                            <span className={cn(
                              "text-4xl lg:text-6xl font-black",
                              fixture.teams.home.winner && "text-green-500"
                            )}>
                              {fixture.goals.home ?? 0}
                            </span>
                            <span className="text-2xl lg:text-4xl font-bold text-muted-foreground">:</span>
                            <span className={cn(
                              "text-4xl lg:text-6xl font-black",
                              fixture.teams.away.winner && "text-green-500"
                            )}>
                              {fixture.goals.away ?? 0}
                            </span>
                          </div>
                          
                          {/* Halftime Score */}
                          {fixture.score.halftime.home !== null && (
                            <p className="text-xs text-muted-foreground">
                              HT: {fixture.score.halftime.home} - {fixture.score.halftime.away}
                            </p>
                          )}

                          {/* Minutage */}
                          {fixture.fixture.status.elapsed && statusInfo.isLive && (
                            <div className="flex items-center gap-2 text-green-500">
                              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-xl lg:text-2xl font-bold animate-pulse">
                                {fixture.fixture.status.elapsed}'
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Away Team */}
                        <div className="flex flex-col items-center gap-2">
                          <Avatar className="h-16 w-16 lg:h-24 lg:w-24 border-2 border-border">
                            <AvatarImage src={fixture.teams.away.logo} alt={fixture.teams.away.name} />
                            <AvatarFallback>
                              <Shield className="h-8 w-8 lg:h-12 lg:w-12" />
                            </AvatarFallback>
                          </Avatar>
                          <h3 className="text-xs lg:text-lg font-bold text-center line-clamp-2">{fixture.teams.away.name}</h3>
                        </div>
                      </div>

                      {/* Quick Links */}
                      <div className="flex items-center justify-center gap-2 lg:gap-4 mt-4 lg:mt-6 pt-4 lg:pt-6 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => window.open(getSofaScoreUrl(fixture), '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1 lg:mr-2" />
                          <span className="hidden sm:inline">Ver no</span> SofaScore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => window.open(getFlashScoreUrl(fixture), '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1 lg:mr-2" />
                          <span className="hidden sm:inline">Ver no</span> FlashScore
                        </Button>
                      </div>
                    </Card>

                    {/* Attack Momentum Chart */}
                    {isSelected && eventsData && (
                      <AttackMomentum
                        homeTeam={fixture.teams.home.name}
                        awayTeam={fixture.teams.away.name}
                        homeTeamId={fixture.teams.home.id}
                        awayTeamId={fixture.teams.away.id}
                        events={eventsData}
                        statistics={stats}
                        currentMinute={fixture.fixture.status.elapsed || 0}
                      />
                    )}

                    {/* Live Statistics */}
                    {isSelected && stats && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                        <PressureChart
                          homeTeam={fixture.teams.home.name}
                          awayTeam={fixture.teams.away.name}
                          homePossession={stats.homePossession}
                          awayPossession={stats.awayPossession}
                          homeShots={stats.homeShots}
                          awayShots={stats.awayShots}
                          homeShotsOnTarget={stats.homeShotsOnTarget}
                          awayShotsOnTarget={stats.awayShotsOnTarget}
                        />

                        <StatsComparison
                          homeTeam={fixture.teams.home.name}
                          awayTeam={fixture.teams.away.name}
                          stats={[
                            { label: 'Escanteios', home: stats.homeCorners, away: stats.awayCorners },
                            { label: 'Faltas', home: stats.homeFouls, away: stats.awayFouls },
                            { label: 'Cartões Amarelos', home: stats.homeYellowCards, away: stats.awayYellowCards },
                            { label: 'Cartões Vermelhos', home: stats.homeRedCards, away: stats.awayRedCards },
                            { label: 'Impedimentos', home: stats.homeOffsides, away: stats.awayOffsides },
                          ]}
                        />
                      </div>
                    )}

                    {/* Event Timeline */}
                    {isSelected && eventsData && eventsData.length > 0 && (
                      <EventTimeline events={getTimelineEvents(fixture, eventsData)} />
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <EmptyState
              icon={<WifiOff className="h-6 w-6" />}
              title="Nenhum jogo ao vivo"
              description="Não há jogos acontecendo agora. Volte mais tarde!"
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-center text-xs lg:text-sm text-muted-foreground flex items-center justify-center gap-2">
        <RefreshCw className="h-3 w-3 lg:h-4 lg:w-4" />
        Clique em "Atualizar" para buscar dados atualizados
      </div>
    </div>
  );
}

