import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { useSupabaseBankroll } from '@/hooks/useSupabaseBankroll';
import { useStatistics } from '@/hooks/useStatistics';
import { GreenVsRedChart } from '@/components/Charts/GreenVsRedChart';
import { LeagueStatsChart } from '@/components/Charts/LeagueStatsChart';
import { TeamStatsTable } from '@/components/Charts/TeamStatsTable';
import { MethodComparisonChart } from '@/components/Charts/MethodComparisonChart';
import { ResultsTimelineChart } from '@/components/Charts/ResultsTimelineChart';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { TrendingUp, TrendingDown, Target, Download, RefreshCw } from 'lucide-react';
import { exportGamesToCSV } from '@/utils/exportToCSV';
import { toast } from 'sonner';

export default function Statistics() {
  const { games, loading: gamesLoading, refreshGames } = useSupabaseGames();
  const { bankroll, loading: bankrollLoading } = useSupabaseBankroll();

  const handleRefresh = async () => {
    await refreshGames();
    toast.success('Dados atualizados!');
  };

  const statistics = useStatistics(games, bankroll.methods);

  const handleExport = () => {
    exportGamesToCSV(games, bankroll.methods);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Estatísticas</h1>
          <p className="text-sm text-muted-foreground">
            Análise de performance • {games.length} operações
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total de Operações"
          value={statistics.overallStats.total}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="Greens"
          value={statistics.overallStats.greens}
          className="text-green-600"
        />
        <StatCard
          label="Reds"
          value={statistics.overallStats.reds}
          className="text-red-600"
        />
        <StatCard
          label="Win Rate"
          value={`${statistics.overallStats.winRate}%`}
          icon={<Target className="h-5 w-5" />}
        />
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
