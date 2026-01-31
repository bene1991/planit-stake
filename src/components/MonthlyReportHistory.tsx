import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, ChevronRight, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthlyReport {
  id: string;
  year_month: string;
  total_operations: number;
  win_rate: number;
  profit_money: number;
  profit_stakes: number;
  ai_score?: number;
  closed_at: string;
}

interface MonthlyReportHistoryProps {
  reports: MonthlyReport[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

function formatMonthShort(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
}

export function MonthlyReportHistory({ 
  reports, 
  selectedMonth, 
  onSelectMonth 
}: MonthlyReportHistoryProps) {
  if (reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Histórico de Fechamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum mês fechado ainda. Feche seu primeiro mês para começar o histórico.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Histórico de Fechamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-4">
            {reports.map((report) => (
              <Button
                key={report.id}
                variant={selectedMonth === report.year_month ? 'secondary' : 'ghost'}
                className="w-full justify-between h-auto py-3"
                onClick={() => onSelectMonth(report.year_month)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatMonthShort(report.year_month)}</span>
                  {report.ai_score && (
                    <Badge variant="outline" className="gap-1">
                      <Brain className="h-3 w-3" />
                      {report.ai_score}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium",
                    report.profit_money >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {report.profit_money >= 0 ? '+' : ''}
                    {report.profit_money.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
