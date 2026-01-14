import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLeagueManager } from '@/hooks/useLeagueManager';
import { Edit2, Check, X, ChevronDown, Merge, AlertTriangle, Trophy } from 'lucide-react';

interface LeagueManagerProps {
  games: { id: string; league: string; homeTeam: string; awayTeam: string }[];
  onRefresh: () => void;
}

export const LeagueManager = ({ games, onRefresh }: LeagueManagerProps) => {
  const { leagues, loading, countries, renameLeague, mergeLeagues, findDuplicates } = useLeagueManager(games);
  const [editingLeague, setEditingLeague] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null);

  const duplicates = findDuplicates();

  const handleStartEdit = (leagueName: string) => {
    setEditingLeague(leagueName);
    // Try to extract existing country and league name
    const parts = leagueName.split(' - ');
    if (parts.length >= 2) {
      setSelectedCountry(parts[0]);
      setNewName(parts.slice(1).join(' - '));
    } else {
      setSelectedCountry('');
      setNewName(leagueName);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingLeague || !newName.trim()) return;
    
    const finalName = selectedCountry ? `${selectedCountry} - ${newName.trim()}` : newName.trim();
    const success = await renameLeague(editingLeague, finalName);
    
    if (success) {
      setEditingLeague(null);
      setNewName('');
      setSelectedCountry('');
      onRefresh();
    }
  };

  const handleMerge = async (source: string, target: string) => {
    const success = await mergeLeagues([source], target);
    if (success) {
      onRefresh();
    }
  };

  // Find leagues without country prefix
  const leaguesWithoutCountry = leagues.filter(l => !l.name.includes(' - '));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Gerenciar Ligas
          <Badge variant="secondary" className="ml-auto">
            {leagues.length} ligas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warning for leagues without country */}
        {leaguesWithoutCountry.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-amber-500">
                {leaguesWithoutCountry.length} liga(s) sem país definido
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                Clique em Editar para adicionar o país
              </p>
            </div>
          </div>
        )}

        {/* Duplicate warnings */}
        {duplicates.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Possíveis duplicatas:
            </p>
            {duplicates.map((dup) => (
              <div key={dup.original} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
                <Merge className="h-4 w-4 text-blue-500" />
                <span>{dup.original}</span>
                <span className="text-muted-foreground">↔</span>
                <span>{dup.similar[0]}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7"
                  onClick={() => handleMerge(dup.similar[0], dup.original)}
                  disabled={loading}
                >
                  Mesclar
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* League list */}
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {leagues.map((league) => (
              <Collapsible
                key={league.name}
                open={expandedLeague === league.name}
                onOpenChange={(open) => setExpandedLeague(open ? league.name : null)}
              >
                <div className="border rounded-lg">
                  <div className="flex items-center gap-2 p-3">
                    {editingLeague === league.name ? (
                      <>
                        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue placeholder="País" />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((country) => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-muted-foreground">-</span>
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="h-8 flex-1"
                          placeholder="Nome da liga"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={handleSaveEdit}
                          disabled={loading}
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingLeague(null);
                            setNewName('');
                            setSelectedCountry('');
                          }}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ChevronDown className={`h-4 w-4 transition-transform ${
                              expandedLeague === league.name ? 'rotate-180' : ''
                            }`} />
                          </Button>
                        </CollapsibleTrigger>
                        <span className={`flex-1 text-sm ${
                          !league.name.includes(' - ') ? 'text-amber-500' : ''
                        }`}>
                          {league.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {league.gamesCount} jogos
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleStartEdit(league.name)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  
                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-0">
                      <div className="border-t pt-2 space-y-1">
                        <p className="text-xs text-muted-foreground mb-2">
                          Jogos nesta liga:
                        </p>
                        {games
                          .filter(g => g.league === league.name)
                          .slice(0, 5)
                          .map(game => (
                            <div key={game.id} className="text-xs text-muted-foreground">
                              {game.homeTeam} vs {game.awayTeam}
                            </div>
                          ))}
                        {league.gamesCount > 5 && (
                          <p className="text-xs text-muted-foreground italic">
                            ... e mais {league.gamesCount - 5} jogos
                          </p>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
