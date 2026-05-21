import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlaskConical, ArrowRight, Loader2, Plus, CalendarDays } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const GREEN_NET = 1 - 0.045;

type Period = 'today' | '7d' | '30d' | 'this_month' | 'all' | 'custom';

const MethodsList: React.FC = () => {
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const { data: methods, isLoading } = useQuery({
    queryKey: ['methods-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategy_simulations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ['methods-list-alerts'],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('live_alerts')
          .select('fixture_id, variation_id, created_at, final_score, goal_events, telegram_sent, league_id, league_name, minute_at_alert')
          .range(from, from + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const { fromMs, toMs } = useMemo(() => {
    const now = Date.now();
    if (period === 'today') {
      const d = new Date(); d.setHours(0,0,0,0);
      return { fromMs: d.getTime(), toMs: Infinity };
    }
    if (period === '7d') return { fromMs: now - 7*86400000, toMs: Infinity };
    if (period === '30d') return { fromMs: now - 30*86400000, toMs: Infinity };
    if (period === 'this_month') {
      const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
      return { fromMs: d.getTime(), toMs: Infinity };
    }
    if (period === 'custom') {
      const f = customFrom ? new Date(customFrom + 'T00:00:00').getTime() : 0;
      const t = customTo ? new Date(customTo + 'T23:59:59').getTime() : Infinity;
      return { fromMs: f, toMs: t };
    }
    return { fromMs: 0, toMs: Infinity };
  }, [period, customFrom, customTo]);

  const enriched = useMemo(() => {
    if (!methods || !alerts) return [];
    return methods.map(m => {
      const variationIds: string[] = m.filters_snapshot?.variation_ids || [];
      const quarantine = new Set((m.filters_snapshot?.quarantine_leagues || []).map(String));
      const overrides: Record<string, number> = m.filters_snapshot?.red_overrides || {};
      const entryMin = m.entry_minute;
      const exitMin = m.exit_minute;
      const greenStake = m.green_stake;
      const redStake = m.red_stake;

      const filtered = alerts.filter(a => {
        if (!variationIds.includes(a.variation_id)) return false;
        if (quarantine.has(String(a.league_id))) return false;
        const t = a.created_at ? new Date(a.created_at).getTime() : 0;
        if (t < fromMs || t > toMs) return false;
        return true;
      });
      const byFixture = new Map<string, any>();
      for (const a of filtered) {
        const k = String(a.fixture_id);
        const existing = byFixture.get(k);
        if (!existing || (a.minute_at_alert || 0) < (existing.minute_at_alert || 0)) {
          byFixture.set(k, a);
        }
      }
      const deduped = Array.from(byFixture.values());

      let greens = 0, reds = 0, profit = 0, lastDate: string | null = null;
      const chrono: { result: 'green' | 'red' | 'pending'; profit: number }[] = [];
      for (const a of deduped.sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime())) {
        const events: any[] = typeof a.goal_events === 'string' ? JSON.parse(a.goal_events) : (a.goal_events || []);
        const hasFinal = a.final_score && a.final_score !== 'pending';
        const isOld = a.created_at ? (Date.now() - new Date(a.created_at).getTime() > 4 * 3600 * 1000) : false;
        const analyzable = hasFinal || isOld;
        if (!analyzable) { chrono.push({ result: 'pending', profit: 0 }); continue; }
        const inWin = events.some(g => {
          const min = (g.minute || 0) + (g.extra || 0);
          return min >= entryMin && min <= exitMin;
        });
        if (inWin) { greens++; profit += greenStake * GREEN_NET; chrono.push({ result: 'green', profit: greenStake * GREEN_NET }); }
        else {
          const eff = overrides[String(a.fixture_id)] ?? redStake;
          reds++; profit -= eff; chrono.push({ result: 'red', profit: -eff });
        }
        lastDate = a.created_at;
      }

      let peak = 0, equity = 0, maxDD = 0;
      let curG = 0, curR = 0;
      for (const c of chrono) {
        equity += c.profit;
        if (equity > peak) peak = equity;
        if (peak - equity > maxDD) maxDD = peak - equity;
        if (c.result === 'green') { curG++; curR = 0; }
        else if (c.result === 'red') { curR++; curG = 0; }
      }
      const lastRow = chrono.filter(c => c.result !== 'pending').pop();
      const streak = lastRow?.result === 'green' ? { type: 'green', count: curG } :
                    lastRow?.result === 'red' ? { type: 'red', count: curR } : null;
      const entries = greens + reds;
      const winRate = entries ? (greens / entries) * 100 : 0;
      const roi = entries ? (profit / entries) * 100 : 0;

      return { ...m, entries, greens, reds, profit, winRate, roi, maxDD, streak, lastDate };
    });
  }, [methods, alerts, fromMs, toMs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando métodos...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-6 h-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Métodos</h1>
            <p className="text-xs text-gray-500">Suas estratégias salvas. Crie novas na aba Simulação Free Fire do Robô.</p>
          </div>
        </div>
        <Link to="/robo">
          <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" /> Criar Novo</Button>
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap bg-[#1e2333] border border-[#2a3142] rounded-lg p-3">
        <CalendarDays className="w-4 h-4 text-gray-400" />
        <span className="text-xs text-gray-400 mr-2">Período:</span>
        {([
          ['today', 'Hoje'],
          ['7d', '7 dias'],
          ['30d', '30 dias'],
          ['this_month', 'Este mês'],
          ['all', 'Tudo'],
          ['custom', 'Personalizado'],
        ] as [Period, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={cn(
              'px-3 py-1 text-xs rounded-md border transition-colors',
              period === key
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-[#161b27] border-[#2a3142] text-gray-400 hover:text-white hover:border-[#3b4256]'
            )}
          >
            {label}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-[#161b27] border border-[#2a3142] rounded px-2 py-1 text-xs text-gray-200"
            />
            <span className="text-gray-500 text-xs">até</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-[#161b27] border border-[#2a3142] rounded px-2 py-1 text-xs text-gray-200"
            />
          </div>
        )}
        <div className="ml-auto text-[11px] text-gray-500">
          {enriched.reduce((s, m: any) => s + (m.entries || 0), 0)} entradas total
        </div>
      </div>

      {(!methods || methods.length === 0) && (
        <Card className="bg-[#1e2333] border-[#2a3142] border-dashed">
          <CardContent className="p-10 text-center text-gray-500">
            Nenhum método salvo. Vá em <Link to="/robo" className="text-emerald-400 underline">Robô</Link> → aba Reports → Simulação Free Fire e clique em "Salvar como Método".
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {enriched.map(m => (
          <Link key={m.id} to={`/robo/methods/${m.id}`}>
            <Card className="bg-[#1e2333] border-[#2a3142] hover:border-emerald-500/40 hover:bg-[#1e2333]/80 transition-all cursor-pointer h-full">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">{m.name}</h3>
                    <p className="text-[10px] text-gray-500">
                      Janela {m.entry_minute}'→{m.exit_minute}' · +{m.green_stake} / -{m.red_stake}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                </div>

                <div className="grid grid-cols-4 gap-2 text-center py-2 border-y border-[#2a3142]">
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase">WR</p>
                    <p className="text-sm font-bold text-emerald-400">{m.winRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase">ROI</p>
                    <p className={cn('text-sm font-bold', m.roi >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{m.roi.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase">Lucro</p>
                    <p className={cn('text-sm font-bold', m.profit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{m.profit >= 0 ? '+' : ''}{m.profit.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase">DD</p>
                    <p className="text-sm font-bold text-rose-400">-{m.maxDD.toFixed(1)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>{m.entries} entradas ({m.greens}G/{m.reds}R)</span>
                  {m.streak && (
                    <span className={m.streak.type === 'green' ? 'text-emerald-400' : 'text-rose-400'}>
                      {m.streak.count} {m.streak.type === 'green' ? 'G' : 'R'} seguidos
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-gray-600">
                  {m.lastDate ? `Último: ${format(parseISO(m.lastDate), 'dd/MM HH:mm')}` : 'Sem entradas ainda'} · Criado {format(parseISO(m.created_at), 'dd/MM/yyyy')}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default MethodsList;
