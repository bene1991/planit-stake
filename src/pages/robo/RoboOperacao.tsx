import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ExternalLink, Loader2, Undo2, Activity } from 'lucide-react';
import { StatBar } from '@/components/robo/LiveRadarGrid';

const db = supabase as any;
const GREEN_NET = 0.955;
const LAYBACK = 'https://polymarket.layback.trade/exchange/';
const spDay = (d: Date | string) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const shiftDay = (day: string, n: number) => spDay(new Date(new Date(`${day}T12:00:00-03:00`).getTime() + n * 86400000));

// red real em stakes (positivo): sem saída antecipada vale o risco cheio (entrada − 1); com saída, entrada/saída − 1
const redFromOdds = (hold: boolean, e: number | null, x: number | null) =>
  hold ? (e ? e - 1 : null) : (e && x ? e / x - 1 : null);
const n2 = (x: number) => x.toFixed(2).replace('.', ',');
const parseOdd = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 1 ? n : null;
};
const totalOf = (score?: string | null) => {
  const m = /^(\d+)\s*[x-]\s*(\d+)$/i.exec((score || '').trim());
  return m ? +m[1] + +m[2] : null;
};
const brTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

type Op = {
  key: string; fixtureId: string; method: any; home: string; away: string; league: string;
  sentAt: string; entryMin: number; entryGoals: number; line: number | null; slug: string | null; robotOdd: number | null;
  live: any | null; goalsNow: number; finished: boolean; outcome: 'green' | 'red' | null; late: boolean;
  needsExit: boolean; stats: any; entered: any | null; entryOdd: number | null; exitOdd: number | null;
  redMethod: number; profit: number | null; redReal: boolean; hold: boolean;
};


// Modo demonstração (?demo=1): jogos fictícios só na tela, nada é gravado.
const DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const M35 = { id: 'm1', name: 'Novo 35-65', entry_minute: 35, exit_minute: 65, red_stake: 1.7, green_stake: 1 };
const M70 = { id: 'm2', name: 'p mod. gols 35-70', entry_minute: 35, exit_minute: 70, red_stake: 2.4, green_stake: 1 };
const M50 = { id: 'm3', name: 'Pressão Moderada 50+', entry_minute: 50, exit_minute: 111, red_stake: 3.5, green_stake: 1 };
const dstats = (a: number, b: number) => ({ h: { shots: 9 + a, shotsOn: 4 + a, shotsInBox: 6, corners: 5, xg: 1.1, possession: 56 }, a: { shots: 4 + b, shotsOn: 1 + b, shotsInBox: 2, corners: 2, xg: 0.4, possession: 44 } });
const base = { sentAt: '', slug: 'demo', late: false, redReal: false, hold: false } as const;
const demoOps = (): Op[] => [
  { ...base, key: 'd1', fixtureId: 'd1', method: M35, home: 'Flamengo', away: 'Palmeiras', league: 'Brasileirão Série A', sentAt: ago(4), entryMin: 36, entryGoals: 0, line: 0.5, robotOdd: 9.25,
    live: { minute: 37, home_score: 0, away_score: 0, status: '1H' }, goalsNow: 0, finished: false, outcome: null, needsExit: false, stats: dstats(2, 0), entered: null, entryOdd: 9.25, exitOdd: null, redMethod: 1.7, profit: null },
  { ...base, key: 'd2', fixtureId: 'd1', method: M70, home: 'Flamengo', away: 'Palmeiras', league: 'Brasileirão Série A', sentAt: ago(4), entryMin: 36, entryGoals: 0, line: 0.5, robotOdd: 9.25,
    live: { minute: 37, home_score: 0, away_score: 0, status: '1H' }, goalsNow: 0, finished: false, outcome: null, needsExit: false, stats: dstats(2, 0), entered: null, entryOdd: 9.25, exitOdd: null, redMethod: 2.4, profit: null },
  { ...base, key: 'd3', fixtureId: 'd3', method: M35, home: 'Boca Juniors', away: 'River Plate', league: 'Liga Profesional', sentAt: ago(31), entryMin: 40, entryGoals: 1, line: 1.5, robotOdd: 6.06,
    live: { minute: 66, home_score: 1, away_score: 0, status: '2H' }, goalsNow: 1, finished: false, outcome: null, needsExit: true, stats: dstats(1, 1), entered: { id: 'x' }, entryOdd: 6.06, exitOdd: null, redMethod: 1.7, profit: null },
  { ...base, key: 'd4', fixtureId: 'd4', method: M50, home: 'Inter', away: 'Milan', league: 'Serie A', sentAt: ago(70), entryMin: 50, entryGoals: 0, line: 0.5, robotOdd: 3.28,
    live: { minute: 61, home_score: 0, away_score: 0, status: '2H' }, goalsNow: 0, finished: false, outcome: null, needsExit: false, stats: dstats(3, 2), entered: { id: 'x' }, entryOdd: 3.4, exitOdd: null, redMethod: 3.5, profit: null },
  { ...base, key: 'd5', fixtureId: 'd5', method: M35, home: 'Remo', away: 'Chapecoense', league: 'Brasileirão Série A', sentAt: ago(150), entryMin: 35, entryGoals: 0, line: 0.5, robotOdd: 14.69,
    live: null, goalsNow: 1, finished: true, outcome: 'green', needsExit: false, stats: null, entered: { id: 'x' }, entryOdd: 14.69, exitOdd: null, redMethod: 1.7, profit: 0.955 },
  { ...base, key: 'd6', fixtureId: 'd6', method: M70, home: 'México', away: 'Jamaica', league: 'Nations League', sentAt: ago(200), entryMin: 36, entryGoals: 1, line: 1.5, robotOdd: 8.7,
    live: null, goalsNow: 1, finished: true, outcome: 'red', needsExit: false, stats: null, entered: { id: 'x' }, entryOdd: 8.7, exitOdd: 6.06, redMethod: 2.4, profit: -(8.7 / 6.06 - 1), redReal: true },
  { ...base, key: 'd7', fixtureId: 'd7', method: M50, home: 'Chile', away: 'Colômbia', league: 'Amistoso', sentAt: ago(260), entryMin: 50, entryGoals: 0, line: 0.5, robotOdd: 3.28,
    live: null, goalsNow: 0, finished: true, outcome: 'red', needsExit: false, stats: null, entered: { id: 'x' }, entryOdd: 3.28, exitOdd: null, redMethod: 3.5, profit: -3.5 },
];

function useOps(day: string) {
  return useQuery({
    queryKey: ['live-operacao', day],
    refetchInterval: 30000,
    staleTime: 0, refetchOnMount: 'always', // sempre lê os overrides atuais do método
    queryFn: async (): Promise<Op[]> => {
      if (DEMO) return demoOps();
      // janela do dia escolhido (horário de São Paulo), com folga: o alerta nasce ~20 min antes do aviso do Telegram
      const since = new Date(new Date(`${day}T00:00:00-03:00`).getTime() - 3 * 3600 * 1000).toISOString();
      const until = new Date(new Date(`${day}T00:00:00-03:00`).getTime() + 30 * 3600 * 1000).toISOString();
      const [m, a, s, r, o, bl] = await Promise.all([
        db.from('strategy_simulations').select('id,name,entry_minute,exit_minute,green_stake,red_stake,filters_snapshot'),
        db.from('live_alerts').select('fixture_id,league_id,home_team,away_team,league_name,created_at,minute_at_alert,notified_method_ids,entry_goals,goal_events,final_score,stats_snapshot').gte('created_at', since).lte('created_at', until),
        db.from('polymarket_snapshots').select('fixture_id,method_id,odd,line,event_slug,minute,created_at,goals_total,found').gte('created_at', since).lte('created_at', until).order('created_at', { ascending: false }),
        db.from('radar_live_fixtures').select('fixture_id,minute,home_score,away_score,status,stats_snapshot'),
        db.from('live_operations').select('*'), // sem filtro de data: um jogo de dias atrás pode ter sido registrado hoje
        db.from('robot_blocked_leagues').select('league_id').eq('active', true),
      ]);
      const blocked = new Set<string>((bl.data || []).map((x: any) => String(x.league_id))); // ligas bloqueadas (global)
      const methods = new Map<string, any>((m.data || []).map((x: any) => [x.id, x]));
      const live = new Map<string, any>((r.data || []).map((x: any) => [String(x.fixture_id), x]));
      const snaps = new Map<string, any>();
      for (const x of s.data || []) if (x.found && !snaps.has(`${x.fixture_id}|${x.method_id}`)) snaps.set(`${x.fixture_id}|${x.method_id}`, x);
      const entered = new Map<string, any>((o.data || []).map((x: any) => [`${x.fixture_id}|${x.method_id}`, x]));
      const rows: any[] = a.data || [];
      const byFix = new Map<string, any[]>();
      for (const x of rows) { const k = String(x.fixture_id); byFix.set(k, [...(byFix.get(k) || []), x]); }

      const ops = new Map<string, Op>();
      for (const al of rows) {
        const fid = String(al.fixture_id);
        const group = byFix.get(fid)!;
        const finalScore = group.map(g => g.final_score).find(Boolean) as string | undefined;
        const events: any[] = group.map(g => g.goal_events || []).sort((x, y) => y.length - x.length)[0] || [];
        for (const mid of (al.notified_method_ids || []) as string[]) {
          const key = `${fid}|${mid}`;
          const method = methods.get(mid);
          if (!method || ops.has(key)) continue;
          const lid = String(al.league_id);
          if (blocked.has(lid) || (method.filters_snapshot?.quarantine_leagues || []).map(String).includes(lid)) continue; // liga bloqueada ou em quarentena do método
          const snap = snaps.get(key);
          const lv = live.get(fid) || null;
          const entryMin = snap?.minute ?? Math.max(method.entry_minute || 0, al.minute_at_alert || 0);
          const exitMin = method.exit_minute ?? 999;
          const goalsNow = lv ? (lv.home_score || 0) + (lv.away_score || 0) : (totalOf(finalScore) ?? 0);
          // final_score é gravado com o placar parcial durante o jogo: só vale como fim se o jogo não está mais ao vivo
          const ageMin = (Date.now() - new Date(al.created_at).getTime()) / 60000;
          const finished = lv ? ['FT', 'AET', 'PEN'].includes(String(lv.status)) || (!!finalScore && ageMin > 150)
            : (!!finalScore && ageMin > 100) || ageMin > 210;
          const sorted = [...events].sort((x, y) => x.minute - y.minute);
          const complete = sorted.length >= goalsNow && (finished || !!lv);
          // placar na entrada: gols antes do minuto de entrada (retroativo); senão o gravado pelo robô
          const entryGoals = complete && finished ? sorted.filter(g => g.minute < entryMin).length
            : (al.entry_goals || {})[mid] ?? snap?.goals_total ?? 0;
          let outcome: 'green' | 'red' | null = null, late = false;
          if (finished && complete) {
            const inWin = sorted.some(g => g.minute >= entryMin && g.minute <= exitMin);
            outcome = inWin ? 'green' : 'red';
            late = !inWin && goalsNow > entryGoals;
          } else if (goalsNow > entryGoals) {
            const nth = sorted[entryGoals];
            if (nth) { outcome = nth.minute <= exitMin ? 'green' : 'red'; late = outcome === 'red'; }
            else if (lv && !finished) { outcome = (lv.minute || 0) <= exitMin + 1 ? 'green' : null; }
            else outcome = 'green';
          } else if (finished) outcome = 'red';
          const en = entered.get(key) || null;
          // correções feitas na página do método (por jogo): resultado e red
          const ro = method.filters_snapshot?.result_overrides?.[fid];
          if (ro === 'green' || ro === 'red') { outcome = ro; late = false; }
          const robotOdd = snap?.odd ? Number(snap.odd) : null;
          const entryOdd = en?.entry_odd ? Number(en.entry_odd) : robotOdd;
          const exitOdd = en?.exit_odd ? Number(en.exit_odd) : null;
          const redMethod = Number(method.filters_snapshot?.red_overrides?.[fid] ?? method.red_stake ?? 0);
          const hold = !(method.exit_minute < 95);
          let profit: number | null = null, redReal = false;
          if (outcome === 'green') profit = Number(method.green_stake || 1) * GREEN_NET;
          else if (outcome === 'red') {
            const rOv = method.filters_snapshot?.red_overrides?.[fid]; // red digitado na página do método manda
            const r = rOv != null ? Number(rOv) : en ? redFromOdds(hold, entryOdd, exitOdd) : null;
            if (r != null) { profit = -r; redReal = true; } else profit = -redMethod;
          }
          ops.set(key, {
            key, fixtureId: fid, method, home: al.home_team, away: al.away_team, league: al.league_name,
            sentAt: snap?.created_at || al.created_at, entryMin, entryGoals, line: snap?.line ?? null, slug: snap?.event_slug ?? null,
            robotOdd, live: lv, goalsNow, finished, outcome, late,
            needsExit: !!lv && exitMin < 95 && (lv.minute || 0) >= exitMin && outcome === null,
            stats: lv?.stats_snapshot || al.stats_snapshot?.fullMatch || null, entered: en, entryOdd, exitOdd, redMethod, profit, redReal, hold,
          });
        }
      }
      return [...ops.values()].sort((x, y) => +new Date(y.sentAt) - +new Date(x.sentAt));
    },
  });
}

export default function RoboOperacao() {
  const todayStr = spDay(new Date());
  const [day, setDay] = useState(todayStr);
  const { data: allOps, isLoading } = useOps(day);
  const ops = useMemo(() => (allOps || []).filter(o => spDay(o.sentAt) === day), [allOps, day]);
  const [showSkipped, setShowSkipped] = useState(true);
  const resolved = (o: Op) => o.finished || o.outcome === 'green';
  const groups = useMemo(() => {
    const all = ops;
    return {
      alerted: all.filter(o => !o.entered && !resolved(o)),
      open: all.filter(o => o.entered && !resolved(o)),
      done: all.filter(o => resolved(o) && (o.entered || showSkipped)),
    };
  }, [ops, showSkipped]);
  const dayProfit = ops.filter(o => o.entered && resolved(o) && o.profit != null).reduce((a, o) => a + (o.profit || 0), 0);

  const cols = [
    { id: 'alerted', title: 'Alertados', sub: 'caiu no Telegram', list: groups.alerted, dot: 'bg-amber-400' },
    { id: 'open', title: 'Operação realizada', sub: 'posição aberta', list: groups.open, dot: 'bg-sky-400' },
    { id: 'done', title: 'Finalizados', sub: 'com resultado', list: groups.done, dot: 'bg-emerald-400' },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      {DEMO && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300">Modo demonstração: jogos fictícios, nada é gravado.</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black uppercase tracking-tighter text-white">Operação ao vivo</h3>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <button onClick={() => setDay(shiftDay(day, -1))} className="h-8 w-8 rounded-md border border-white/10 text-zinc-300 hover:border-emerald-500/40" title="Dia anterior">‹</button>
            <input type="date" value={day} max={todayStr} onChange={e => e.target.value && setDay(e.target.value)} className="h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs font-bold text-white [color-scheme:dark]" />
            <button onClick={() => setDay(shiftDay(day, 1))} disabled={day >= todayStr} className="h-8 w-8 rounded-md border border-white/10 text-zinc-300 hover:border-emerald-500/40 disabled:opacity-30" title="Próximo dia">›</button>
            {day !== todayStr && <button onClick={() => setDay(todayStr)} className="h-8 rounded-md bg-emerald-500 px-2.5 text-[11px] font-black text-black">Hoje</button>}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-400">
            <input type="checkbox" checked={showSkipped} onChange={e => setShowSkipped(e.target.checked)} /> mostrar finalizados em que não entrei
          </label>
          <span className="text-zinc-500">{day === todayStr ? 'Hoje' : 'Dia'}:
            <b className={cn('ml-1 tabular-nums', dayProfit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{dayProfit >= 0 ? '+' : ''}{n2(dayProfit)} stakes</b>
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-zinc-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-3">
          {cols.map(c => (
            <section key={c.id} className="rounded-xl border border-white/5 bg-zinc-950/40 p-2">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                <h4 className="text-xs font-black uppercase tracking-widest text-zinc-200">{c.title}</h4>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-300">{c.list.length}</span>
                <span className="ml-auto text-[10px] text-zinc-600">{c.sub}</span>
              </div>
              <div className="space-y-2">
                {c.list.length === 0
                  ? <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-xs text-zinc-600">Nada aqui agora.</div>
                  : c.list.map(o => <OpCard key={o.key} op={o} tab={c.id} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function OpCard({ op: o, tab }: { op: Op; tab: 'alerted' | 'open' | 'done' }) {
  const qc = useQueryClient();
  const [entry, setEntry] = useState(o.entryOdd ? n2(o.entryOdd) : '');
  const [exit, setExit] = useState(o.exitOdd ? n2(o.exitOdd) : '');
  const [busy, setBusy] = useState(false);
  const refresh = () => ['live-operacao', 'methods-list', 'method', 'method-alerts'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  const s = o.stats || {}; const h = s.h || {}; const a = s.a || {};
  const eOdd = parseOdd(entry), xOdd = parseOdd(exit);
  const minute = o.live?.minute ?? null;
  const score = o.live ? `${o.live.home_score ?? 0} x ${o.live.away_score ?? 0}` : null;
  const dirty = entry !== (o.entryOdd ? n2(o.entryOdd) : '') || exit !== (o.exitOdd ? n2(o.exitOdd) : '');
  const previewRed = o.entered || dirty ? redFromOdds(o.hold, eOdd, xOdd) : null; // só vale o que você digitou ou salvou
  const shownProfit = o.outcome === 'red' && previewRed != null ? -previewRed : o.profit;

  const run = async (fn: () => Promise<any>, ok: string) => {
    if (DEMO) return toast.info('Modo demonstração: nada é gravado');
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success(ok); refresh();
  };
  const enter = () => run(() => db.from('live_operations').upsert(
    { fixture_id: o.fixtureId, method_id: o.method.id, entry_odd: eOdd ?? o.robotOdd, entered_at: new Date().toISOString() },
    { onConflict: 'owner_id,fixture_id,method_id' }), 'Entrada registrada');
  // salva as odds (cria a operação se ainda não existir) e, se deu red, grava o red real no método (red_overrides)
  const saveOdds = () => run(async () => {
    const r = await db.from('live_operations').upsert(
      { fixture_id: o.fixtureId, method_id: o.method.id, entry_odd: eOdd, exit_odd: xOdd },
      { onConflict: 'owner_id,fixture_id,method_id' });
    if (r.error || o.outcome !== 'red' || previewRed == null) return r;
    const cur = await db.from('strategy_simulations').select('filters_snapshot').eq('id', o.method.id).single();
    if (cur.error) return cur;
    const snap = cur.data?.filters_snapshot || {};
    const red_overrides = { ...(snap.red_overrides || {}), [o.fixtureId]: Math.round(previewRed * 100) / 100 };
    return db.from('strategy_simulations').update({ filters_snapshot: { ...snap, red_overrides } }).eq('id', o.method.id);
  }, 'Odds salvas e red atualizado no método');
  const undo = () => run(() => db.from('live_operations').delete().eq('id', o.entered.id), 'Voltou para alertados');

  const [showStats, setShowStats] = useState(false);
  const hasStats = s && (h.shots != null || h.shotsOn != null);
  const strip = o.outcome === 'green' ? 'border-l-emerald-500' : o.outcome === 'red' ? 'border-l-rose-500' : o.needsExit ? 'border-l-amber-400' : 'border-l-zinc-700';
  const box = 'h-7 w-[58px] rounded border border-white/10 bg-black/40 px-1.5 text-center text-[11px] font-bold text-white placeholder:font-normal placeholder:text-zinc-600';
  const btn = 'inline-flex h-7 items-center justify-center rounded px-2.5 text-[11px] font-black disabled:opacity-50';
  const done = tab === 'done';
  return (
    <div className={cn('rounded-lg border border-white/5 border-l-2 bg-zinc-900/50 px-2.5 py-1.5', strip)} title={o.league}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-bold text-zinc-100">
          {o.home} <span className="mx-1 font-black tabular-nums text-white">{score ? score.replace(' x ', '–') : o.goalsNow}</span> {o.away}
        </p>
        {o.outcome ? (
          <span className={cn('shrink-0 text-sm font-black tabular-nums', (shownProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {(shownProfit || 0) >= 0 ? '+' : ''}{n2(shownProfit || 0)}
          </span>
        ) : minute != null && (
          <span className="shrink-0 font-mono text-[11px] font-black text-emerald-400">{o.live?.status === 'HT' ? 'INT' : `${minute}'`}</span>
        )}
      </div>

      <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
        <span className="min-w-0 truncate">
          {o.method.name} · {brTime(o.sentAt)}{o.line ? ` · U${String(o.line).replace('.', ',')}` : ''}
          {o.outcome === 'red' && <> · <span className="text-rose-400">{o.redReal || previewRed != null ? 'red real' : 'red método'}{o.late ? ' (gol após saída)' : ''}</span></>}
          {o.outcome === 'green' && <> · <span className="text-emerald-400">green</span></>}
          {o.outcome && !o.entered && ' · não entrei'}
        </span>
        {o.needsExit && <span className="shrink-0 font-bold text-amber-300">⏰ saída</span>}
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <input value={entry} onChange={e => setEntry(e.target.value)} inputMode="decimal" placeholder={o.robotOdd ? n2(o.robotOdd) : 'entrada'} title="Odd de entrada" className={box} />
        {tab !== 'alerted' && !o.hold && <input value={exit} onChange={e => setExit(e.target.value)} inputMode="decimal" placeholder="saída" title="Odd de saída" className={box} />}
        {tab === 'alerted' && <button disabled={busy} onClick={enter} className={cn(btn, 'bg-emerald-500 text-black hover:bg-emerald-400')}>Entrei</button>}
        {tab !== 'alerted' && <button disabled={busy} onClick={saveOdds} className={cn(btn, 'bg-emerald-500 text-black hover:bg-emerald-400')}>Salvar</button>}
        {tab !== 'alerted' && !o.outcome && (
          <span className="truncate text-[10px] text-zinc-500">{previewRed != null ? <>red <b className="text-rose-400">{n2(previewRed)}</b></> : <>método <b className="text-rose-400">-{n2(o.redMethod)}</b></>}</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {tab === 'open' && o.entered && <button disabled={busy} onClick={undo} title="Voltar para alertados" className={cn(btn, 'px-1.5 text-zinc-500 hover:text-white')}><Undo2 className="h-3 w-3" /></button>}
          {hasStats && !done && <button onClick={() => setShowStats(v => !v)} className={cn(btn, 'px-1.5 text-zinc-500 hover:text-white')} title="Estatísticas"><Activity className="h-3 w-3" /></button>}
          {o.slug && <a href={`${LAYBACK}${o.slug}?n=sport:soccer`} target="_blank" rel="noreferrer" title="Abrir na Layback" className={cn(btn, 'px-1.5 text-zinc-500 hover:text-emerald-400')}><ExternalLink className="h-3 w-3" /></a>}
        </span>
      </div>

      {showStats && hasStats && (
        <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
          <StatBar label="No alvo" h={h.shotsOn} a={a.shotsOn} highlight />
          <StatBar label="Chutes" h={h.shots} a={a.shots} />
          <StatBar label="Na área" h={h.shotsInBox} a={a.shotsInBox} />
          <StatBar label="Cantos" h={h.corners} a={a.corners} />
        </div>
      )}
    </div>
  );
}
