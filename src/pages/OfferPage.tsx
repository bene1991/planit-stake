import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, ShieldCheck, Sparkles, Check, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import DailyProfitCalendar from './robo/components/DailyProfitCalendar';

const GREEN_NET = 1 - 0.045;
const PRICE = 99;
const CHECKOUT_URL = 'https://wa.me/5500000000000?text=Quero%20entrar%20no%20grupo';

const fetchAllPaged = async (table: string, columns: string) => {
  let all: any[] = []; let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
};

const OfferPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: method, isLoading, error } = useQuery({
    queryKey: ['offer-method', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategy_simulations')
        .select('*')
        .eq('id', id!)
        .eq('is_public', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ['offer-alerts'],
    enabled: !!method,
    queryFn: () => fetchAllPaged('live_alerts', 'fixture_id, variation_id, league_id, created_at, final_score, goal_events, minute_at_alert'),
  });

  const stats = useMemo(() => {
    if (!method || !alerts) return null;
    const variationIds: string[] = method.filters_snapshot?.variation_ids || [];
    const quarantine = new Set((method.filters_snapshot?.quarantine_leagues || []).map(String));
    const overrides: Record<string, number> = method.filters_snapshot?.red_overrides || {};
    const entryMin = method.entry_minute;
    const exitMin = method.exit_minute;
    const greenStake = method.green_stake;
    const redStake = method.red_stake;

    const filtered = alerts.filter((a: any) =>
      variationIds.includes(a.variation_id) && !quarantine.has(String(a.league_id))
    );
    const byFix = new Map<string, any>();
    for (const a of filtered) {
      const k = String(a.fixture_id);
      const e = byFix.get(k);
      if (!e || (a.minute_at_alert || 0) < (e.minute_at_alert || 0)) byFix.set(k, a);
    }
    const dedup = Array.from(byFix.values())
      .sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime());

    const games: any[] = [];
    let greens = 0, reds = 0, profit = 0;
    for (const a of dedup) {
      const evs = typeof a.goal_events === 'string' ? JSON.parse(a.goal_events) : (a.goal_events || []);
      const hasFinal = a.final_score && a.final_score !== 'pending';
      const isOld = Date.now() - new Date(a.created_at).getTime() > 4 * 3600 * 1000;
      if (!hasFinal && !isOld) continue;
      const inWin = evs.some((e: any) => {
        const m = (e.minute || 0) + (e.extra || 0);
        return m >= entryMin && m <= exitMin;
      });
      let p = 0; let result: 'green' | 'red' = 'red';
      if (inWin) { greens++; p = greenStake * GREEN_NET; result = 'green'; }
      else { const eff = overrides[String(a.fixture_id)] ?? redStake; reds++; p = -eff; result = 'red'; }
      profit += p;
      games.push({ date: a.created_at, result, profit: p });
    }

    let peak = 0, eq = 0, maxDD = 0, curG = 0, curR = 0, maxG = 0, maxR = 0;
    const equityHist: { date: string; profit: number }[] = [];
    for (const g of games) {
      eq += g.profit;
      if (eq > peak) peak = eq;
      if (peak - eq > maxDD) maxDD = peak - eq;
      if (g.result === 'green') { curG++; curR = 0; if (curG > maxG) maxG = curG; }
      else { curR++; curG = 0; if (curR > maxR) maxR = curR; }
      equityHist.push({ date: g.date, profit: Number(eq.toFixed(2)) });
    }

    const total = greens + reds;
    const winRate = total ? (greens / total) * 100 : 0;
    const roi = total ? (profit / total) * 100 : 0;

    const monthly = new Map<string, { name: string; profit: number; greens: number; reds: number }>();
    for (const g of games) {
      const key = format(parseISO(g.date), 'yyyy-MM');
      if (!monthly.has(key)) monthly.set(key, { name: key, profit: 0, greens: 0, reds: 0 });
      const x = monthly.get(key)!;
      x.profit += g.profit;
      if (g.result === 'green') x.greens++; else x.reds++;
    }
    const monthlyArr = Array.from(monthly.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(x => ({
        ...x,
        profit: Number(x.profit.toFixed(2)),
        label: format(parseISO(x.name + '-01'), 'MMM/yy', { locale: ptBR }),
      }));

    return { games, greens, reds, total, profit, winRate, roi, maxDD, maxG, maxR, equityHist, monthlyArr };
  }, [method, alerts]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c0f17] flex items-center justify-center text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  if (error || !method) {
    return (
      <div className="min-h-screen bg-[#0c0f17] flex flex-col items-center justify-center text-gray-400 p-6 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Página não encontrada</h1>
        <p>Esta oferta não está mais disponível.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0f17] text-gray-100">
      {/* HERO */}
      <header className="border-b border-[#2a3142] bg-gradient-to-b from-emerald-950/30 to-transparent">
        <div className="max-w-[1100px] mx-auto px-6 py-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-5">
            <Sparkles className="w-3.5 h-3.5" /> MÉTODO COMPROVADO · {stats?.total || 0} ENTRADAS REAIS
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3">{method.name}</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Estratégia de trading esportivo automatizada — entrada {method.entry_minute}' até {method.exit_minute}',
            sinais enviados ao vivo direto no Telegram. Veja abaixo o histórico real de cada entrada.
          </p>
        </div>
      </header>

      {stats && (
        <main className="max-w-[1100px] mx-auto px-6 py-10 space-y-10">
          {/* STATS PRINCIPAIS */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Lucro Total" value={`${stats.profit >= 0 ? '+' : ''}${stats.profit.toFixed(2)} stk`} accent={stats.profit >= 0 ? 'green' : 'red'} highlight />
            <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} accent="green" sub={`${stats.greens}G / ${stats.reds}R`} />
            <StatCard label="ROI por Entrada" value={`${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`} accent={stats.roi >= 0 ? 'green' : 'red'} />
            <StatCard label="Drawdown Máx" value={`-${stats.maxDD.toFixed(2)} stk`} accent="red" sub="risco controlado" />
            <StatCard label="Entradas Totais" value={String(stats.total)} sub="amostra real" />
            <StatCard label="Streak Verde" value={String(stats.maxG)} sub="greens seguidos" accent="green" />
            <StatCard label="Streak Vermelho" value={String(stats.maxR)} sub="reds seguidos" accent="red" />
            <StatCard label="Janela" value={`${method.entry_minute}'→${method.exit_minute}'`} sub={`+${method.green_stake} / -${method.red_stake}`} />
          </section>

          {/* EQUITY CURVE */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> Evolução do Lucro
            </h2>
            <Card className="bg-[#1e2333] border-[#2a3142]">
              <CardContent className="p-4">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.equityHist}>
                      <defs>
                        <linearGradient id="eq2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#8b949e" tickFormatter={(d: any) => d ? format(parseISO(d), 'dd/MM') : ''} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10 }} stroke="#8b949e" />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1f2d', border: '1px solid #2a3142', fontSize: 12 }} formatter={(v: any) => [`${v} stk`, 'Lucro']} labelFormatter={(d: any) => d ? format(parseISO(d), "dd/MM/yyyy") : ''} />
                      <ReferenceLine y={0} stroke="#4b5563" />
                      <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#eq2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* CALENDÁRIO */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Resultados Diários</h2>
            <DailyProfitCalendar
              games={stats.games}
              greenStake={method.green_stake}
              redStake={method.red_stake}
            />
          </section>

          {/* MENSAL */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Performance Mês a Mês</h2>
            <Card className="bg-[#1e2333] border-[#2a3142]">
              <CardContent className="p-4">
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthlyArr}>
                      <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#8b949e" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#8b949e" />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1f2d', border: '1px solid #2a3142', fontSize: 12 }} formatter={(v: any, _n: any, p: any) => [`${v} stk (${p?.payload?.greens}G / ${p?.payload?.reds}R)`, 'Lucro']} />
                      <ReferenceLine y={0} stroke="#4b5563" />
                      <Bar dataKey="profit">
                        {stats.monthlyArr.map((m, i) => (
                          <rect key={i} fill={m.profit >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* OFERTA */}
          <section id="oferta" className="pt-6">
            <Card className="bg-gradient-to-br from-emerald-950/40 via-[#1e2333] to-[#1e2333] border-emerald-500/30">
              <CardContent className="p-8 md:p-12 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold mb-4">
                  ENTRADAS DIÁRIAS NO TELEGRAM
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
                  Entre no grupo do <span className="text-emerald-400">{method.name}</span>
                </h2>
                <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                  Receba os sinais ao vivo, no minuto exato da entrada, direto no seu Telegram.
                </p>

                <div className="grid md:grid-cols-2 gap-4 max-w-xl mx-auto text-left mb-8">
                  {[
                    'Sinais ao vivo no Telegram',
                    'Acesso ao histórico completo',
                    'Suporte direto pelo grupo',
                    'Atualizações e novos métodos',
                  ].map(b => (
                    <div key={b} className="flex items-start gap-2 text-sm text-gray-200">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> {b}
                    </div>
                  ))}
                </div>

                <div className="bg-[#0c0f17] border border-[#2a3142] rounded-xl p-6 max-w-sm mx-auto mb-6">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Investimento</p>
                  <p className="text-5xl font-extrabold text-white my-2">
                    R$ {PRICE}<span className="text-lg text-gray-400 font-normal">/mês</span>
                  </p>
                  <p className="text-xs text-gray-500">cancele quando quiser</p>
                </div>

                <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-base px-10 h-12">
                    <Send className="w-4 h-4 mr-2" /> Quero Entrar no Grupo
                  </Button>
                </a>

                <div className="mt-8 max-w-lg mx-auto bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3 text-left">
                  <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-300 mb-1">Garantia de Resultado</p>
                    <p className="text-xs text-gray-300">
                      Se o método der prejuízo no mês, <strong className="text-white">devolvo 100% do valor da mensalidade</strong>. Sem perguntas.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <footer className="text-center text-xs text-gray-600 pb-8 pt-4">
            * Resultados passados não garantem rentabilidade futura. Aposte com responsabilidade.
          </footer>
        </main>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; sub?: string; accent?: 'green' | 'red'; highlight?: boolean }> = ({ label, value, sub, accent, highlight }) => (
  <div className={cn(
    'rounded-xl border p-4',
    highlight ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-[#1e2333] border-[#2a3142]',
  )}>
    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
    <p className={cn(
      'text-2xl font-extrabold mt-1',
      accent === 'green' && 'text-emerald-400',
      accent === 'red' && 'text-rose-400',
      !accent && 'text-white',
    )}>{value}</p>
    {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

export default OfferPage;
