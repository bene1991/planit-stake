import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/profitCalculator';

interface MethodDayData {
  methodId: string;
  methodName: string;
  greens: number;
  reds: number;
  winRate: number;
  balance: number;
  profitReais: number;
}

interface DayBreakdown {
  date: string;
  totalGreens: number;
  totalReds: number;
  totalWinRate: number;
  totalBalance: number;
  totalProfitReais: number;
  methods: MethodDayData[];
}

interface DailyMethodBreakdownProps {
  data: DayBreakdown[];
  stakeValueReais: number;
}

export function DailyMethodBreakdown({ data, stakeValueReais }: DailyMethodBreakdownProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const getStakeUnits = (profitReais: number) => {
    if (!stakeValueReais || stakeValueReais <= 0) return '—';
    const units = profitReais / stakeValueReais;
    return `${units >= 0 ? '+' : ''}${units.toFixed(2)} st`;
  };

  const toggleDay = (date: string) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDays(newExpanded);
  };

  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return 'text-success';
    if (rate >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getBalanceDisplay = (balance: number) => {
    if (balance > 0) return { icon: TrendingUp, color: 'text-success', text: `+${balance}` };
    if (balance < 0) return { icon: TrendingDown, color: 'text-destructive', text: `${balance}` };
    return { icon: Minus, color: 'text-muted-foreground', text: '0' };
  };

  if (data.length === 0) {
    return (
      <Card className="p-6 shadow-card">
        <h3 className="mb-4 text-lg font-bold">Histórico Diário por Método</h3>
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Sem dados no período selecionado
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-card">
      <h3 className="mb-4 text-lg font-bold">Histórico Diário por Método</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Clique em uma data para ver detalhes por método
      </p>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-center">Greens</TableHead>
              <TableHead className="text-center">Reds</TableHead>
              <TableHead className="text-center">Win Rate</TableHead>
              <TableHead className="text-center">Saldo</TableHead>
              <TableHead className="text-center">Lucro</TableHead>
              <TableHead className="text-center">Stakes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((day) => {
              const isExpanded = expandedDays.has(day.date);
              const balanceInfo = getBalanceDisplay(day.totalBalance);
              const BalanceIcon = balanceInfo.icon;

              return (
                <>
                  <TableRow
                    key={day.date}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleDay(day.date)}
                  >
                    <TableCell className="py-2">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium py-2">
                      {format(new Date(`${day.date}T12:00:00`), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-center text-success py-2">{day.totalGreens}</TableCell>
                    <TableCell className="text-center text-destructive py-2">{day.totalReds}</TableCell>
                    <TableCell className={cn('text-center font-semibold py-2', getWinRateColor(day.totalWinRate))}>
                      {day.totalWinRate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="py-2">
                      <div className={cn('flex items-center justify-center gap-1', balanceInfo.color)}>
                        <BalanceIcon className="h-3 w-3" />
                        <span className="font-semibold">{balanceInfo.text}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn('text-center font-semibold py-2', day.totalProfitReais >= 0 ? 'text-success' : 'text-destructive')}>
                      {day.totalProfitReais >= 0 ? '+' : ''}{formatCurrency(day.totalProfitReais)}
                    </TableCell>
                    <TableCell className={cn('text-center font-semibold py-2', day.totalProfitReais >= 0 ? 'text-success' : 'text-destructive')}>
                      {getStakeUnits(day.totalProfitReais)}
                    </TableCell>
                  </TableRow>

                  {/* Métodos expandidos */}
                  {isExpanded &&
                    day.methods.map((method) => {
                      const methodBalanceInfo = getBalanceDisplay(method.balance);
                      const MethodBalanceIcon = methodBalanceInfo.icon;

                      return (
                        <TableRow key={`${day.date}-${method.methodId}`} className="bg-muted/10">
                          <TableCell className="py-1.5"></TableCell>
                          <TableCell className="py-1.5 pl-8 text-sm text-muted-foreground">
                            ↳ {method.methodName}
                          </TableCell>
                          <TableCell className="text-center text-success text-sm py-1.5">
                            {method.greens}
                          </TableCell>
                          <TableCell className="text-center text-destructive text-sm py-1.5">
                            {method.reds}
                          </TableCell>
                          <TableCell
                            className={cn('text-center text-sm py-1.5', getWinRateColor(method.winRate))}
                          >
                            {method.winRate.toFixed(1)}%
                          </TableCell>
                          <TableCell className="py-1.5">
                            <div
                              className={cn(
                                'flex items-center justify-center gap-1 text-sm',
                                methodBalanceInfo.color
                              )}
                            >
                              <MethodBalanceIcon className="h-3 w-3" />
                              <span>{methodBalanceInfo.text}</span>
                            </div>
                          </TableCell>
                          <TableCell className={cn('text-center text-sm py-1.5', method.profitReais >= 0 ? 'text-success' : 'text-destructive')}>
                            {method.profitReais >= 0 ? '+' : ''}{formatCurrency(method.profitReais)}
                          </TableCell>
                          <TableCell className={cn('text-center text-sm py-1.5', method.profitReais >= 0 ? 'text-success' : 'text-destructive')}>
                            {getStakeUnits(method.profitReais)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
