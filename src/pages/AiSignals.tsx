import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const db = supabase as any;
const LEVEL: Record<string, { label: string; bar: string; chip: string }> = {
  frio: { label: 'Frio', bar: 'bg-sky-500', chip: 'bg-sky-500/15 text-sky-300' },
  morno: { label: 'Morno', bar: 'bg-amber-400', chip: 'bg-amber-500/15 text-amber-300' },
  quente: { label: 'Quente', bar: 'bg-orange-500', chip: 'bg-orange-500/15 text-orange-300' },
  muito_quente: { label: 'Muito quente', bar: 'bg-rose-500', chip: 'bg-rose-500/15 text-rose-300' },
};
const brDay = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const usd = (n: number) => `US$ ${n.toFixed(n < 1 ? 3 : 2)}`;
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'agora' : `há ${m} min`; };

export default function AiSignals() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-signals'],
    refetchInterval: 30000, staleTime: 0,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, error } = await db.from('ai_game_signals')
        .select('id,fixture_id,league_name,home_team,away_team,minute,score,heat,goal_chance,level,trend,summary,drivers,model,tokens_in,tokens_out,cost_usd,goal_next25,created_at')
        .gte('created_at', since).order('created_at', { ascending: false }).limit(3000);
      if (error) throw error;
      return data as any[];
    },
  });
  const [minHeat, setMinHeat] = useState(0);
  const rows = data || [];

  const live = useMemo(() => {
    const seen = new Set<string>(); const out: any[] = [];
    for (const r of rows) { if (seen.has(r.fixture_id)) continue; seen.add(r.fixture_id); if (Date.now() - new Date(r.created_at).getTime() < 12 * 60000) out.push(r); }
    return out.filter(r => r.heat >= minHeat).sort((a, b) => b.heat - a.heat);
  }, [rows, minHeat]);

  const cost = useMemo(() => {
    const today = brDay();
    const day = rows.filter(r => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(r.created_at)) === today);
    const sum = (a: any[]) => a.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
    const byDay = new Map<string, number>(); for (const r of rows) { const d = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(r.created_at)); byDay.set(d, (byDay.get(d) || 0) + Number(r.cost_usd || 0)); }
    return { today: sum(day), todayN: day.length, week: sum(rows), weekN: rows.length, perCall: rows.length ? sum(rows) / rows.length : 0, tin: rows.length ? rows.reduce((s, r) => s + (r.tokens_in || 0), 0) / rows.length : 0, tout: rows.length ? rows.reduce((s, r) => s + (r.tokens_out || 0), 0) / rows.length : 0, days: byDay.size, model: rows[0]?.model };
  }, [rows]);

  // a IA acerta? compara a chance dita com o que aconteceu depois (saiu gol nos 25 min seguintes)
  const calib = useMemo(() => {
    const res = rows.filter(r => r.goal_next25 != null && r.goal_chance != null);
    const buckets = [[0, 45], [45, 52], [52, 59], [59, 66], [66, 101]];
    const rate = (x: any[]) => (x.length ? (x.filter(r => r.goal_next25).length / x.length) * 100 : null);
    return { n: res.length, base: rate(res),
      rows: buckets.map(([a, b]) => { const x = res.filter(r => r.goal_chance >= a && r.goal_chance < b); return { label: b > 100 ? `${a}%+` : a === 0 ? `até ${b - 1}%` : `${a}–${b - 1}%`, n: x.length, real: rate(x), said: x.length ? x.reduce((s, r) => s + r.goal_chance, 0) / x.length : null }; }),
      hot: (() => { const x = res.filter(r => r.level === 'quente' || r.level === 'muito_quente'); return { n: x.length, real: rate(x) }; })(),
      cold: (() => { const x = res.filter(r => r.level === 'frio'); return { n: x.length, real: rate(x) }; })() };
  }, [rows]);

  if (isLoading) return <div className="flex justify-center py-20 text-zinc-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...</div>;
  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-black text-white">IA: jogo quente</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">A IA lê as estatísticas ao vivo de cada jogo e diz o quanto ele está quente e a chance de gol nos próximos 25 minutos. É uma leitura do jogo, não uma dica de aposta. Piloto nas ligas principais, jogos entre os minutos 20 e 65.</p>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Agora <span className="text-sm font-normal text-zinc-500">({live.length} jogos)</span></h2>
          <div className="inline-flex rounded-lg bg-zinc-900 p-0.5 text-[13px]">
            {[[0, 'Todos'], [50, 'Quentes (50+)'], [70, 'Muito quentes (70+)']].map(([v, l]) => (
              <button key={String(v)} onClick={() => setMinHeat(Number(v))} className={cn('h-8 rounded-md px-3 font-medium', minHeat === v ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white')}>{l}</button>))}
          </div>
        </div>
        {live.length === 0
          ? <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">Nenhuma leitura recente. A IA analisa os jogos das ligas principais entre os minutos 20 e 65, a cada 5 minutos.</p>
          : <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{live.map(r => <SignalCard key={r.id} r={r} />)}</div>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-white">A IA está acertando?</h2>
        {calib.n < 30
          ? <p className="rounded-xl border border-white/10 bg-zinc-900/50 p-4 text-sm text-zinc-400">Ainda poucas leituras com resultado ({calib.n}). Depois de umas 200, esta tabela mostra se a chance que a IA diz bate com os gols que saíram nos 25 minutos seguintes.</p>
          : <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
              <p className="mb-3 text-sm text-zinc-400">{calib.n} leituras com resultado. Taxa geral de gol nesse prazo: {calib.base != null ? `${calib.base.toFixed(0)}%` : '–'}. Quando a IA diz uma chance, em quantas vezes saiu gol de verdade em 25 minutos?</p>
              <table className="w-full text-sm"><thead className="text-xs text-zinc-500"><tr><th className="py-1 text-left font-medium">Chance dita</th><th className="text-right font-medium">Leituras</th><th className="text-right font-medium">Média dita</th><th className="text-right font-medium">Saiu gol</th></tr></thead>
                <tbody>{calib.rows.map(b => <tr key={b.label} className="border-t border-white/5"><td className="py-1.5">{b.label}</td><td className="text-right tabular-nums">{b.n}</td><td className="text-right tabular-nums">{b.said != null ? `${b.said.toFixed(0)}%` : '–'}</td><td className="text-right font-bold tabular-nums">{b.real != null ? `${b.real.toFixed(0)}%` : '–'}</td></tr>)}</tbody></table>
              <p className="mt-3 text-xs text-zinc-500">Jogos "quente" ou "muito quente": gol em {calib.hot.real != null ? `${calib.hot.real.toFixed(0)}%` : '–'} das {calib.hot.n} leituras. Jogos "frio": {calib.cold.real != null ? `${calib.cold.real.toFixed(0)}%` : '–'} das {calib.cold.n}. Se os dois números forem parecidos, a IA não está separando jogo quente de jogo frio.</p>
            </div>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-white">Custo</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Box label="Hoje" value={usd(cost.today)} sub={`${cost.todayN} análises`} />
          <Box label="Últimos 7 dias" value={usd(cost.week)} sub={`${cost.weekN} análises em ${cost.days} dias`} />
          <Box label="Por análise" value={usd(cost.perCall)} sub={`${Math.round(cost.tin)} tokens entrada, ${Math.round(cost.tout)} saída`} />
          <Box label="Projeção por mês" value={cost.days ? usd((cost.week / cost.days) * 30) : '–'} sub={cost.model ? `modelo ${cost.model}` : ''} />
        </div>
      </section>
    </div>
  );
}

function SignalCard({ r }: { r: any }) {
  const L = LEVEL[r.level] || LEVEL.morno;
  const Trend = r.trend === 'subindo' ? TrendingUp : r.trend === 'caindo' ? TrendingDown : Minus;
  return (
    <div className="rounded-2xl border border-white/5 bg-[#171c2b] p-4">
      <div className="flex items-center justify-between text-xs text-zinc-500"><span className="truncate">{r.league_name}</span><span className="font-bold tabular-nums text-emerald-400">{r.minute}'</span></div>
      <p className="mt-2 text-center text-[15px] font-semibold leading-tight text-white">{r.home_team} <span className="mx-1 rounded bg-black/40 px-2 py-0.5 tabular-nums">{String(r.score).replace('-', '–')}</span> {r.away_team}</p>
      <div className="mt-4 flex items-end justify-between">
        <div><p className="text-[11px] text-zinc-500">Chance de gol em 25 min</p><p className="text-3xl font-black tabular-nums text-white">{r.goal_chance}%</p></div>
        <span className={cn('inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold', L.chip)}><Trend className="h-3.5 w-3.5" />{L.label}</span>
      </div>
      <div className="mt-3"><div className="flex justify-between text-[11px] text-zinc-500"><span>Intensidade</span><span className="tabular-nums">{r.heat}/100</span></div><div className="mt-1 h-1.5 rounded-full bg-white/10"><div className={cn('h-full rounded-full', L.bar)} style={{ width: `${r.heat}%` }} /></div></div>
      <p className="mt-3 text-[13px] leading-snug text-zinc-300">{r.summary}</p>
      {Array.isArray(r.drivers) && r.drivers.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{r.drivers.map((d: string, i: number) => <span key={i} className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-zinc-400">{d}</span>)}</div>}
      <p className="mt-3 text-[11px] text-zinc-600">Analisado {ago(r.created_at)}</p>
    </div>
  );
}

const Box = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-extrabold text-white">{value}</p>{sub && <p className="mt-0.5 text-[11px] text-zinc-500">{sub}</p>}</div>
);
