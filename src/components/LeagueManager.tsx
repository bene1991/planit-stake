import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useLeagueManager } from '@/hooks/useLeagueManager';
import { Edit2, Check, X, ChevronDown, Merge, AlertTriangle, Trophy, ArrowRightLeft } from 'lucide-react';

interface LeagueManagerProps {
  games: { id: string; league: string; homeTeam: string; awayTeam: string }[];
  onRefresh: () => void;
}

export const LeagueManager = ({ games, onRefresh }: LeagueManagerProps) => {
  const { leagues, loading, countries, renameLeague, mergeLeagues, updateGameLeague, findDuplicates } = useLeagueManager(games);
  const [editingLeague, setEditingLeague] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null);
  
  // Move game dialog state
  const [moveDialog, setMoveDialog] = useState<{
    game: { id: string; homeTeam: string; awayTeam: string; league: string } | null;
    newLeague: string;
  } | null>(null);

  const duplicates = findDuplicates();

  const handleStartEdit = (leagueName: string) => {
    setEditingLeague(leagueName);
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

  const handleMoveGame = async () => {
    if (!moveDialog?.game || !moveDialog.newLeague) return;
    const success = await updateGameLeague(moveDialog.game.id, moveDialog.newLeague);
    if (success) {
      setMoveDialog(null);
      onRefresh();
    }
  };

  const leaguesWithoutCountry = leagues.filter(l => !l.name.includes(' - '));

  return (
    <>
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
                        <div className="border-t pt-2">
                          <p className="text-xs text-muted-foreground mb-2">
                            Jogos nesta liga:
                          </p>
                          <ScrollArea className="max-h-[200px]">
                            <div className="space-y-1">
                              {games
                                .filter(g => g.league === league.name)
                                .map(game => (
                                  <div 
                                    key={game.id} 
                                    className="flex items-center justify-between p-2 rounded hover:bg-muted/50 group"
                                  >
                                    <span className="text-xs text-muted-foreground">
                                      {game.homeTeam} vs {game.awayTeam}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => setMoveDialog({ game, newLeague: '' })}
                                      title="Mover para outra liga"
                                    >
                                      <ArrowRightLeft className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          </ScrollArea>
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

      {/* Move Game Dialog */}
      <Dialog open={!!moveDialog} onOpenChange={(open) => !open && setMoveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover Jogo</DialogTitle>
          </DialogHeader>
          {moveDialog?.game && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-sm">
                  {moveDialog.game.homeTeam} vs {moveDialog.game.awayTeam}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Liga atual: {moveDialog.game.league}
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Mover para:</label>
                <Select 
                  value={moveDialog.newLeague} 
                  onValueChange={(value) => setMoveDialog({ ...moveDialog, newLeague: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a liga" />
                  </SelectTrigger>
                  <SelectContent>
                    {leagues
                      .filter(l => l.name !== moveDialog.game?.league)
                      .map((league) => (
                        <SelectItem key={league.name} value={league.name}>
                          {league.name} ({league.gamesCount} jogos)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMoveDialog(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleMoveGame} 
              disabled={!moveDialog?.newLeague || loading}
            >
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
