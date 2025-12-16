import { useEffect, useState } from 'react';
import { RefreshCw, Shield, Clock, ExternalLink, Check, X, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useFixture, useFixtureStatistics, getStatusDisplay, parseStatistics } from '@/hooks/useApiFootball';
import { PressureChart } from './PressureChart';
import { StatsComparison } from './StatsComparison';
import { toast } from 'sonner';

interface LinkedGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  league: string;
  api_fixture_id: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  status?: string;
}

export function MyLiveGames() {
  const { user } = useAuth();
  const [linkedGames, setLinkedGames] = useState<LinkedGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadLinkedGames();
    }
  }, [user]);

  const loadLinkedGames = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('owner_id', user.id)
      .not('api_fixture_id', 'is', null);

    if (!error && data) {
      setLinkedGames(data.map(g => ({
        id: g.id,
        homeTeam: g.home_team,
        awayTeam: g.away_team,
        date: g.date,
        time: g.time,
        league: g.league,
        api_fixture_id: g.api_fixture_id!,
        homeTeamLogo: g.home_team_logo || undefined,
        awayTeamLogo: g.away_team_logo || undefined,
        status: g.status || undefined
      })));
    }
    setLoading(false);
  };

  const selectedGame = linkedGames.find(g => g.id === selectedGameId);
  
  // Fetch live data for selected game
  const { data: fixtureData, refetch: refetchFixture } = useFixture(
    selectedGame?.api_fixture_id,
    30000
  );
  const { data: statsData } = useFixtureStatistics(selectedGame?.api_fixture_id, 30000);
  
  const liveFixture = fixtureData?.[0];
  const stats = parseStatistics(statsData || null);
  const statusInfo = liveFixture ? getStatusDisplay(liveFixture.fixture.status) : null;

  // Mark result
  const markResult = async (gameId: string, result: 'Green' | 'Red') => {
    const { error } = await supabase
      .from('method_operations')
      .update({ result })
      .eq('game_id', gameId);

    if (!error) {
      toast.success(`Resultado marcado como ${result}`);
      loadLinkedGames();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (linkedGames.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-semibold mb-2">Nenhum jogo vinculado</h3>
        <p className="text-muted-foreground text-sm">
          Seus jogos do planejamento serão vinculados automaticamente à API-Football
          quando forem adicionados.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Game selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {linkedGames.map((game) => (
          <GameCard 
            key={game.id}
            game={game}
            isSelected={selectedGameId === game.id}
            onClick={() => setSelectedGameId(game.id)}
          />
        ))}
      </div>

      {/* Selected game details */}
      {selectedGame && liveFixture && (
        <Card className={cn(
          "p-6 relative overflow-hidden",
          statusInfo?.isLive && "border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.15)]"
        )}>
          {/* Status */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Badge 
              variant="default" 
              className={cn(
                "font-bold",
                statusInfo?.isLive && "bg-green-500 hover:bg-green-600 animate-pulse"
              )}
            >
              <Clock className="h-3 w-3 mr-1" />
              {liveFixture.fixture.status.elapsed ? `${liveFixture.fixture.status.elapsed}'` : ''} {statusInfo?.label}
            </Badge>
            <Button size="icon" variant="ghost" onClick={() => refetchFixture()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* League */}
          <div className="flex items-center gap-2 mb-6">
            <Avatar className="h-6 w-6">
              <AvatarImage src={liveFixture.league.logo} />
              <AvatarFallback>{liveFixture.league.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              {liveFixture.league.name} • {liveFixture.league.country}
            </span>
          </div>

          {/* Teams and Score */}
          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Home */}
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={liveFixture.teams.home.logo} />
                <AvatarFallback><Shield className="h-10 w-10" /></AvatarFallback>
              </Avatar>
              <h3 className="text-sm font-bold text-center">{liveFixture.teams.home.name}</h3>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-5xl font-black">{liveFixture.goals.home ?? 0}</span>
                <span className="text-3xl text-muted-foreground">:</span>
                <span className="text-5xl font-black">{liveFixture.goals.away ?? 0}</span>
              </div>
              
              {liveFixture.fixture.status.elapsed && statusInfo?.isLive && (
                <div className="flex items-center gap-2 text-green-500">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xl font-bold">{liveFixture.fixture.status.elapsed}'</span>
                </div>
              )}
            </div>

            {/* Away */}
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={liveFixture.teams.away.logo} />
                <AvatarFallback><Shield className="h-10 w-10" /></AvatarFallback>
              </Avatar>
              <h3 className="text-sm font-bold text-center">{liveFixture.teams.away.name}</h3>
            </div>
          </div>

          {/* Result buttons */}
          {!statusInfo?.isLive && liveFixture.fixture.status.short === 'FT' && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t">
              <Button
                variant="outline"
                className="border-green-500 text-green-500 hover:bg-green-500/10"
                onClick={() => markResult(selectedGame.id, 'Green')}
              >
                <Check className="h-4 w-4 mr-2" />
                Green
              </Button>
              <Button
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-500/10"
                onClick={() => markResult(selectedGame.id, 'Red')}
              >
                <X className="h-4 w-4 mr-2" />
                Red
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Statistics */}
      {selectedGame && liveFixture && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PressureChart
            homeTeam={liveFixture.teams.home.name}
            awayTeam={liveFixture.teams.away.name}
            homePossession={stats.homePossession}
            awayPossession={stats.awayPossession}
            homeShots={stats.homeShots}
            awayShots={stats.awayShots}
            homeShotsOnTarget={stats.homeShotsOnTarget}
            awayShotsOnTarget={stats.awayShotsOnTarget}
          />
          <StatsComparison
            homeTeam={liveFixture.teams.home.name}
            awayTeam={liveFixture.teams.away.name}
            stats={[
              { label: 'Escanteios', home: stats.homeCorners, away: stats.awayCorners },
              { label: 'Faltas', home: stats.homeFouls, away: stats.awayFouls },
              { label: 'Cartões Amarelos', home: stats.homeYellowCards, away: stats.awayYellowCards },
              { label: 'Cartões Vermelhos', home: stats.homeRedCards, away: stats.awayRedCards },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// Game Card component
function GameCard({ 
  game, 
  isSelected, 
  onClick 
}: { 
  game: LinkedGame; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  const { data: fixtureData } = useFixture(game.api_fixture_id, 60000);
  const liveFixture = fixtureData?.[0];
  const statusInfo = liveFixture ? getStatusDisplay(liveFixture.fixture.status) : null;

  return (
    <Card 
      className={cn(
        "p-4 cursor-pointer transition-all hover:border-primary/50",
        isSelected && "border-primary ring-2 ring-primary/20",
        statusInfo?.isLive && "border-green-500/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">{game.league}</span>
        {statusInfo && (
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px]",
              statusInfo.isLive && "bg-green-500/10 text-green-500 border-green-500/30"
            )}
          >
            {statusInfo.isLive && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1" />}
            {liveFixture?.fixture.status.elapsed ? `${liveFixture.fixture.status.elapsed}' ` : ''}
            {statusInfo.label}
          </Badge>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm font-medium truncate">{game.homeTeam}</span>
            <Avatar className="h-6 w-6">
              <AvatarImage src={liveFixture?.teams.home.logo || game.homeTeamLogo} />
              <AvatarFallback className="text-[8px]">{game.homeTeam.slice(0, 2)}</AvatarFallback>
            </Avatar>
          </div>
        </div>
        
        <div className="flex items-center gap-1 font-bold">
          <span>{liveFixture?.goals.home ?? '-'}</span>
          <span className="text-muted-foreground">:</span>
          <span>{liveFixture?.goals.away ?? '-'}</span>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={liveFixture?.teams.away.logo || game.awayTeamLogo} />
              <AvatarFallback className="text-[8px]">{game.awayTeam.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate">{game.awayTeam}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
