import { useState, useMemo } from 'react';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { useSupabaseBankroll } from '@/hooks/useSupabaseBankroll';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronDown, Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Game } from '@/types';
import { rebuildStats } from '@/utils/rebuildStats';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function FinishedGames() {
  const { games, loading, refreshGames } = useSupabaseGames();
  const { bankroll } = useSupabaseBankroll();
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState('today');
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  const [rebuildingStats, setRebuildingStats] = useState(false);

  const handleRebuildStats = async () => {
    setRebuildingStats(true);
    try {
      const result = await rebuildStats();
      await refreshGames();
      
      toast.success('✅ Estatísticas recalculadas!', {
        description: `${result.greens}G • ${result.reds}R • ${result.winRate}% win rate`,
      });
    } catch (error: any) {
      toast.error('Erro ao recalcular: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setRebuildingStats(false);
    }
  };

  // Filtrar jogos finalizados
  const finalizedGames = games.filter((game) =>
    game.methodOperations.length > 0 && game.methodOperations.every((op) => op.result)
  );

  // Aplicar filtro de período
  const filteredByPeriod = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return finalizedGames.filter((game) => {
      const gameDate = new Date(game.date);
      gameDate.setHours(0, 0, 0, 0);

      switch (periodFilter) {
        case 'today':
          return gameDate.getTime() === today.getTime();
        case 'yesterday': {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return gameDate.getTime() === yesterday.getTime();
        }
        case 'last7':
          const last7 = new Date(today);
          last7.setDate(last7.getDate() - 7);
          return gameDate >= last7;
        case 'last30':
          const last30 = new Date(today);
          last30.setDate(last30.getDate() - 30);
          return gameDate >= last30;
        case 'custom':
          if (!customDateFrom) return true;
          const from = new Date(customDateFrom);
          from.setHours(0, 0, 0, 0);
          if (customDateTo) {
            const to = new Date(customDateTo);
            to.setHours(23, 59, 59, 999);
            return gameDate >= from && gameDate <= to;
          }
          return gameDate >= from;
        default:
          return true;
      }
    });
  }, [finalizedGames, periodFilter, customDateFrom, customDateTo]);

  // Aplicar busca por time/liga
  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return filteredByPeriod;
    const query = searchQuery.toLowerCase();
    return filteredByPeriod.filter(
      (game) =>
        game.homeTeam.toLowerCase().includes(query) ||
        game.awayTeam.toLowerCase().includes(query) ||
        game.league.toLowerCase().includes(query)
    );
  }, [filteredByPeriod, searchQuery]);

  // Agrupar por data
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Game[]>();
    filteredGames.forEach((game) => {
      const dateKey = game.date;
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(game);
    });

    // Ordenar jogos dentro de cada data por horário
    groups.forEach((games) => {
      games.sort((a, b) => a.time.localeCompare(b.time));
    });

    // Converter para array e ordenar por data (mais recente primeiro)
    return Array.from(groups.entries())
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, games]) => ({ date, games }));
  }, [filteredGames]);

  // Calcular estatísticas do período
  const periodStats = useMemo(() => {
    const allOps = filteredGames.flatMap((g) => g.methodOperations);
    const greens = allOps.filter((op) => op.result === 'Green').length;
    const reds = allOps.filter((op) => op.result === 'Red').length;
    const total = greens + reds;
    const winRate = total > 0 ? (greens / total) * 100 : 0;

    return {
      totalGames: filteredGames.length,
      totalMethods: allOps.length,
      greens,
      reds,
      winRate: winRate.toFixed(1),
    };
  }, [filteredGames]);

  const getMethodName = (methodId: string) => {
    return bankroll.methods.find((m) => m.id === methodId)?.name || 'Método desconhecido';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jogos Finalizados</h1>
          <p className="text-muted-foreground">Histórico completo de operações</p>
        </div>
        <Button onClick={handleRebuildStats} disabled={rebuildingStats} variant="outline">
          <RefreshCw className={cn('h-4 w-4 mr-2', rebuildingStats && 'animate-spin')} />
          Recalcular Estatísticas
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por time ou liga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="last7">Últimos 7 dias</SelectItem>
              <SelectItem value="last30">Últimos 30 dias</SelectItem>
              <SelectItem value="custom">Período personalizado</SelectItem>
            </SelectContent>
          </Select>
          {periodFilter === 'custom' && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateFrom ? format(customDateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'De'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} locale={ptBR} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateTo ? format(customDateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Até'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </Card>

      {/* Resumo do período */}
      <Card className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Jogos</p>
            <p className="text-2xl font-bold">{periodStats.totalGames}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Métodos</p>
            <p className="text-2xl font-bold">{periodStats.totalMethods}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Greens</p>
            <p className="text-2xl font-bold text-green-600">{periodStats.greens}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Reds</p>
            <p className="text-2xl font-bold text-red-600">{periodStats.reds}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-2xl font-bold">{periodStats.winRate}%</p>
          </div>
        </div>
      </Card>

      {/* Lista agrupada por data */}
      <div className="space-y-6">
        {groupedByDate.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Nenhum jogo finalizado encontrado</p>
          </Card>
        ) : (
          groupedByDate.map(({ date, games }) => (
            <div key={date} className="space-y-3">
              <h3 className="text-lg font-semibold">
                {format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </h3>
              <div className="space-y-2">
                {games.map((game) => (
                  <Collapsible key={game.id}>
                    <Card className="overflow-hidden">
                      <CollapsibleTrigger className="w-full">
                        <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="text-sm text-muted-foreground">{game.time}</div>
                            <div className="font-medium">
                              {game.homeTeam} vs {game.awayTeam}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {game.league}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={game.methodOperations.filter((op) => op.result === 'Green').length > 0 ? 'default' : 'destructive'}>
                              {game.methodOperations.filter((op) => op.result === 'Green').length}G •{' '}
                              {game.methodOperations.filter((op) => op.result === 'Red').length}R
                            </Badge>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t p-4 space-y-2 bg-muted/20">
                          {game.methodOperations.map((op, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm p-2 bg-background rounded">
                              <span className="font-medium">{getMethodName(op.methodId)}</span>
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">{op.operationType || 'N/A'}</Badge>
                                <span className="text-muted-foreground">
                                  {op.entryOdds?.toFixed(2)} → {op.exitOdds?.toFixed(2)}
                                </span>
                                <Badge variant={op.result === 'Green' ? 'default' : 'destructive'}>
                                  {op.result}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
