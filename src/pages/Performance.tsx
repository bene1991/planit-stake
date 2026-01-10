import { useState, useMemo, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Shield, Pause, Settings, RefreshCw, AlertCircle, DollarSign, Download, Target, BarChart3, Trophy, Minus, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useOperationalStatus, OperationalStatusType } from '@/hooks/useOperationalStatus';
import { useOperationalSettings } from '@/hooks/useOperationalSettings';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { useSupabaseBankroll } from '@/hooks/useSupabaseBankroll';
import { useFilteredStatistics } from '@/hooks/useFilteredStatistics';
import { StatisticsFilterBar, StatisticsFilters } from '@/components/StatisticsFilterBar';
import { GreenVsRedChart } from '@/components/Charts/GreenVsRedChart';
import { LeagueStatsChart } from '@/components/Charts/LeagueStatsChart';
import { MethodComparisonChart } from '@/components/Charts/MethodComparisonChart';
import { MethodDetailCard } from '@/components/Charts/MethodDetailCard';
import { DailyMethodBreakdown } from '@/components/Charts/DailyMethodBreakdown';
import { MethodTimelineChart } from '@/components/Charts/MethodTimelineChart';
import { BankrollEvolutionChart } from '@/components/Charts/BankrollEvolutionChart';
import { StatCard } from '@/components/StatCard';
import { formatCurrency } from '@/utils/profitCalculator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportGamesToCSV } from '@/utils/exportToCSV';
import { useStatistics } from '@/hooks/useStatistics';

const statusConfig: Record<OperationalStatusType, { color: string; bg: string; icon: React.ElementType; border: string }> = {
  'NORMAL': { 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-500/10', 
    icon: TrendingUp,
    border: 'border-emerald-500/30'
  },
  'ALERTA': { 
    color: 'text-yellow-500', 
    bg: 'bg-yellow-500/10', 
    icon: AlertTriangle,
    border: 'border-yellow-500/30'
  },
  'PROTEÇÃO': { 
    color: 'text-blue-500', 
    bg: 'bg-blue-500/10', 
    icon: Shield,
    border: 'border-blue-500/30'
  },
  'PAUSADO': { 
    color: 'text-red-500', 
    bg: 'bg-red-500/10', 
    icon: Pause,
    border: 'border-red-500/30'
  }
};

export default function Performance() {
  const { games, loading: gamesLoading, refreshGames } = useSupabaseGames();
  const { bankroll, loading: bankrollLoading } = useSupabaseBankroll();

  const [filters, setFilters] = useState<StatisticsFilters>({
    period: 'thisMonth',
    dateFrom: startOfMonth(new Date()),
    dateTo: endOfMonth(new Date()),
    selectedMethods: [],
    selectedLeagues: [],
    result: 'all',
  });

  // Use filtered statistics hook
  const {
    overallStats,
    methodDetailStats,
    dailyBreakdown,
    methodTimeline,
    methodNames,
    comparison,
    leagues,
    averageOdd,
    operationsWithOdd,
    breakevenRate,
    bankrollEvolution,
  } = useFilteredStatistics(games, bankroll.methods, filters);

  // Use original statistics for charts that don't need filtering
  const originalStatistics = useStatistics(games, bankroll.methods);

  // Operational status
  const operationalFilters = useMemo(() => ({
    period: filters.period === 'all' ? 'all' as const : 
            filters.period === 'today' ? 'today' as const :
            filters.period === '7days' ? '7days' as const :
            filters.period === '30days' ? '30days' as const :
            filters.period === 'thisMonth' ? 'thisMonth' as const :
            filters.period === 'lastMonth' ? 'lastMonth' as const : 'custom' as const,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    selectedMethods: filters.selectedMethods,
    selectedLeagues: filters.selectedLeagues,
  }), [filters]);

  const { metrics, loading: statusLoading } = useOperationalStatus(operationalFilters);
  const { settings, updateSettings } = useOperationalSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stakeInput, setStakeInput] = useState(settings.stakeValueReais.toString());
  const [editedSettings, setEditedSettings] = useState({
    metaMensalStakes: settings.metaMensalStakes,
    stopDiarioStakes: settings.stopDiarioStakes,
    devolucaoMaximaPercent: settings.devolucaoMaximaPercent,
    commissionRate: settings.commissionRate * 100
  });

  // Sync stake input when settings load
  useEffect(() => {
    setStakeInput(settings.stakeValueReais.toString());
  }, [settings.stakeValueReais]);

  const handleStakeSave = async () => {
    const value = parseFloat(stakeInput.replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      toast.error('Valor de stake inválido');
      setStakeInput(settings.stakeValueReais.toString());
      return;
    }
    try {
      await updateSettings({ stakeValueReais: value });
      toast.success('Stake atualizada!');
    } catch {
      toast.error('Erro ao salvar stake');
      setStakeInput(settings.stakeValueReais.toString());
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettings({
        metaMensalStakes: editedSettings.metaMensalStakes,
        stopDiarioStakes: editedSettings.stopDiarioStakes,
        devolucaoMaximaPercent: editedSettings.devolucaoMaximaPercent,
        commissionRate: editedSettings.commissionRate / 100
      });
      toast.success('Configurações salvas!');
      setSettingsOpen(false);
    } catch {
      toast.error('Erro ao salvar configurações');
    }
  };

  const handleRefresh = async () => {
    await refreshGames();
    toast.success('Dados atualizados!');
  };

  const handleExport = () => {
    exportGamesToCSV(games, bankroll.methods);
    toast.success('Dados exportados com sucesso!');
  };

  // Period label for display
  const periodLabel = useMemo(() => {
    if (filters.period === 'all') return 'Todo período';
    if (filters.period === 'today') return 'Hoje';
    if (filters.period === '7days') return 'Últimos 7 dias';
    if (filters.period === '30days') return 'Últimos 30 dias';
    if (filters.period === 'thisMonth') return format(new Date(), 'MMMM yyyy', { locale: ptBR });
    if (filters.period === 'lastMonth') return 'Mês passado';
    if (filters.dateFrom && filters.dateTo) {
      return `${format(filters.dateFrom, 'dd/MM', { locale: ptBR })} - ${format(filters.dateTo, 'dd/MM', { locale: ptBR })}`;
    }
    return 'Período selecionado';
  }, [filters]);

  const loading = gamesLoading || bankrollLoading || statusLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusInfo = statusConfig[metrics.status];
  const StatusIcon = statusInfo.icon;

  // Calculate R$ values using stake
  const dailyProfitReais = metrics.dailyProfitStakes * settings.stakeValueReais;
  const periodProfitReais = metrics.periodProfitStakes * settings.stakeValueReais;

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

  const getOddZoneColor = (odd: number) => {
    if (odd >= 2.05 && odd <= 2.55) return 'text-emerald-500';
    if ((odd >= 2.00 && odd < 2.05) || (odd > 2.55 && odd <= 2.70)) return 'text-yellow-500';
    return 'text-red-500';
  };

  const hasFiltersApplied = filters.period !== 'all' || filters.selectedMethods.length > 0 || filters.selectedLeagues.length > 0 || filters.result !== 'all';

  return (
    <div className="space-y-6 animate-fade-in pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            Desempenho
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análise completa • {overallStats.total} operações{hasFiltersApplied ? ' (filtradas)' : ''} • {periodLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      {/* Stake Input Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <Label htmlFor="stakeAtual" className="text-sm font-medium whitespace-nowrap">
                Stake Atual:
              </Label>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-muted-foreground">R$</span>
              <Input
                id="stakeAtual"
                type="text"
                inputMode="decimal"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                onBlur={handleStakeSave}
                onKeyDown={(e) => e.key === 'Enter' && handleStakeSave()}
                className="max-w-[120px] font-mono text-lg"
                placeholder="100,00"
              />
              <span className="text-xs text-muted-foreground">
                por operação
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Bar */}
      <StatisticsFilterBar
        methods={bankroll.methods}
        leagues={leagues}
        filters={filters}
        onFilterChange={setFilters}
      />

      {/* Main Status Card + KPI Cards - Desktop: Side by side */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Status Card */}
        <Card className={cn("border-2 lg:w-80 lg:flex-shrink-0", statusInfo.border, statusInfo.bg)}>
          <CardContent className="py-4 lg:py-6">
            <div className="flex flex-col items-center text-center gap-3">
              <StatusIcon className={cn("h-12 w-12 lg:h-14 lg:w-14", statusInfo.color)} />
              <div>
                <h2 className={cn("text-2xl lg:text-3xl font-bold", statusInfo.color)}>
                  {metrics.status}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
                  {metrics.statusMessage}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm mt-2">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Streak</p>
                  <p className={cn("font-bold text-lg", metrics.currentStreak.type === 'Green' ? 'text-emerald-500' : metrics.currentStreak.type === 'Red' ? 'text-red-500' : 'text-muted-foreground')}>
                    {metrics.currentStreak.count} {metrics.currentStreak.type || '-'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Max R</p>
                  <p className="font-bold text-lg">{metrics.maxRedStreakPeriod}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Max G</p>
                  <p className="font-bold text-lg">{metrics.maxGreenStreakPeriod}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="flex-1 grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* Lucro do Período */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Lucro Período</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn("text-xl lg:text-2xl font-bold", metrics.periodProfitStakes >= 0 ? "text-emerald-500" : "text-red-500")}>
                {metrics.periodProfitStakes >= 0 ? '+' : ''}{metrics.periodProfitStakes.toFixed(2)} st
              </p>
              <p className={cn("text-xs", periodProfitReais >= 0 ? "text-emerald-500/80" : "text-red-500/80")}>
                {formatCurrency(periodProfitReais)}
              </p>
            </CardContent>
          </Card>

          {/* Lucro do Dia */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Lucro Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn("text-xl lg:text-2xl font-bold", metrics.dailyProfitStakes >= 0 ? "text-emerald-500" : "text-red-500")}>
                {metrics.dailyProfitStakes >= 0 ? '+' : ''}{metrics.dailyProfitStakes.toFixed(2)} st
              </p>
              <p className={cn("text-xs", dailyProfitReais >= 0 ? "text-emerald-500/80" : "text-red-500/80")}>
                {formatCurrency(dailyProfitReais)}
              </p>
            </CardContent>
          </Card>

          {/* Win Rate */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl lg:text-2xl font-bold">{overallStats.winRate}%</p>
              <p className="text-xs text-muted-foreground">{overallStats.greens}G / {overallStats.reds}R</p>
            </CardContent>
          </Card>

          {/* Odd Média */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Odd Média
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn("text-xl lg:text-2xl font-bold", getOddZoneColor(averageOdd))}>
                {averageOdd > 0 ? averageOdd.toFixed(2) : '-'}
              </p>
              <p className="text-xs text-muted-foreground">
                {operationsWithOdd} ops • BE: {breakevenRate > 0 ? `${breakevenRate.toFixed(1)}%` : '-'}
              </p>
            </CardContent>
          </Card>

          {/* Pico / Drawdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pico / DD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1">
                <span className="text-xl lg:text-2xl font-bold text-emerald-500">{metrics.peakProfit}</span>
                <span className="text-muted-foreground">/</span>
                <span className={cn("text-lg font-bold", metrics.currentDrawdown > 0 ? "text-red-500" : "text-muted-foreground")}>
                  -{metrics.currentDrawdown}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">stakes</p>
            </CardContent>
          </Card>
        </div>
      </div>

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

      {/* Warning for missing financial data */}
      {metrics.operationsWithoutFinancialData > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">
                <strong>{metrics.operationsWithoutFinancialData}</strong> de {metrics.totalOperationsPeriod} operações sem dados financeiros completos (stake/odd).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bankroll Evolution Chart */}
      <BankrollEvolutionChart data={bankrollEvolution} />

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

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GreenVsRedChart greens={overallStats.greens} reds={overallStats.reds} />
        <MethodComparisonChart data={methodDetailStats} />
      </div>

      {/* League Stats */}
      <LeagueStatsChart data={originalStatistics.leagueStats} games={games} methods={bankroll.methods} />

      {/* Settings Collapsible */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações
                <Badge variant="outline" className="ml-auto">
                  {settingsOpen ? 'Fechar' : 'Editar'}
                </Badge>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metaMensal">Meta mensal (stakes)</Label>
                  <Input
                    id="metaMensal"
                    type="number"
                    value={editedSettings.metaMensalStakes}
                    onChange={(e) => setEditedSettings(prev => ({ 
                      ...prev, 
                      metaMensalStakes: Number(e.target.value) 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stopDiario">Stop diário (stakes)</Label>
                  <Input
                    id="stopDiario"
                    type="number"
                    value={editedSettings.stopDiarioStakes}
                    onChange={(e) => setEditedSettings(prev => ({ 
                      ...prev, 
                      stopDiarioStakes: Number(e.target.value) 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="devolucao">Devolução máxima (%)</Label>
                  <Input
                    id="devolucao"
                    type="number"
                    value={editedSettings.devolucaoMaximaPercent}
                    onChange={(e) => setEditedSettings(prev => ({ 
                      ...prev, 
                      devolucaoMaximaPercent: Number(e.target.value) 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comissao">Comissão da casa (%)</Label>
                  <Input
                    id="comissao"
                    type="number"
                    step="0.1"
                    value={editedSettings.commissionRate}
                    onChange={(e) => setEditedSettings(prev => ({ 
                      ...prev, 
                      commissionRate: Number(e.target.value) 
                    }))}
                  />
                </div>
              </div>
              <Button onClick={handleSaveSettings} className="w-full">
                Salvar Configurações
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
