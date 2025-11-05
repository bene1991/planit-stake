import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { useSupabaseBankroll } from '@/hooks/useSupabaseBankroll';
import { useStatistics } from '@/hooks/useStatistics';
import { GreenVsRedChart } from '@/components/Charts/GreenVsRedChart';
import { LeagueStatsChart } from '@/components/Charts/LeagueStatsChart';
import { TeamStatsTable } from '@/components/Charts/TeamStatsTable';
import { MethodComparisonChart } from '@/components/Charts/MethodComparisonChart';
import { ResultsTimelineChart } from '@/components/Charts/ResultsTimelineChart';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { exportGamesToCSV } from '@/utils/exportToCSV';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export default function Statistics() {
  const { user } = useAuth();
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
            <BarChart3 className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Estatísticas
            </h1>
            <p className="text-muted-foreground">
              Análise detalhada de performance • {games.length} jogos
            </p>
          </div>
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


      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5 shadow-card bg-gradient-to-br from-muted/60 to-muted/30 transition-all hover:scale-105">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📊</span>
            <p className="text-sm text-muted-foreground">Total de Operações</p>
          </div>
          <p className="text-3xl font-bold">{statistics.overallStats.total}</p>
        </Card>
        <Card className="p-5 shadow-card bg-gradient-to-br from-green-500/15 to-green-500/5 transition-all hover:scale-105">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">✅</span>
            <p className="text-sm text-muted-foreground">Greens</p>
          </div>
          <p className="text-3xl font-bold text-green-600">{statistics.overallStats.greens}</p>
        </Card>
        <Card className="p-5 shadow-card bg-gradient-to-br from-red-500/15 to-red-500/5 transition-all hover:scale-105">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">❌</span>
            <p className="text-sm text-muted-foreground">Reds</p>
          </div>
          <p className="text-3xl font-bold text-red-600">{statistics.overallStats.reds}</p>
        </Card>
        <Card className="p-5 shadow-card bg-gradient-to-br from-primary/15 to-primary/5 transition-all hover:scale-105">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🎯</span>
            <p className="text-sm text-muted-foreground">Win Rate</p>
          </div>
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
