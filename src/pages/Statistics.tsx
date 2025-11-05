import { useState, useCallback } from 'react';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { useSupabaseBankroll } from '@/hooks/useSupabaseBankroll';
import { useStatistics } from '@/hooks/useStatistics';
import { FilterBar, FilterOptions } from '@/components/FilterBar';
import { GreenVsRedChart } from '@/components/Charts/GreenVsRedChart';
import { LeagueStatsChart } from '@/components/Charts/LeagueStatsChart';
import { TeamStatsTable } from '@/components/Charts/TeamStatsTable';
import { MethodComparisonChart } from '@/components/Charts/MethodComparisonChart';
import { ResultsTimelineChart } from '@/components/Charts/ResultsTimelineChart';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BarChart3, Download } from 'lucide-react';
import { exportGamesToCSV } from '@/utils/exportToCSV';
import { toast } from 'sonner';
import { Game } from '@/types';

export default function Statistics() {
  const { games, loading: gamesLoading } = useSupabaseGames();
  const { bankroll, loading: bankrollLoading } = useSupabaseBankroll();
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);

  const applyFilters = useCallback((filters: FilterOptions) => {
    let result = [...games];

    // Filtro de busca por texto
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (g) =>
          g.homeTeam.toLowerCase().includes(searchLower) ||
          g.awayTeam.toLowerCase().includes(searchLower) ||
          g.league.toLowerCase().includes(searchLower) ||
          g.notes?.toLowerCase().includes(searchLower)
      );
    }

    // Filtro de data
    if (filters.dateFrom) {
      result = result.filter((g) => new Date(g.date) >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      result = result.filter((g) => new Date(g.date) <= filters.dateTo!);
    }

    // Filtro de ligas
    if (filters.leagues.length > 0) {
      result = result.filter((g) => filters.leagues.includes(g.league));
    }

    // Filtro de métodos
    if (filters.methods.length > 0) {
      result = result.filter((g) =>
        g.methodOperations.some((op) => filters.methods.includes(op.methodId))
      );
    }

    // Filtro de resultado
    if (filters.result !== 'all') {
      if (filters.result === 'pending') {
        result = result.filter((g) =>
          g.methodOperations.some((op) => !op.result)
        );
      } else if (filters.result === 'green') {
        result = result.filter((g) =>
          g.methodOperations.some((op) => op.result === 'Green')
        );
      } else if (filters.result === 'red') {
        result = result.filter((g) =>
          g.methodOperations.some((op) => op.result === 'Red')
        );
      }
    }

    // Filtro de status
    if (filters.status !== 'all') {
      const statusMap: Record<string, string> = {
        'not-started': 'Not Started',
        'live': 'Live',
        'finished': 'Finished',
      };
      result = result.filter((g) => g.status === statusMap[filters.status]);
    }

    setFilteredGames(result);
  }, [games]);

  const statistics = useStatistics(filteredGames.length > 0 ? filteredGames : games, bankroll.methods);

  const handleExport = () => {
    const gamesToExport = filteredGames.length > 0 ? filteredGames : games;
    exportGamesToCSV(gamesToExport, bankroll.methods);
    toast.success('Dados exportados com sucesso!');
  };

  if (gamesLoading || bankrollLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
            <BarChart3 className="h-6 w-6 text-secondary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Estatísticas</h1>
            <p className="text-muted-foreground">Análise detalhada de performance</p>
          </div>
        </div>
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <FilterBar 
        games={games} 
        methods={bankroll.methods} 
        onFilterChange={applyFilters}
      />

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Total de Operações</p>
          <p className="text-3xl font-bold">{statistics.overallStats.total}</p>
        </Card>
        <Card className="p-4 shadow-card bg-green-500/10">
          <p className="text-sm text-muted-foreground">Greens</p>
          <p className="text-3xl font-bold text-green-600">{statistics.overallStats.greens}</p>
        </Card>
        <Card className="p-4 shadow-card bg-red-500/10">
          <p className="text-sm text-muted-foreground">Reds</p>
          <p className="text-3xl font-bold text-red-600">{statistics.overallStats.reds}</p>
        </Card>
        <Card className="p-4 shadow-card bg-primary/10">
          <p className="text-sm text-muted-foreground">Win Rate</p>
          <p className="text-3xl font-bold text-primary">{statistics.overallStats.winRate}%</p>
        </Card>
      </div>

      {/* Gráficos principais */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GreenVsRedChart 
          greens={statistics.overallStats.greens} 
          reds={statistics.overallStats.reds} 
        />
        <MethodComparisonChart data={statistics.methodStats} />
      </div>

      {/* Estatísticas por liga */}
      <LeagueStatsChart data={statistics.leagueStats} />

      {/* Tabela de times */}
      <TeamStatsTable data={statistics.teamStats} />

      {/* Timeline */}
      <ResultsTimelineChart data={statistics.timeline} />
    </div>
  );
}
