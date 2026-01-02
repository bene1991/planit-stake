import { useState } from 'react';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { useSupabaseBankroll } from '@/hooks/useSupabaseBankroll';
import { useFilteredStatistics } from '@/hooks/useFilteredStatistics';
import { StatisticsFilterBar, StatisticsFilters } from '@/components/StatisticsFilterBar';
import { GreenVsRedChart } from '@/components/Charts/GreenVsRedChart';
import { LeagueStatsChart } from '@/components/Charts/LeagueStatsChart';
import { TeamStatsTable } from '@/components/Charts/TeamStatsTable';
import { MethodComparisonChart } from '@/components/Charts/MethodComparisonChart';
import { ResultsTimelineChart } from '@/components/Charts/ResultsTimelineChart';
import { MethodDetailCard } from '@/components/Charts/MethodDetailCard';
import { MethodTimelineChart } from '@/components/Charts/MethodTimelineChart';
import { DailyMethodBreakdown } from '@/components/Charts/DailyMethodBreakdown';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
import { TrendingUp, TrendingDown, Target, Download, RefreshCw, Trophy, BarChart3, Minus } from 'lucide-react';
import { exportGamesToCSV } from '@/utils/exportToCSV';
import { toast } from 'sonner';
import { useStatistics } from '@/hooks/useStatistics';
import { cn } from '@/lib/utils';

export default function Statistics() {
  const { games, loading: gamesLoading, refreshGames } = useSupabaseGames();
  const { bankroll, loading: bankrollLoading } = useSupabaseBankroll();

  const [filters, setFilters] = useState<StatisticsFilters>({
    period: 'all',
    dateFrom: null,
    dateTo: null,
    selectedMethods: [],
    selectedLeagues: [],
    result: 'all',
  });

  const handleRefresh = async () => {
    await refreshGames();
    toast.success('Dados atualizados!');
  };

  // Use filtered statistics hook
  const {
    overallStats,
    methodDetailStats,
    dailyBreakdown,
    methodTimeline,
    methodNames,
    comparison,
    leagues,
  } = useFilteredStatistics(games, bankroll.methods, filters);

  // Use original statistics for charts that don't need filtering
  const originalStatistics = useStatistics(games, bankroll.methods);

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

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-success" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-success';
    if (change < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const hasFiltersApplied = filters.period !== 'all' || filters.selectedMethods.length > 0 || filters.selectedLeagues.length > 0 || filters.result !== 'all';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Estatísticas</h1>
          <p className="text-sm text-muted-foreground font-light">
            Análise de performance • {overallStats.total} operações{hasFiltersApplied ? ' (filtradas)' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRefresh} className="shadow-apple">
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={handleExport} className="shadow-apple-md">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <StatisticsFilterBar
        methods={bankroll.methods}
        leagues={leagues}
        filters={filters}
        onFilterChange={setFilters}
      />

      {/* Comparison Cards (show when period filter is applied) */}
      {filters.period !== 'all' && filters.period !== 'custom' && comparison.previousVolume > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                <p className="text-2xl font-bold">{comparison.currentWinRate}%</p>
              </div>
              <div className={cn('flex items-center gap-1 text-sm', getChangeColor(comparison.winRateChange))}>
                {getChangeIcon(comparison.winRateChange)}
                <span>{comparison.winRateChange > 0 ? '+' : ''}{comparison.winRateChange}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">vs período anterior</p>
          </Card>

          <Card className="p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Volume</p>
                <p className="text-2xl font-bold">{comparison.currentVolume} ops</p>
              </div>
              <div className={cn('flex items-center gap-1 text-sm', getChangeColor(comparison.volumeChange))}>
                {getChangeIcon(comparison.volumeChange)}
                <span>{comparison.volumeChange > 0 ? '+' : ''}{comparison.volumeChange}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">vs período anterior</p>
          </Card>

          <Card className="p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Melhor Método</p>
                <p className="text-lg font-bold truncate">{comparison.bestMethod?.name || '-'}</p>
              </div>
              <Trophy className="h-5 w-5 text-warning" />
            </div>
            {comparison.bestMethod && (
              <p className="text-xs text-success mt-2">{comparison.bestMethod.winRate}% win rate</p>
            )}
          </Card>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total de Operações"
          value={overallStats.total}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          label="Greens"
          value={overallStats.greens}
          className="text-success"
        />
        <StatCard
          label="Reds"
          value={overallStats.reds}
          className="text-destructive"
        />
        <StatCard
          label="Win Rate"
          value={`${overallStats.winRate}%`}
          icon={<Target className="h-5 w-5" />}
        />
      </div>

      {/* Method Detail Cards */}
      {methodDetailStats.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Detalhamento por Método
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {methodDetailStats.map((method) => (
              <MethodDetailCard
                key={method.methodId}
                methodId={method.methodId}
                methodName={method.methodName}
                total={method.total}
                greens={method.greens}
                reds={method.reds}
                winRate={method.winRate}
                dailyData={method.dailyData}
                previousWinRate={method.previousWinRate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Method Timeline */}
      {methodTimeline.length > 0 && methodNames.length > 0 && (
        <MethodTimelineChart data={methodTimeline} methodNames={methodNames} />
      )}

      {/* Daily Breakdown */}
      {dailyBreakdown.length > 0 && <DailyMethodBreakdown data={dailyBreakdown} />}

      {/* Original Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GreenVsRedChart greens={overallStats.greens} reds={overallStats.reds} />
        <MethodComparisonChart data={methodDetailStats} />
      </div>

      {/* League Stats */}
      <LeagueStatsChart data={originalStatistics.leagueStats} />

      {/* Team Stats */}
      <TeamStatsTable data={originalStatistics.teamStats} />

      {/* Timeline */}
      <ResultsTimelineChart data={originalStatistics.timeline} />
    </div>
  );
}
