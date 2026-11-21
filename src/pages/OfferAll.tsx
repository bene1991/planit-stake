import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import DailyProfitCalendar from './robo/components/DailyProfitCalendar';
import { buildRows, finished, group, summary, onePerGame, ruleKey, ruleLabel, TZ, type Agg, type Method, type Row } from './offer/analysis';

const CONTACT_URL = 'https://wa.me/5500000000000?text=Quero%20saber%20mais%20sobre%20os%20m%C3%A9todos'; // ponytail: trocar pelo seu número

const f1 = (n: number) => n.toFixed(1).replace('.', ',');
const s2 = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}`;
const sign = (n: number) => `${n >= 0 ? '+' : ''}${f1(n)}`;
const tone = (n: number) => (n >= 0 ? 'text-emerald-400' : 'text-rose-400');
const brDay = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(d);
const brTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const monthLabel = (m: string) => format(parseISO(m + '-01'), 'MMMM/yy', { locale: ptBR });
const addDays = (day: string, n: number) => brDay(new Date(new Date(`${day}T12:00:00-03:00`).getTime() + n * 86400000));

type Preset = 'all' | 'today' | '7' | '30';
const PRESETS: { id: Preset; label: string }[] = [{ id: 'all', label: 'Tudo' }, { id: 'today', label: 'Hoje' }, { id: '7', label: '7 dias' }, { id: '30', label: '30 dias' }];
const TABS = ['Resumo', 'Jogos', 'Ligas', 'Times', 'Análises'] as const;
type Tab = (typeof TABS)[number];

const DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
const demoRow = (o: Partial<Row>): Row => ({
  key: String(Math.random()), methodId: 'x', method: '', fixture: 'd', league: '', home: '', away: '', date: new Date().toISOString(), day: '', month: '', weekday: 0, hour: 0,
  alertMin: 30, entryMin: 35, exitMin: 65, goalsAtEntry: 0, goalMin: null, score: null, liveScore: '0–0', liveMinute: 36, liveStatus: '1H',
  state: 'live', profit: null, isLive: true, notified: true, line: 0.5, hold: false, ...o,
});
const DEMO_ROWS: Row[] = [
  demoRow({ league: 'Brasileirão Série A', home: 'Flamengo', away: 'Palmeiras', liveScore: '0–0', liveMinute: 36, entryMin: 35, exitMin: 65, line: 0.5, method: "Entra aos 35' · sai aos 65'" }),
  demoRow({ league: 'La Liga', home: 'Athletic Club', away: 'Espanyol', liveScore: '1–0', liveMinute: 52, entryMin: 35, exitMin: 70, goalsAtEntry: 0, line: 0.5, state: 'green', goalMin: 44, method: "Entra aos 35' · sai aos 70'" }),
  demoRow({ league: 'Bundesliga 2', home: 'Darmstadt', away: 'Heidenheim', liveScore: '2–1', liveMinute: 51, entryMin: 50, exitMin: 111, goalsAtEntry: 3, line: 3.5, hold: true, method: "Entra aos 50' · sem saída" }),
  demoRow({ league: 'Superliga', home: 'Aarhus', away: 'Lyngby', liveScore: '2–1', liveMinute: 41, entryMin: 35, exitMin: 65, goalsAtEntry: 3, line: 3.5, method: "Entra aos 35' · sai aos 65'" }),
];

// Visitante sem login tem tempo limite curto no banco: páginas pequenas, poucas em paralelo e nova tentativa se falhar
async function fetchPublic(table: string, columns: string): Promise<any[]> {
  const db = supabase as any, size = 500;
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  const pages = Array.from({ length: Math.ceil((count || 0) / size) }, (_, i) => i);
  const out: any[][] = [];
  const one = async (i: number) => {
    for (let t = 0; ; t++) {
      const r = await db.from(table).select(columns).order('id').range(i * size, i * size + size - 1);
      if (!r.error) { out[i] = r.data || []; return; }
      if (t >= 3) throw r.error;
      await new Promise(res => setTimeout(res, 500 * (t + 1)));
    }
  };
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (next < pages.length) await one(pages[next++]); }));
  return out.flat();
}

export default function OfferAll({ embedded = false }: { embedded?: boolean }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['offer-all-v2'],
    staleTime: 60 * 1000, refetchInterval: 60 * 1000,
    queryFn: async () => {
      const db = supabase as any;
      const [m, alerts, radar] = await Promise.all([
        db.rpc('public_methods'),
        fetchPublic('live_alerts', 'id,fixture_id,variation_id,league_id,league_name,home_team,away_team,created_at,minute_at_alert,goal_events,final_score,notified_method_ids'),
        db.from('radar_live_fixtures').select('fixture_id,minute,home_score,away_score,status'),
      ]);
      if (m.error) throw m.error;
      return { methods: m.data as Method[], rows: buildRows(m.data as Method[], alerts, radar.data || []) };
    },
  });

  const [preset, setPreset] = useState<Preset>('all');
  const [month, setMonth] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [off, setOff] = useState<Set<string>>(new Set()); // métodos desligados no filtro
  const [league, setLeague] = useState('');
  const [result, setResult] = useState<'all' | 'green' | 'red'>('all');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('Resumo');
  const [dedupe, setDedupe] = useState(true); // um jogo por grupo de entrada é o padrão; só na aba do sistema dá para ver sem isso

  const today = brDay(new Date());
  const range = useMemo(() => {
    if (from || to) return { a: from || '0000', b: to || '9999' };
    if (month) return { a: `${month}-01`, b: `${month}-31` };
    if (preset === 'today') return { a: today, b: today };
    if (preset === '7') return { a: addDays(today, -6), b: today };
    if (preset === '30') return { a: addDays(today, -29), b: today };
    return { a: '0000', b: '9999' };
  }, [preset, month, from, to, today]);

  const rawAll = data?.rows || [];
  const all = useMemo(() => (embedded && !dedupe ? rawAll : onePerGame(rawAll)), [rawAll, embedded, dedupe]);
  const leagues = useMemo(() => group(all, r => r.league).sort((a, b) => b.n - a.n).map(x => x.key), [all]);
  const rules = useMemo(() => [...new Map((data?.methods || []).slice().sort((x, y) => x.entry_minute - y.entry_minute || x.exit_minute - y.exit_minute).map(m => [ruleKey(m), { id: ruleKey(m), label: ruleLabel(m) }])).values()], [data]);
  const months = useMemo(() => [...new Set(all.map(r => r.month))].sort().reverse(), [all]);
  const ql = q.trim().toLowerCase();
  const base = useMemo(() => all.filter(r =>
    !off.has(r.methodId) && (!league || r.league === league) &&
    (!ql || r.home.toLowerCase().includes(ql) || r.away.toLowerCase().includes(ql))), [all, off, league, ql]);
  const liveRows = useMemo(() => {
    if (DEMO) return DEMO_ROWS;
    const seen = new Set<string>(); // o mesmo jogo em dois métodos da mesma regra aparece uma vez só
    return base.filter(r => r.isLive && r.notified && !seen.has(`${r.fixture}|${r.methodId}`) && seen.add(`${r.fixture}|${r.methodId}`));
  }, [base]);
  const rows = useMemo(() => finished(base).filter(r => r.day >= range.a && r.day <= range.b && (result === 'all' || r.state === result)), [base, range, result]);
  const sum = useMemo(() => summary(rows), [rows]);
  const cmp = useMemo(() => {
    if (!embedded) return null;
    const pick = (src: Row[]) => summary(finished(src.filter(r => !off.has(r.methodId) && (!league || r.league === league) && (!ql || r.home.toLowerCase().includes(ql) || r.away.toLowerCase().includes(ql))))
      .filter(r => r.day >= range.a && r.day <= range.b && (result === 'all' || r.state === result)));
    return { com: pick(rawAll), sem: pick(onePerGame(rawAll)) };
  }, [embedded, rawAll, off, league, ql, range, result]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-[#0c0f17] text-gray-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...</div>;
  if (error || !data) return <div className="flex min-h-screen items-center justify-center bg-[#0c0f17] p-6 text-center text-gray-400">Não foi possível carregar agora. Tente de novo em instantes.</div>;

  const clearPeriod = () => { setMonth(''); setFrom(''); setTo(''); };
  const sel = 'h-9 rounded-lg border-0 bg-[#1a2030] px-3 text-[13px] text-gray-200 outline-none [color-scheme:dark] focus:ring-1 focus:ring-emerald-500/50';

  return (
    <div className="min-h-screen bg-[#0c0f17] text-gray-100">
      <header className="border-b border-[#2a3142]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-4 px-5 py-8 md:py-10">
          <div>
            <h1 className="max-w-3xl text-2xl font-black leading-tight text-white md:text-4xl">Lay no Under, no automático, com cada entrada registrada.</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">Acompanhe os jogos em operação, o histórico completo e a análise de cada método. Os avisos chegam no Telegram.</p>
          </div>
          {!embedded && <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-bold text-black hover:bg-emerald-400"><Send className="h-4 w-4" /> Falar comigo</a>}
        </div>
      </header>

      {/* FILTROS */}
      <div className={cn('sticky z-20 border-b border-white/5 bg-[#0c0f17]/90 backdrop-blur', embedded ? 'top-16' : 'top-0')}>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <Seg items={PRESETS.map(p => ({ id: p.id, label: p.label }))} value={!month && !from && !to ? preset : ''} onChange={id => { clearPeriod(); setPreset(id as Preset); }} />
          <select value={month} onChange={e => { setFrom(''); setTo(''); setMonth(e.target.value); }} className={sel} aria-label="Mês">
            <option value="">Mês</option>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <input type="date" value={from} onChange={e => { setMonth(''); setFrom(e.target.value); }} className={sel} aria-label="De" />
            <span className="text-xs text-gray-600">a</span>
            <input type="date" value={to} onChange={e => { setMonth(''); setTo(e.target.value); }} className={sel} aria-label="Até" />
          </div>
          <span className="hidden h-5 w-px bg-white/10 md:block" />
          <div className="flex flex-wrap gap-1.5">
            {rules.map(r => (
              <button key={r.id} onClick={() => setOff(s => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}
                className={cn('h-9 rounded-lg px-3 text-[13px] font-medium transition', off.has(r.id) ? 'bg-[#1a2030] text-gray-600 line-through' : 'bg-emerald-500/15 text-emerald-300')}>{r.label}</button>
            ))}
          </div>
          <span className="hidden h-5 w-px bg-white/10 md:block" />
          <select value={league} onChange={e => setLeague(e.target.value)} className={cn(sel, 'max-w-[200px]')} aria-label="Liga">
            <option value="">Todas as ligas</option>
            {leagues.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <Seg items={[{ id: 'all', label: 'Todos' }, { id: 'green', label: 'Greens' }, { id: 'red', label: 'Reds' }]} value={result} onChange={id => setResult(id as any)} />
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar time" className={cn(sel, 'w-40 pl-9')} /></div>
        </div>
      </div>

      <main className="mx-auto max-w-[1200px] space-y-8 px-5 py-8">
        {embedded && cmp && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-amber-300">Um jogo por grupo (esta caixa só aparece aqui no sistema)</h2>
                <p className="mt-0.5 text-xs text-gray-400">Se o jogo caiu em mais de um método do mesmo grupo (entra aos 35' ou entra aos 50'), conta uma vez só. No grupo dos 35' vale o de saída aos 70'. O mesmo jogo ainda pode contar nos dois grupos.</p>
              </div>
              <button onClick={() => setDedupe(d => !d)} className={cn('h-9 rounded-lg px-4 text-[13px] font-semibold', dedupe ? 'bg-amber-400 text-black' : 'bg-[#1a2030] text-gray-300')}>{dedupe ? 'Aplicado em tudo (clique para ver com repetição)' : 'Aplicar na página toda'}</button>
            </div>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              {([['Como está hoje (com repetição)', cmp.com], ['Um jogo por grupo', cmp.sem]] as const).map(([t, x]) => (
                <div key={t} className="rounded-xl bg-black/25 p-3">
                  <p className="text-xs text-gray-400">{t}</p>
                  <p className="mt-1 tabular-nums"><b className="text-white">{x.n}</b> entradas · lucro <b className={tone(x.profit)}>{sign(x.profit)}</b> · ROI <b className={tone(x.roi)}>{sign(x.roi * 100)}%</b></p>
                  <p className="mt-0.5 text-xs tabular-nums text-gray-500">acerto {f1(x.win)}% · maior queda -{f1(x.dd)} · sequência de reds {x.maxR}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* EM OPERAÇÃO */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" /></span>
            Em operação agora <span className="text-sm font-normal text-gray-500">({liveRows.length})</span>
          </h2>
          {liveRows.length === 0
            ? <p className="rounded-xl border border-dashed border-[#2a3142] p-6 text-center text-sm text-gray-500">Nenhum jogo em operação neste momento. Quando um método entrar, ele aparece aqui.</p>
            : <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{liveRows.map(r => <LiveCard key={r.key} r={r} />)}</div>}
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Lucro" value={`${sign(sum.profit)}`} sub="stakes" cls={tone(sum.profit)} />
          <Stat label="Entradas" value={String(sum.n)} sub={`${sum.greens} greens · ${sum.reds} reds`} />
          <Stat label="Acerto" value={`${f1(sum.win)}%`} />
          <Stat label="ROI" value={`${sign(sum.roi * 100)}%`} sub="lucro médio por entrada, sobre 1 stake" cls={tone(sum.roi)} />
          <Stat label="Maior queda" value={`-${f1(sum.dd)}`} sub="stakes, do pico ao fundo" cls="text-rose-400" />
          <Stat label="Maior sequência" value={`${sum.maxG} G · ${sum.maxR} R`} sub={`${sum.activeDays} dias com entrada`} />
        </section>

        <Seg items={TABS.map(t => ({ id: t, label: t }))} value={tab} onChange={id => setTab(id as Tab)} big />

        {rows.length === 0 ? <p className="py-10 text-center text-gray-500">Nenhum jogo com esses filtros.</p> : (
          <>
            {tab === 'Resumo' && <Resumo rows={rows} sum={sum} />}
            {tab === 'Jogos' && <Jogos rows={rows} />}
            {tab === 'Ligas' && <Table title="Resultado por liga" first="Liga" data={group(rows, r => r.league)} min={3} />}
            {tab === 'Times' && <Table title="Resultado por time (em casa ou fora)" first="Time" data={group(rows.flatMap(r => [{ ...r, home: r.home }, { ...r, home: r.away }]), r => r.home)} min={5} />}
            {tab === 'Análises' && <Analises rows={rows} />}
          </>
        )}

        <footer className="space-y-1 border-t border-[#2a3142] pt-6 text-xs leading-relaxed text-gray-500">
          <p>O histórico mostra o que o robô identificou em cada jogo. Parte dele é anterior à criação do método, calculado depois com os mesmos critérios, e não equivale a operações feitas ao vivo.</p>
          <p>Os reds usam o valor definido para cada método. Na prática a odd varia a cada jogo e o resultado pode ficar abaixo ou acima disso. Cada jogo conta uma vez por grupo de entrada (aos 35' ou aos 50'): se ele cai em mais de um método do mesmo grupo, entra uma vez só, e no grupo dos 35' vale o de saída aos 70'. O mesmo jogo ainda pode contar nos dois grupos.</p>
          <p>Resultados passados não garantem resultados futuros. Operar tem risco de perda. Aposte com responsabilidade.</p>
        </footer>
      </main>
    </div>
  );
}

function Seg({ items, value, onChange, big }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void; big?: boolean }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-[#1a2030] p-0.5">
      {items.map(i => (
        <button key={i.id} onClick={() => onChange(i.id)} className={cn('whitespace-nowrap rounded-md font-medium transition', big ? 'h-10 px-5 text-sm' : 'h-8 px-3 text-[13px]', value === i.id ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white')}>{i.label}</button>
      ))}
    </div>
  );
}

function LiveCard({ r }: { r: Row }) {
  const min = r.liveMinute;
  const line = String(r.line).replace('.', ',');
  const status = r.state === 'green' ? { t: `Green: saiu gol aos ${r.goalMin}'`, c: 'bg-emerald-500/15 text-emerald-300' }
    : min == null ? { t: 'Aguardando dados do jogo', c: 'bg-white/5 text-gray-400' }
    : min < r.entryMin ? { t: `Entra aos ${r.entryMin}'`, c: 'bg-amber-500/15 text-amber-300' }
    : r.hold || min <= r.exitMin ? { t: r.hold ? 'Posição aberta até o fim do jogo' : 'Dentro da janela, sem gol ainda', c: 'bg-sky-500/15 text-sky-300' }
    : { t: 'Janela encerrada sem gol', c: 'bg-rose-500/15 text-rose-300' };
  const pct = (m: number) => `${Math.min(100, (m / 95) * 100)}%`;
  const end = r.hold ? 95 : r.exitMin;
  return (
    <div className="rounded-2xl border border-white/5 bg-[#171c2b] p-4">
      <div className="flex items-center justify-between text-xs text-gray-500"><span className="truncate">{r.league}</span><span className="font-bold tabular-nums text-emerald-400">{r.liveStatus === 'HT' ? 'intervalo' : min != null ? `${min}'` : ''}</span></div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <p className="text-right text-[15px] font-semibold leading-tight">{r.home}</p>
        <p className="rounded-lg bg-black/40 px-3 py-1 text-xl font-black tabular-nums">{r.liveScore ?? '–'}</p>
        <p className="text-[15px] font-semibold leading-tight">{r.away}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-black/25 p-3 text-center">
        <div><p className="text-[11px] text-gray-500">Entrada</p><p className="mt-0.5 text-sm font-bold text-white">Lay Under {line}</p></div>
        <div><p className="text-[11px] text-gray-500">Entra</p><p className="mt-0.5 text-sm font-bold text-white">aos {r.entryMin}'</p></div>
        <div><p className="text-[11px] text-gray-500">Sai</p><p className="mt-0.5 text-sm font-bold text-white">{r.hold ? 'sem saída' : `aos ${r.exitMin}'`}</p></div>
      </div>
      <div className="relative mt-4 h-1.5 rounded-full bg-white/10">
        <div className="absolute inset-y-0 rounded-full bg-sky-400/40" style={{ left: pct(r.entryMin), width: `calc(${pct(end)} - ${pct(r.entryMin)})` }} />
        {min != null && <span className="absolute -top-1 h-3.5 w-[2px] rounded bg-emerald-400" style={{ left: pct(min) }} />}
      </div>
      <p className={cn('mt-3 rounded-lg px-3 py-1.5 text-center text-xs font-semibold', status.c)}>{status.t}</p>
    </div>
  );
}

function Resumo({ rows, sum }: { rows: Row[]; sum: ReturnType<typeof summary> }) {
  const months = group(sum.done, r => r.month).sort((a, b) => a.key.localeCompare(b.key)).map(a => ({ label: format(parseISO(a.key + '-01'), 'MMM/yy', { locale: ptBR }), profit: +a.profit.toFixed(2), n: a.n, win: a.win }));
  const days = group(sum.done, r => r.day).sort((a, b) => a.key.localeCompare(b.key)).slice(-45).map(a => ({ label: a.key.slice(5).split('-').reverse().join('/'), profit: +a.profit.toFixed(2), n: a.n, win: a.win }));
  const calendar = sum.done.map(r => ({ date: r.date, result: r.state, profit: r.profit! }));
  return (
    <div className="space-y-6">
      <Card title="Evolução do lucro (stakes)"><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sum.curve}>
          <defs><linearGradient id="eqo" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.45} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#8b949e" tickFormatter={(d: any) => (d ? format(parseISO(d), 'dd/MM') : '')} minTickGap={40} />
          <YAxis tick={{ fontSize: 10 }} stroke="#8b949e" />
          <Tooltip contentStyle={tip} formatter={(v: any) => [`${v} stakes`, 'Acumulado']} labelFormatter={(d: any) => (d ? format(parseISO(d), 'dd/MM/yyyy HH:mm') : '')} />
          <ReferenceLine y={0} stroke="#4b5563" />
          <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#eqo)" />
        </AreaChart></ResponsiveContainer></div></Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Mês a mês"><Bars data={months} /></Card>
        <Card title="Dia a dia (últimos 45 dias com entrada)"><Bars data={days} /></Card>
      </div>
      <Table title="Comparativo por regra" first="Regra" data={group(rows, r => r.method)} min={1} />
      <Card title="Calendário de resultados"><DailyProfitCalendar games={calendar} greenStake={1} redStake={1} /></Card>
    </div>
  );
}

function Jogos({ rows }: { rows: Row[] }) {
  const [shown, setShown] = useState(30);
  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">{rows.length} jogos finalizados, do mais recente ao mais antigo.</p>
      <div className="overflow-hidden rounded-xl border border-[#2a3142] bg-[#1e2333]">
        {rows.slice(0, shown).map(r => (
          <div key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-[#2a3142] px-4 py-3 last:border-0 md:grid-cols-[110px_1fr_190px_120px_70px]">
            <span className="text-xs tabular-nums text-gray-500 md:order-none">{brTime(r.date)}</span>
            <span className="col-span-2 text-sm font-semibold md:col-span-1">{r.home} <span className="mx-1 tabular-nums text-white">{r.score ?? '–'}</span> {r.away}<span className="block text-[11px] font-normal text-gray-500">{r.league}</span></span>
            <span className="text-xs text-gray-400">{r.method}<span className="block text-[11px] text-gray-500">alerta aos {r.alertMin}' · {r.goalMin != null ? `gol aos ${r.goalMin}'` : 'sem gol na janela'}</span></span>
            <span className={cn('text-xs font-bold', r.state === 'green' ? 'text-emerald-400' : 'text-rose-400')}>{r.state === 'green' ? 'GREEN' : 'RED'}</span>
            <span className={cn('text-right text-sm font-bold tabular-nums', tone(r.profit || 0))}>{sign(r.profit || 0)}</span>
          </div>
        ))}
      </div>
      {shown < rows.length && <button onClick={() => setShown(s => s + 50)} className="mx-auto mt-3 block rounded-md border border-[#2a3142] px-4 py-2 text-sm text-gray-300 hover:text-white">Ver mais 50</button>}
    </div>
  );
}

function Analises({ rows }: { rows: Row[] }) {
  const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const wd = group(rows, r => String(r.weekday)).sort((a, b) => +a.key - +b.key).map(a => ({ label: WD[+a.key], profit: +a.profit.toFixed(2), n: a.n, win: a.win }));
  const hr = group(rows, r => String(r.hour)).sort((a, b) => +a.key - +b.key).map(a => ({ label: `${a.key}h`, profit: +a.profit.toFixed(2), n: a.n, win: a.win }));
  const mn = group(rows, r => String(Math.floor(r.alertMin / 5) * 5)).sort((a, b) => +a.key - +b.key).map(a => ({ label: `${a.key}'`, profit: +a.profit.toFixed(2), n: a.n, win: a.win }));
  const gl = group(rows, r => String(Math.min(r.goalsAtEntry, 4))).sort((a, b) => +a.key - +b.key).map(a => ({ label: +a.key >= 4 ? '4+ gols' : `${a.key} gol${a.key === '1' ? '' : 's'}`, profit: +a.profit.toFixed(2), n: a.n, win: a.win }));
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title="Por dia da semana (hora de Brasília)"><Bars data={wd} /></Card>
      <Card title="Por hora do alerta (Brasília)"><Bars data={hr} /></Card>
      <Card title="Por minuto do alerta (faixas de 5)"><Bars data={mn} /></Card>
      <Card title="Por gols no jogo na hora da entrada"><Bars data={gl} /></Card>
    </div>
  );
}

function Table({ title, first, data, min }: { title: string; first: string; data: Agg[]; min: number }) {
  const [by, setBy] = useState<keyof Agg>('profit');
  const [asc, setAsc] = useState(false);
  const [lim, setLim] = useState(25);
  const list = data.filter(d => d.n >= min).sort((a, b) => { const x = a[by], y = b[by]; const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number); return asc ? c : -c; });
  const th = (k: keyof Agg, label: string, right = true) => (
    <th onClick={() => { by === k ? setAsc(!asc) : (setBy(k), setAsc(false)); }} className={cn('cursor-pointer select-none px-3 py-2 font-semibold hover:text-white', right && 'text-right')}>{label}{by === k ? (asc ? ' ↑' : ' ↓') : ''}</th>
  );
  return (
    <Card title={title} note={min > 1 ? `Só aparecem com ${min}+ entradas. Clique no título da coluna para ordenar.` : 'Clique no título da coluna para ordenar.'}>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="text-xs text-gray-500"><tr>{th('key', first, false)}{th('n', 'Entradas')}{th('greens', 'Greens')}{th('reds', 'Reds')}{th('win', 'Acerto')}{th('profit', 'Lucro')}{th('roi', 'ROI')}</tr></thead>
        <tbody>{list.slice(0, lim).map(d => (
          <tr key={d.key} className="border-t border-[#2a3142]">
            <td className="px-3 py-2 font-medium">{d.key}</td><td className="px-3 py-2 text-right tabular-nums">{d.n}</td>
            <td className="px-3 py-2 text-right tabular-nums text-emerald-400">{d.greens}</td><td className="px-3 py-2 text-right tabular-nums text-rose-400">{d.reds}</td>
            <td className="px-3 py-2 text-right tabular-nums">{f1(d.win)}%</td>
            <td className={cn('px-3 py-2 text-right font-bold tabular-nums', tone(d.profit))}>{sign(d.profit)}</td>
            <td className={cn('px-3 py-2 text-right tabular-nums', tone(d.roi))}>{sign(d.roi * 100)}%</td>
          </tr>))}</tbody>
      </table></div>
      {list.length > lim && <button onClick={() => setLim(l => l + 25)} className="mt-3 text-sm font-semibold text-emerald-400">Ver mais</button>}
      {list.length === 0 && <p className="py-4 text-center text-sm text-gray-500">Nada com {min}+ entradas nesse filtro.</p>}
    </Card>
  );
}

const tip = { backgroundColor: '#1a1f2d', border: '1px solid #2a3142', fontSize: 12 };
function Bars({ data }: { data: { label: string; profit: number; n: number; win: number }[] }) {
  return (
    <div className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#8b949e" interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} stroke="#8b949e" />
        <Tooltip contentStyle={tip} formatter={(v: any, _n: any, p: any) => [`${v} stakes · ${p?.payload?.n} entradas · ${f1(p?.payload?.win)}% acerto`, 'Lucro']} />
        <ReferenceLine y={0} stroke="#4b5563" />
        <Bar dataKey="profit">{data.map((x, i) => <Cell key={i} fill={x.profit >= 0 ? '#10b981' : '#ef4444'} />)}</Bar>
      </BarChart>
    </ResponsiveContainer></div>
  );
}

const Card: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <div className="rounded-xl border border-[#2a3142] bg-[#1e2333] p-4">
    <h3 className="mb-3 text-sm font-bold text-white">{title}</h3>
    {children}
    {note && <p className="mt-2 text-[11px] text-gray-500">{note}</p>}
  </div>
);

const Stat: React.FC<{ label: string; value: string; sub?: string; cls?: string }> = ({ label, value, sub, cls }) => (
  <div className="rounded-xl border border-[#2a3142] bg-[#1e2333] p-4">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={cn('mt-1 text-2xl font-extrabold text-white', cls)}>{value}</p>
    {sub && <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>}
  </div>
);
