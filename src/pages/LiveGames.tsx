import { useEffect, useState } from 'react';
import { RefreshCw, ExternalLink, Clock, Shield, Wifi, WifiOff } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PressureChart } from '@/components/LiveStats/PressureChart';
import { StatsComparison } from '@/components/LiveStats/StatsComparison';
import { EventTimeline } from '@/components/LiveStats/EventTimeline';
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
  const { data: liveFixtures, loading, error, refetch, cached } = useLiveFixtures(30000);
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(null);
  
  // Auto-select first fixture
  useEffect(() => {
    if (liveFixtures && liveFixtures.length > 0 && !selectedFixtureId) {
      setSelectedFixtureId(liveFixtures[0].fixture.id);
    }
  }, [liveFixtures, selectedFixtureId]);

  const selectedFixture = liveFixtures?.find(f => f.fixture.id === selectedFixtureId);
  
  // Fetch statistics and events for selected fixture
  const { data: statsData } = useFixtureStatistics(selectedFixtureId?.toString(), 30000);
  const { data: eventsData } = useFixtureEvents(selectedFixtureId?.toString(), 30000);
  
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

  if (loading && !liveFixtures) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Buscando jogos ao vivo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              Jogos Ao Vivo
            </h1>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
        <Card className="p-6 border-destructive">
          <p className="text-destructive">Erro ao buscar jogos: {error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            Jogos Ao Vivo
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            {liveFixtures?.length || 0} jogos acontecendo agora
            {cached && (
              <Badge variant="outline" className="text-xs">
                <Wifi className="h-3 w-3 mr-1" />
                Cache
              </Badge>
            )}
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {liveFixtures && liveFixtures.length > 0 ? (
        <Tabs 
          value={selectedFixtureId?.toString()} 
          onValueChange={(v) => setSelectedFixtureId(Number(v))} 
          className="space-y-6"
        >
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start bg-secondary/50">
            {liveFixtures.map((fixture) => {
              const statusInfo = getStatusDisplay(fixture.fixture.status);
              return (
                <TabsTrigger 
                  key={fixture.fixture.id} 
                  value={fixture.fixture.id.toString()} 
                  className="whitespace-nowrap data-[state=active]:bg-primary"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-2 w-2 rounded-full",
                      statusInfo.isLive ? "bg-green-500 animate-pulse" : "bg-gray-400"
                    )} />
                    <span className="text-xs">{fixture.teams.home.name}</span>
                    <span className="font-bold">
                      {fixture.goals.home ?? 0} - {fixture.goals.away ?? 0}
                    </span>
                    <span className="text-xs">{fixture.teams.away.name}</span>
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
                  "p-6 relative overflow-hidden",
                  statusInfo.isLive && "border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.15)]"
                )}>
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    <Badge 
                      variant="default" 
                      className={cn(
                        "font-bold",
                        statusInfo.isLive && "bg-green-500 hover:bg-green-600 animate-pulse"
                      )}
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {fixture.fixture.status.elapsed ? `${fixture.fixture.status.elapsed}'` : ''} {statusInfo.label}
                    </Badge>
                  </div>

                  {/* League Info */}
                  <div className="flex items-center gap-2 mb-6">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={fixture.league.logo} alt={fixture.league.name} />
                      <AvatarFallback className="text-xs">{fixture.league.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      {fixture.league.name} • {fixture.league.country}
                    </span>
                  </div>

                  {/* Teams and Score */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    {/* Home Team */}
                    <div className="flex flex-col items-center gap-3">
                      <Avatar className="h-24 w-24 border-2 border-border">
                        <AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} />
                        <AvatarFallback>
                          <Shield className="h-12 w-12" />
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-lg font-bold text-center">{fixture.teams.home.name}</h3>
                    </div>

                    {/* Score */}
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "text-6xl font-black",
                          fixture.teams.home.winner && "text-green-500"
                        )}>
                          {fixture.goals.home ?? 0}
                        </span>
                        <span className="text-4xl font-bold text-muted-foreground">:</span>
                        <span className={cn(
                          "text-6xl font-black",
                          fixture.teams.away.winner && "text-green-500"
                        )}>
                          {fixture.goals.away ?? 0}
                        </span>
                      </div>
                      
                      {/* Halftime Score */}
                      {fixture.score.halftime.home !== null && (
                        <p className="text-sm text-muted-foreground">
                          HT: {fixture.score.halftime.home} - {fixture.score.halftime.away}
                        </p>
                      )}

                      {/* Minutage */}
                      {fixture.fixture.status.elapsed && statusInfo.isLive && (
                        <div className="flex items-center gap-2 text-green-500">
                          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-2xl font-bold animate-pulse">
                            {fixture.fixture.status.elapsed}'
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className="flex flex-col items-center gap-3">
                      <Avatar className="h-24 w-24 border-2 border-border">
                        <AvatarImage src={fixture.teams.away.logo} alt={fixture.teams.away.name} />
                        <AvatarFallback>
                          <Shield className="h-12 w-12" />
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-lg font-bold text-center">{fixture.teams.away.name}</h3>
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(getSofaScoreUrl(fixture), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver no SofaScore
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(getFlashScoreUrl(fixture), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver no FlashScore
                    </Button>
                  </div>
                </Card>

                {/* Live Statistics */}
                {isSelected && stats && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4" />
        Atualização automática a cada 30 segundos
      </div>
    </div>
  );
}
