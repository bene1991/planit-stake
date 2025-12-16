import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Link as LinkIcon, Loader2, Unlink, Shield, Check } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';

interface Fixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null; long: string };
  };
  league: {
    name: string;
    country: string;
    logo: string;
  };
  teams: {
    home: { name: string; logo: string };
    away: { name: string; logo: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

interface FixtureLinkerProps {
  gameId: string;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  currentFixtureId?: string | null;
  onLinked: () => void;
}

// Helper to calculate team name similarity
function calculateSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) => s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/fc|sc|cf|ac|ec|se|cr|ca$/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const n1 = normalize(str1);
  const n2 = normalize(str2);

  if (n1 === n2) return 1;
  if (n1.includes(n2) || n2.includes(n1)) return 0.9;

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= n1.length; i++) matrix[i] = [i];
  for (let j = 0; j <= n2.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= n1.length; i++) {
    for (let j = 1; j <= n2.length; j++) {
      const cost = n1[i - 1] === n2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  const maxLen = Math.max(n1.length, n2.length);
  return maxLen > 0 ? 1 - matrix[n1.length][n2.length] / maxLen : 0;
}

export function FixtureLinker({ 
  gameId, 
  gameDate, 
  homeTeam, 
  awayTeam,
  currentFixtureId,
  onLinked 
}: FixtureLinkerProps) {
  const [open, setOpen] = useState(false);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<number | null>(null);

  const searchFixtures = async () => {
    setSearching(true);
    try {
      // Search by date first
      const { data, error } = await supabase.functions.invoke('api-football', {
        body: { 
          endpoint: 'fixtures', 
          params: { date: gameDate }
        }
      });

      if (error) throw error;

      const allFixtures = data?.response || [];
      
      // Score fixtures based on team name similarity
      const scoredFixtures = allFixtures.map((f: Fixture) => {
        const homeScore = calculateSimilarity(homeTeam, f.teams.home.name);
        const awayScore = calculateSimilarity(awayTeam, f.teams.away.name);
        return { fixture: f, score: (homeScore + awayScore) / 2 };
      });

      // Sort by score and take top 15
      const topFixtures = scoredFixtures
        .filter((f: { score: number }) => f.score > 0.25)
        .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
        .slice(0, 15)
        .map((f: { fixture: Fixture }) => f.fixture);

      setFixtures(topFixtures);
      
      if (topFixtures.length === 0) {
        toast.info('Nenhum jogo similar encontrado para esta data');
      } else {
        toast.success(`${topFixtures.length} jogo(s) encontrado(s)`);
      }
    } catch (err) {
      console.error('Error searching fixtures:', err);
      toast.error(`Erro ao buscar jogos: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setSearching(false);
    }
  };

  const linkFixture = async (fixtureId: number, fixture: Fixture) => {
    setLinking(fixtureId);
    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          api_fixture_id: fixtureId.toString(),
          home_team_logo: fixture.teams.home.logo,
          away_team_logo: fixture.teams.away.logo
        })
        .eq('id', gameId);

      if (error) throw error;

      toast.success('Jogo vinculado com sucesso!');
      setOpen(false);
      onLinked();
    } catch (err) {
      console.error('Error linking fixture:', err);
      toast.error('Erro ao vincular jogo');
    } finally {
      setLinking(null);
    }
  };

  const unlinkFixture = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ api_fixture_id: null })
        .eq('id', gameId);

      if (error) throw error;

      toast.success('Vinculação removida!');
      onLinked();
    } catch (err) {
      console.error('Error unlinking fixture:', err);
      toast.error('Erro ao desvincular jogo');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Fixture['fixture']['status']) => {
    const liveStatuses = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];
    if (liveStatuses.includes(status.short)) {
      return (
        <Badge variant="destructive" className="animate-pulse text-[10px]">
          AO VIVO {status.elapsed}'
        </Badge>
      );
    }
    if (status.short === 'FT') {
      return <Badge variant="secondary" className="text-[10px]">Encerrado</Badge>;
    }
    if (status.short === 'NS') {
      return <Badge variant="outline" className="text-[10px]">Não iniciado</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px]">{status.short}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {currentFixtureId ? (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 text-primary">
            <Check className="h-3 w-3" />
            Vinculado
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
            <LinkIcon className="h-3 w-3" />
            Vincular
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">Vincular com API-Football</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="p-3 rounded-lg bg-secondary/50 border">
            <p className="font-medium text-sm">{homeTeam} vs {awayTeam}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(gameDate + 'T00:00:00').toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                day: '2-digit', 
                month: 'long' 
              })}
            </p>
          </div>

          <Button onClick={searchFixtures} disabled={searching} className="w-full">
            {searching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {searching ? 'Buscando...' : 'Buscar Jogos Similares'}
          </Button>

          {currentFixtureId && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-primary">Vinculação Atual</p>
                  <p className="text-xs text-muted-foreground">Fixture ID: {currentFixtureId}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={unlinkFixture}
                  disabled={loading}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 pr-4">
            {fixtures.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium mb-2">
                  {fixtures.length} resultado(s) encontrado(s):
                </p>
                {fixtures.map((fixture) => (
                  <Card 
                    key={fixture.fixture.id} 
                    className={cn(
                      "p-3 transition-all hover:border-primary/50",
                      linking === fixture.fixture.id && "border-primary ring-2 ring-primary/20"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={fixture.league.logo} />
                          <AvatarFallback className="text-[6px]">{fixture.league.name.slice(0,2)}</AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                          {fixture.league.country} • {fixture.league.name}
                        </span>
                      </div>
                      {getStatusBadge(fixture.fixture.status)}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={fixture.teams.home.logo} />
                        <AvatarFallback><Shield className="h-3 w-3" /></AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium flex-1 truncate">{fixture.teams.home.name}</span>
                      <span className="text-xs font-bold">{fixture.goals.home ?? '-'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={fixture.teams.away.logo} />
                        <AvatarFallback><Shield className="h-3 w-3" /></AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium flex-1 truncate">{fixture.teams.away.name}</span>
                      <span className="text-xs font-bold">{fixture.goals.away ?? '-'}</span>
                    </div>

                    <Button 
                      size="sm" 
                      className="w-full h-7 text-xs"
                      onClick={() => linkFixture(fixture.fixture.id, fixture)}
                      disabled={linking === fixture.fixture.id}
                    >
                      {linking === fixture.fixture.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <LinkIcon className="h-3 w-3 mr-1" />
                      )}
                      Vincular este jogo
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Clique em "Buscar Jogos Similares" para encontrar o jogo na API</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
