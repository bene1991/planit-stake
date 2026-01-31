import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { MonthlyReportCard } from '@/components/MonthlyReportCard';
import { MonthlyAIAnalysis } from '@/components/MonthlyAIAnalysis';
import { MonthlyMethodRanking } from '@/components/MonthlyMethodRanking';
import { MonthlyReportHistory } from '@/components/MonthlyReportHistory';
import { useMonthlyReport } from '@/hooks/useMonthlyReport';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { useSupabaseBankroll } from '@/hooks/useSupabaseBankroll';
import { useOperationalSettings } from '@/hooks/useOperationalSettings';
import { CalendarDays, Save, Loader2, FileCheck, RefreshCw } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function formatMonthYear(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
}

export default function MonthlyReport() {
  const { games } = useSupabaseGames();
  const { bankroll } = useSupabaseBankroll();
  const { settings } = useOperationalSettings();
  
  const stakeValueReais = settings?.stakeValueReais || 100;
  const methods = bankroll.methods || [];
  
  const {
    selectedMonth,
    setSelectedMonth,
    stats,
    savedReport,
    savedReports,
    isLoading,
    isSaving,
    isLoadingAI,
    aiAnalysis,
    calculateStats,
    saveReport,
    requestAIAnalysis,
    loadSavedReports
  } = useMonthlyReport(games, methods, stakeValueReais);

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = subMonths(now, i);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: ptBR });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
  }, []);

  // Calculate stats and load reports on mount and month change
  useEffect(() => {
    calculateStats();
    loadSavedReports();
  }, [selectedMonth, games, calculateStats, loadSavedReports]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="h-6 w-6" />
              Fechamento Mensal
            </h1>
            <p className="text-muted-foreground">
              Analise e registre o desempenho de cada mês
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="icon"
              onClick={calculateStats}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column - Stats and AI */}
          <div className="lg:col-span-2 space-y-6">
            {stats ? (
              <>
                {/* Stats Card */}
                <MonthlyReportCard 
                  stats={stats} 
                  monthLabel={formatMonthYear(selectedMonth)} 
                />

                {/* Method Ranking */}
                <MonthlyMethodRanking methods={stats.methodRanking} />

                {/* AI Analysis */}
                <MonthlyAIAnalysis
                  analysis={aiAnalysis}
                  isLoading={isLoadingAI}
                  onRequestAnalysis={requestAIAnalysis}
                  disabled={stats.totalOperations === 0}
                />

                {/* Save/Close Month Button */}
                <Card>
                  <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
                    <div>
                      {savedReport ? (
                        <div className="flex items-center gap-2 text-green-500">
                          <FileCheck className="h-5 w-5" />
                          <span>Mês fechado em {format(new Date(savedReport.closed_at), "dd/MM/yyyy 'às' HH:mm")}</span>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          Feche o mês para salvar permanentemente este relatório
                        </p>
                      )}
                    </div>
                    
                    <Button
                      onClick={saveReport}
                      disabled={isSaving || stats.totalOperations === 0}
                      className="gap-2"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {savedReport ? 'Atualizar Fechamento' : 'Fechar Mês'}
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma operação neste mês</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Selecione um mês com operações registradas para ver o relatório.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - History */}
          <div className="space-y-6">
            <MonthlyReportHistory
              reports={savedReports}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
