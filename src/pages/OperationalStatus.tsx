import { useState, useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Shield, Pause, Settings, RefreshCw, AlertCircle } from 'lucide-react';
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
import { OperationalFilterBar, OperationalFilters } from '@/components/OperationalFilterBar';
import { formatCurrency } from '@/utils/profitCalculator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const OperationalStatus = () => {
  const { games } = useSupabaseGames();
  const { bankroll } = useSupabaseBankroll();
  
  // Filter state
  const [filters, setFilters] = useState<OperationalFilters>({
    period: 'thisMonth',
    dateFrom: startOfMonth(new Date()),
    dateTo: endOfMonth(new Date()),
    selectedMethods: [],
    selectedLeagues: []
  });

  // Extract unique leagues from games
  const leagues = useMemo(() => 
    [...new Set(games.map(g => g.league))].filter(Boolean).sort(),
    [games]
  );

  const { metrics, loading } = useOperationalStatus(filters);
  const { settings, updateSettings } = useOperationalSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editedSettings, setEditedSettings] = useState({
    metaMensalStakes: settings.metaMensalStakes,
    stopDiarioStakes: settings.stopDiarioStakes,
    devolucaoMaximaPercent: settings.devolucaoMaximaPercent,
    commissionRate: settings.commissionRate * 100
  });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusInfo = statusConfig[metrics.status];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Status Operacional
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Atualizado automaticamente • {periodLabel}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {metrics.totalOperationsPeriod} ops no período
        </Badge>
      </div>

      {/* Filter Bar */}
      <OperationalFilterBar
        methods={bankroll.methods}
        leagues={leagues}
        filters={filters}
        onFilterChange={setFilters}
      />

      {/* Main Status Card */}
      <Card className={cn("border-2", statusInfo.border, statusInfo.bg)}>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center">
            <StatusIcon className={cn("h-12 w-12 mb-3", statusInfo.color)} />
            <h2 className={cn("text-3xl font-bold mb-2", statusInfo.color)}>
              {metrics.status}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              {metrics.statusMessage}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Streak Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Streak */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Streak Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {metrics.currentStreak.type === 'Green' ? (
                <>
                  <TrendingUp className="h-6 w-6 text-emerald-500" />
                  <span className="text-2xl font-bold text-emerald-500">
                    {metrics.currentStreak.count} Greens
                  </span>
                </>
              ) : metrics.currentStreak.type === 'Red' ? (
                <>
                  <TrendingDown className="h-6 w-6 text-red-500" />
                  <span className="text-2xl font-bold text-red-500">
                    {metrics.currentStreak.count} Reds
                  </span>
                </>
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">
                  Sem operações
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sequência ativa</p>
          </CardContent>
        </Card>

        {/* Max Red Streak */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Maior Seq. Reds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-red-500/60" />
              <span className="text-2xl font-bold">
                {metrics.maxRedStreakPeriod} reds
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          </CardContent>
        </Card>

        {/* Max Green Streak */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Maior Seq. Greens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-500/60" />
              <span className="text-2xl font-bold">
                {metrics.maxGreenStreakPeriod} greens
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Warning for missing financial data */}
      {metrics.operationsWithoutFinancialData > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">
                <strong>{metrics.operationsWithoutFinancialData}</strong> de {metrics.totalOperationsPeriod} operações sem dados financeiros completos (stake/odd). 
                O cálculo em R$ considera apenas operações com valores preenchidos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Daily Profit */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lucro do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className={cn(
                "text-2xl font-bold",
                metrics.dailyProfitStakes >= 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {metrics.dailyProfitStakes >= 0 ? '+' : ''}{metrics.dailyProfitStakes} stakes
              </p>
              {metrics.dailyProfitMoney !== 0 && (
                <p className={cn(
                  "text-sm",
                  metrics.dailyProfitMoney >= 0 ? "text-emerald-500/80" : "text-red-500/80"
                )}>
                  {formatCurrency(metrics.dailyProfitMoney)}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.totalOperationsToday} operações hoje
            </p>
          </CardContent>
        </Card>

        {/* Period Profit */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lucro do Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className={cn(
                "text-2xl font-bold",
                metrics.periodProfitStakes >= 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {metrics.periodProfitStakes >= 0 ? '+' : ''}{metrics.periodProfitStakes} stakes
              </p>
              {metrics.periodProfitMoney !== 0 && (
                <p className={cn(
                  "text-sm",
                  metrics.periodProfitMoney >= 0 ? "text-emerald-500/80" : "text-red-500/80"
                )}>
                  {formatCurrency(metrics.periodProfitMoney)}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          </CardContent>
        </Card>

        {/* Peak & Drawdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pico / Devolução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-500">
                {metrics.peakProfit}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className={cn(
                "text-xl font-bold",
                metrics.currentDrawdown > 0 ? "text-red-500" : "text-muted-foreground"
              )}>
                -{metrics.currentDrawdown}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pico e devolução em stakes
            </p>
          </CardContent>
        </Card>
      </div>

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
};

export default OperationalStatus;
