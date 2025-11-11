import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, RefreshCw, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { DailyGame } from '@/hooks/useDailyGames';
import { useTeamLogo } from '@/hooks/useTeamLogo';
import { Badge } from '@/components/ui/badge';

interface DailyGamesTabProps {
  dailyGames: DailyGame[];
  onRefresh: () => void;
  onAddToPlanning: (gameIds: string[]) => void;
  loading?: boolean;
}

export const DailyGamesTab = ({ dailyGames, onRefresh, onAddToPlanning, loading }: DailyGamesTabProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(true);

  // Get unique leagues
  const leagues = useMemo(() => {
    const uniqueLeagues = new Set(dailyGames.map(game => game.league));
    return Array.from(uniqueLeagues).sort();
  }, [dailyGames]);

  // Get unique dates
  const dates = useMemo(() => {
    const uniqueDates = new Set(dailyGames.map(game => game.date));
    return Array.from(uniqueDates).sort().reverse();
  }, [dailyGames]);

  // Filter games
  const filteredGames = useMemo(() => {
    return dailyGames.filter(game => {
      const matchesSearch = searchQuery === '' || 
        game.home_team.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.away_team.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesLeague = selectedLeague === 'all' || game.league === selectedLeague;
      
      const matchesDate = selectedDate === 'all' || game.date === selectedDate;

      return matchesSearch && matchesLeague && matchesDate;
    });
  }, [dailyGames, searchQuery, selectedLeague, selectedDate]);

  const toggleGameSelection = (gameId: string) => {
    setSelectedGames(prev => 
      prev.includes(gameId) 
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    );
  };

  const toggleAllGames = () => {
    const availableGames = filteredGames.filter(g => !g.added_to_planning);
    if (selectedGames.length === availableGames.length) {
      setSelectedGames([]);
    } else {
      setSelectedGames(availableGames.map(g => g.id));
    }
  };

  const handleAddSelected = () => {
    if (selectedGames.length > 0) {
      onAddToPlanning(selectedGames);
      setSelectedGames([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Debug Panel */}
      {showDebug && (
        <div className="bg-muted/50 border rounded-lg p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold">🔍 Painel de Debug</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowDebug(false)}
              className="h-6 text-xs"
            >
              Ocultar
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Collection:</span> <code className="text-primary">daily_games</code>
            </div>
            <div>
              <span className="text-muted-foreground">Total de registros:</span> <code className="text-primary">{dailyGames.length}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Filtrados:</span> <code className="text-primary">{filteredGames.length}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Última atualização:</span> <code className="text-primary">{format(new Date(), 'HH:mm:ss')}</code>
            </div>
          </div>
          {dailyGames.length > 0 && filteredGames.length === 0 && (
            <div className="text-warning pt-2 border-t">
              ⚠️ Existem {dailyGames.length} jogos salvos, mas nenhum corresponde aos filtros atuais. Ajuste os filtros acima.
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por time..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedDate} onValueChange={setSelectedDate}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Todas as Datas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Datas</SelectItem>
            {dates.map(date => (
              <SelectItem key={date} value={date}>
                {format(new Date(date + 'T00:00:00'), 'dd/MM/yyyy')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedLeague} onValueChange={setSelectedLeague}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Todas as Ligas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Ligas</SelectItem>
            {leagues.map(league => (
              <SelectItem key={league} value={league}>{league}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Counter */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredGames.length} jogo(s) encontrado(s)
          {selectedGames.length > 0 && ` • ${selectedGames.length} selecionado(s)`}
        </p>
        {selectedGames.length > 0 && (
          <Button onClick={handleAddSelected}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Selecionados ao Planejamento
          </Button>
        )}
      </div>

      {/* Games Table */}
      {dailyGames.length === 0 ? (
        <div className="text-center py-12 border rounded-lg space-y-3">
          <p className="text-muted-foreground">
            ⚠️ Nenhum jogo importado encontrado.
          </p>
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Jogos do Dia
          </Button>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="text-center py-12 border rounded-lg space-y-3">
          <p className="text-muted-foreground">
            ⚠️ Nenhum jogo corresponde aos filtros selecionados.
          </p>
          <Button 
            variant="outline" 
            onClick={() => {
              setSearchQuery('');
              setSelectedLeague('all');
              setSelectedDate('all');
            }}
          >
            Limpar Filtros
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedGames.length === filteredGames.filter(g => !g.added_to_planning).length && selectedGames.length > 0}
                    onCheckedChange={toggleAllGames}
                  />
                </TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Liga</TableHead>
                <TableHead>Casa</TableHead>
                <TableHead>Visitante</TableHead>
                <TableHead className="w-32">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGames.map((game) => (
                <GameRow
                  key={game.id}
                  game={game}
                  selected={selectedGames.includes(game.id)}
                  onToggle={() => toggleGameSelection(game.id)}
                  onAdd={() => onAddToPlanning([game.id])}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

interface GameRowProps {
  game: DailyGame;
  selected: boolean;
  onToggle: () => void;
  onAdd: () => void;
}

const GameRow = ({ game, selected, onToggle, onAdd }: GameRowProps) => {
  const { logoUrl: homeTeamLogo } = useTeamLogo(game.home_team);
  const { logoUrl: awayTeamLogo } = useTeamLogo(game.away_team);

  return (
    <TableRow>
      <TableCell>
        {!game.added_to_planning && (
          <Checkbox checked={selected} onCheckedChange={onToggle} />
        )}
      </TableCell>
      <TableCell className="font-mono">{game.time}</TableCell>
      <TableCell className="text-sm">{game.league}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <img src={homeTeamLogo} alt={game.home_team} className="w-6 h-6 object-contain" />
          <span className="text-sm">{game.home_team}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <img src={awayTeamLogo} alt={game.away_team} className="w-6 h-6 object-contain" />
          <span className="text-sm">{game.away_team}</span>
        </div>
      </TableCell>
      <TableCell>
        {game.added_to_planning ? (
          <Badge variant="secondary">✅ Adicionado</Badge>
        ) : (
          <Button size="sm" variant="ghost" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};
