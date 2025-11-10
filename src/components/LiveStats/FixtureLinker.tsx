import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Link as LinkIcon, Loader2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from "@/components/ui/scroll-area";

interface Fixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: {
    name: string;
    country: string;
  };
  teams: {
    home: { name: string; logo: string };
    away: { name: string; logo: string };
  };
}

interface FixtureLinkerProps {
  gameId: string;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  currentFixtureId?: string;
  onLinked: () => void;
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

  const searchFixtures = async () => {
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-live-fixtures', {
        body: { live: true }
      });

      if (error) throw error;

      if (data?.response) {
        // Show all live fixtures
        setFixtures(data.response);
        
        if (data.response.length === 0) {
          toast.info('Nenhum jogo ao vivo encontrado no momento');
        }
      }
    } catch (err) {
      console.error('Error searching fixtures:', err);
      toast.error('Erro ao buscar jogos ao vivo');
    } finally {
      setSearching(false);
    }
  };

  const linkFixture = async (fixtureId: number, fixture: Fixture) => {
    setLoading(true);
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
      setLoading(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {currentFixtureId ? (
          <Badge variant="secondary" className="cursor-pointer">
            <LinkIcon className="h-3 w-3 mr-1" />
            Vinculado
          </Badge>
        ) : (
          <Button variant="outline" size="sm">
            <LinkIcon className="h-4 w-4 mr-2" />
            Vincular à API
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular com API-Football</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">
                Buscar jogos ao vivo para vincular
              </p>
            </div>
            <Button onClick={searchFixtures} disabled={searching} size="sm">
              {searching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar Jogos Ao Vivo
            </Button>
          </div>

          {currentFixtureId && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Vinculação Atual</p>
                  <p className="text-sm text-muted-foreground">Fixture ID: {currentFixtureId}</p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={unlinkFixture}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desvincular'}
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="h-[400px] pr-4">
            {fixtures.length > 0 ? (
              <div className="space-y-2">
                {fixtures.map((fixture) => (
                  <Card 
                    key={fixture.fixture.id} 
                    className="p-4 hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <img 
                            src={fixture.teams.home.logo} 
                            alt={fixture.teams.home.name}
                            className="h-6 w-6"
                          />
                          <span className="font-medium">{fixture.teams.home.name}</span>
                          <span className="text-muted-foreground">vs</span>
                          <span className="font-medium">{fixture.teams.away.name}</span>
                          <img 
                            src={fixture.teams.away.logo} 
                            alt={fixture.teams.away.name}
                            className="h-6 w-6"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{fixture.league.name}</span>
                          <span>•</span>
                          <span>{fixture.league.country}</span>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs">
                            {fixture.fixture.status.short}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => linkFixture(fixture.fixture.id, fixture)}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Vincular'
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Clique em "Buscar Jogos Ao Vivo" para ver os jogos em andamento
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
