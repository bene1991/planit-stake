import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyzedGame {
  date?: string;
  result?: 'green' | 'red' | 'void' | string;
}

interface DailyProfitCalendarProps {
  games: AnalyzedGame[];
  greenStake: number;
  redStake: number;
  onDayClick?: (date: Date, games: AnalyzedGame[]) => void;
}

interface DayAgg {
  date: Date;
  greens: number;
  reds: number;
  entries: number;
  profit: number;
}

const fmtStakes = (v: number) => {
  const abs = Math.abs(v);
  const s = abs.toLocaleString('pt-BR', { minimumFractionDigits: abs % 1 === 0 ? 0 : 1, maximumFractionDigits: 2 });
  return `${v < 0 ? '-' : '+'}${s} stk`;
};

const DailyProfitCalendar: React.FC<DailyProfitCalendarProps> = ({ games, greenStake, redStake, onDayClick }) => {
  const [cursor, setCursor] = useState<Date>(() => {
    const first = games.find(g => g.date)?.date;
    return first ? parseISO(first) : new Date();
  });

  const { dailyMap, monthStats, gamesByDay } = useMemo(() => {
    const map = new Map<string, DayAgg>();
    const gMap = new Map<string, AnalyzedGame[]>();
    let greens = 0, reds = 0, entries = 0, profit = 0;
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);

    for (const g of games) {
      if (!g.date) continue;
      const d = parseISO(g.date);
      const key = format(d, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, { date: d, greens: 0, reds: 0, entries: 0, profit: 0 });
      if (!gMap.has(key)) gMap.set(key, []);
      gMap.get(key)!.push(g);
      const agg = map.get(key)!;
      const greenNet = greenStake * (1 - 0.045);
      if (g.result === 'green') { agg.greens++; agg.profit += greenNet; }
      else if (g.result === 'red') { agg.reds++; agg.profit -= redStake; }
      else continue;
      agg.entries++;

      if (d >= monthStart && d <= monthEnd) {
        if (g.result === 'green') { greens++; profit += greenNet; }
        else if (g.result === 'red') { reds++; profit -= redStake; }
        entries++;
      }
    }
    const winRate = entries > 0 ? (greens / entries) * 100 : 0;
    return { dailyMap: map, monthStats: { greens, reds, entries, profit, winRate }, gamesByDay: gMap };
  }, [games, greenStake, redStake, cursor]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <Card className="bg-[#1e2333] border-[#2a3142]">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center">
          <CalendarDays className="w-3.5 h-3.5 mr-2 text-amber-400" />
          Calendário de Lucro Diário
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-[#2a3142] p-4 bg-[#161b27]">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={() => setCursor(subMonths(cursor, 1))} className="text-gray-300 hover:bg-white/5">
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Anterior
            </Button>
            <div className="text-sm text-gray-200 font-medium">
              {format(cursor, 'MMMM \'de\' yyyy', { locale: ptBR })}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCursor(addMonths(cursor, 1))} className="text-gray-300 hover:bg-white/5">
              Próximo <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="rounded-md border border-[#2a3142] bg-[#1a1f2d] p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Lucro do Mês</p>
              <p className={cn('text-lg font-bold mt-1', monthStats.profit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {fmtStakes(monthStats.profit)}
              </p>
            </div>
            <div className="rounded-md border border-[#2a3142] bg-[#1a1f2d] p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Entradas</p>
              <p className="text-lg font-bold mt-1 text-white">{monthStats.entries}</p>
            </div>
            <div className="rounded-md border border-[#2a3142] bg-[#1a1f2d] p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Greens / Reds</p>
              <p className="text-lg font-bold mt-1">
                <span className="text-emerald-400">{monthStats.greens}</span>
                <span className="text-gray-500">/</span>
                <span className="text-rose-400">{monthStats.reds}</span>
              </p>
            </div>
            <div className="rounded-md border border-[#2a3142] bg-[#1a1f2d] p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Win Rate</p>
              <p className="text-lg font-bold mt-1 text-amber-400">{monthStats.winRate.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekdays.map(w => (
              <div key={w} className="text-center text-[10px] text-gray-500 py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const agg = dailyMap.get(key);
              const inMonth = isSameMonth(day, cursor);
              const today = isSameDay(day, new Date());
              const hasGreen = agg && agg.profit > 0;
              const hasRed = agg && agg.profit < 0;
              return (
                <div
                  key={key}
                  onClick={() => agg && onDayClick && onDayClick(day, gamesByDay.get(key) || [])}
                  className={cn(
                    'min-h-[110px] rounded-md border p-2.5 flex flex-col text-left transition-colors',
                    !inMonth && 'opacity-30',
                    hasGreen && 'border-emerald-500/30 bg-emerald-500/10',
                    hasRed && 'border-rose-500/30 bg-rose-500/10',
                    !agg && 'border-[#2a3142] bg-[#1a1f2d]/40',
                    today && 'ring-1 ring-amber-400/50',
                    agg && onDayClick && 'cursor-pointer hover:ring-1 hover:ring-white/20',
                  )}
                >
                  <span className={cn('text-xs font-semibold', inMonth ? 'text-gray-200' : 'text-gray-600')}>
                    {format(day, 'd')}
                  </span>
                  {agg && (
                    <>
                      <span className={cn('text-xl font-bold leading-tight mt-2', hasGreen ? 'text-emerald-400' : 'text-rose-400')}>
                        {fmtStakes(agg.profit)}
                      </span>
                      <span className="text-[10px] text-gray-500 leading-tight mt-1">
                        {agg.entries}e · <span className="text-emerald-500/80">{agg.greens}G</span> <span className="text-rose-500/80">{agg.reds}R</span>
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-500/30" /> Green
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/40 border border-rose-500/30" /> Red
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#1a1f2d] border border-[#2a3142]" /> Sem entradas
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyProfitCalendar;
