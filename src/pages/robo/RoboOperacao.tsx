import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ExternalLink, Loader2, Undo2, Check, Zap, Clock } from 'lucide-react';
import { StatBar } from '@/components/robo/LiveRadarGrid';

const db = supabase as any;
const GREEN_NET = 0.955;
const LAYBACK = 'https://polymarket.layback.trade/exchange/';
const H48 = 48 * 3600 * 1000;

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
  redMethod: number; profit: number | null; redReal: boolean;
};

function useOps() {
  return useQuery({
    queryKey: ['live-operacao'],
    refetchInterval: 30000,
    queryFn: async (): Promise<Op[]> => {
      const since = new Date(Date.now() - H48).toISOString();
      const [m, a, s, r, o] = await Promise.all([
        db.from('strategy_simulations').select('id,name,entry_minute,exit_minute,green_stake,red_stake'),
        db.from('live_alerts').select('fixture_id,home_team,away_team,league_name,created_at,minute_at_alert,notified_method_ids,entry_goals,goal_events,final_score,stats_snapshot').gte('created_at', since),
        db.from('polymarket_snapshots').select('fixture_id,method_id,odd,line,event_slug,minute,created_at,goals_total,found').gte('created_at', since).order('created_at', { ascending: false }),
        db.from('radar_live_fixtures').select('fixture_id,minute,home_score,away_score,status,stats_snapshot'),
        db.from('live_operations').select('*').gte('entered_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);
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
          const snap = snaps.get(key);
          const lv = live.get(fid) || null;
          const entryGoals = (al.entry_goals || {})[mid] ?? snap?.goals_total ?? 0;
          const entryMin = snap?.minute ?? Math.max(method.entry_minute || 0, al.minute_at_alert || 0);
          const exitMin = method.exit_minute ?? 999;
          const goalsNow = lv ? (lv.home_score || 0) + (lv.away_score || 0) : (totalOf(finalScore) ?? entryGoals);
          const finished = !!finalScore || (!lv && Date.now() - new Date(al.created_at).getTime() > 3.5 * 3600 * 1000);
          let outcome: 'green' | 'red' | null = null, late = false;
          if (goalsNow > entryGoals) {
            const goals = [...events].sort((x, y) => x.minute - y.minute);
            const nth = goals[entryGoals];
            if (nth) { outcome = nth.minute <= exitMin ? 'green' : 'red'; late = outcome === 'red'; }
            else if (lv && !finished) { outcome = (lv.minute || 0) <= exitMin + 1 ? 'green' : null; }
            else outcome = 'green';
          } else if (finished) outcome = 'red';
          const en = entered.get(key) || null;
          const robotOdd = snap?.odd ? Number(snap.odd) : null;
          const entryOdd = en?.entry_odd ? Number(en.entry_odd) : robotOdd;
          const exitOdd = en?.exit_odd ? Number(en.exit_odd) : null;
          const redMethod = Number(method.red_stake || 0);
          let profit: number | null = null, redReal = false;
          if (outcome === 'green') profit = Number(method.green_stake || 1) * GREEN_NET;
          else if (outcome === 'red') {
            if (entryOdd && exitOdd) { profit = -(entryOdd / exitOdd - 1); redReal = true; } else profit = -redMethod;
          }
          ops.set(key, {
            key, fixtureId: fid, method, home: al.home_team, away: al.away_team, league: al.league_name,
            sentAt: snap?.created_at || al.created_at, entryMin, entryGoals, line: snap?.line ?? null, slug: snap?.event_slug ?? null,
            robotOdd, live: lv, goalsNow, finished, outcome, late,
            needsExit: !!lv && exitMin < 95 && (lv.minute || 0) >= exitMin && outcome === null,
            stats: lv?.stats_snapshot || al.stats_snapshot?.fullMatch || null, entered: en, entryOdd, exitOdd, redMethod, profit, redReal,
          });
        }
      }
      return [...ops.values()].sort((x, y) => +new Date(y.sentAt) - +new Date(x.sentAt));
    },
  });
}

export default function RoboOperacao() {
  const { data: ops, isLoading } = useOps();
  const [tab, setTab] = useState<'alerted' | 'open' | 'done'>('alerted');
  const [showSkipped, setShowSkipped] = useState(false);
  const resolved = (o: Op) => o.finished || o.outcome === 'green';
  const groups = useMemo(() => {
    const all = ops || [];
    return {
      alerted: all.filter(o => !o.entered && !resolved(o)),
      open: all.filter(o => o.entered && !resolved(o)),
      done: all.filter(o => resolved(o) && (o.entered || showSkipped)),
    };
  }, [ops, showSkipped]);
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const dayProfit = (ops || []).filter(o => o.entered && resolved(o) && o.profit != null &&
    new Date(o.sentAt).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) === today).reduce((a, o) => a + (o.profit || 0), 0);

  const tabs = [
    { id: 'alerted', label: 'Alertados', n: groups.alerted.length },
    { id: 'open', label: 'Operação realizada', n: groups.open.length },
    { id: 'done', label: 'Finalizados', n: groups.done.length },
  ] as const;
  const list = groups[tab];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 rounded-2xl border border-white/10 bg-zinc-900/50 p-1.5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('rounded-xl px-4 py-2 text-xs font-black uppercase tracking-tight transition-all',
                tab === t.id ? 'bg-zinc-800 text-white ring-1 ring-zinc-700' : 'text-zinc-500 hover:text-zinc-300')}>
              {t.label} <span className="ml-1 rounded-full bg-white/10 px-1.5 text-[10px]">{t.n}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs">
          {tab === 'done' && (
            <label className="flex cursor-pointer items-center gap-1.5 text-zinc-400">
              <input type="checkbox" checked={showSkipped} onChange={e => setShowSkipped(e.target.checked)} /> incluir os que não entrei
            </label>
          )}
          <span className="text-zinc-500">Hoje:
            <b className={cn('ml-1 tabular-nums', dayProfit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{dayProfit >= 0 ? '+' : ''}{n2(dayProfit)} stakes</b>
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-zinc-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-500">Nada aqui agora.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {list.map(o => <OpCard key={o.key} op={o} tab={tab} />)}
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
  const refresh = () => qc.invalidateQueries({ queryKey: ['live-operacao'] });
  const s = o.stats || {}; const h = s.h || {}; const a = s.a || {};
  const eOdd = parseOdd(entry), xOdd = parseOdd(exit);
  const minute = o.live?.minute ?? null;
  const score = o.live ? `${o.live.home_score ?? 0} x ${o.live.away_score ?? 0}` : null;
  const previewRed = eOdd && xOdd ? -(eOdd / xOdd - 1) : null;

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success(ok); refresh();
  };
  const enter = () => run(() => db.from('live_operations').upsert(
    { fixture_id: o.fixtureId, method_id: o.method.id, entry_odd: eOdd ?? o.robotOdd, entered_at: new Date().toISOString() },
    { onConflict: 'owner_id,fixture_id,method_id' }), 'Entrada registrada');
  const saveOdds = () => run(() => db.from('live_operations').update({ entry_odd: eOdd, exit_odd: xOdd }).eq('id', o.entered.id), 'Odds salvas');
  const undo = () => run(() => db.from('live_operations').delete().eq('id', o.entered.id), 'Voltou para alertados');

  const border = o.outcome === 'green' ? 'border-emerald-500/30' : o.outcome === 'red' ? 'border-rose-500/30' : o.needsExit ? 'border-amber-500/40' : 'border-white/10';
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border bg-gradient-to-b from-zinc-900/70 to-zinc-950/80 p-4 shadow-xl backdrop-blur-xl', border)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-amber-400">
            <Zap className="h-3 w-3" /> {o.method.name}
          </span>
          <p className="mt-1.5 truncate text-[10px] font-bold uppercase tracking-widest text-zinc-500">{o.league}</p>
        </div>
        <div className="text-right text-[10px] text-zinc-500">
          <p className="flex items-center justify-end gap-1"><Clock className="h-3 w-3" />Telegram {brTime(o.sentAt)} · {o.entryMin}'</p>
          {minute != null && <p className="mt-0.5 font-mono font-black text-emerald-400">{o.live?.status === 'HT' ? 'INTERVALO' : `${minute}'`}</p>}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="truncate text-sm font-bold text-zinc-100">{o.home}</span>
        <span className="rounded-xl border border-white/10 bg-black/50 px-3.5 py-1.5 text-xl font-black tabular-nums text-white">
          {score ?? `${o.goalsNow}`}
        </span>
        <span className="truncate text-right text-sm font-bold text-zinc-100">{o.away}</span>
      </div>
      <p className="mt-1 text-center text-[10px] text-zinc-500">
        entrada com {o.entryGoals} gol(s){o.line ? ` · lay Under ${String(o.line).replace('.', ',')}` : ''} · saída {o.method.exit_minute >= 95 ? 'no fim' : `${o.method.exit_minute}'`}
      </p>

      {o.needsExit && <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-300">⏰ Minuto de saída — feche a posição e digite a odd de saída.</div>}
      {o.outcome && (
        <div className={cn('mt-3 flex items-center justify-between rounded-xl px-3 py-2', o.outcome === 'green' ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
          <span className={cn('text-xs font-black uppercase', o.outcome === 'green' ? 'text-emerald-400' : 'text-rose-400')}>
            {o.outcome === 'green' ? 'Green' : o.late ? 'Red (gol depois da saída)' : 'Red'}{!o.entered && ' · não entrei'}
          </span>
          <span className={cn('text-lg font-black tabular-nums', (o.profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {(o.profit || 0) >= 0 ? '+' : ''}{n2(o.profit || 0)}
            <span className="ml-1 text-[10px] font-bold text-zinc-500">{o.outcome === 'red' ? (o.redReal ? 'red real' : 'red do método') : 'stakes'}</span>
          </span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Odd de entrada{o.robotOdd && o.entered ? ` (robô ${n2(o.robotOdd)})` : ''}</span>
          <input value={entry} onChange={e => setEntry(e.target.value)} inputMode="decimal" placeholder={o.robotOdd ? n2(o.robotOdd) : 'ex 9,25'}
            className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2 text-sm font-bold text-white" />
        </label>
        {tab !== 'alerted' ? (
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Odd de saída</span>
            <input value={exit} onChange={e => setExit(e.target.value)} inputMode="decimal" placeholder="ex 3,65"
              className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2 text-sm font-bold text-white" />
          </label>
        ) : <div />}
      </div>
      {tab !== 'alerted' && (
        <p className="mt-2 text-[11px] text-zinc-400">
          {previewRed != null ? <>Red real: <b className="text-rose-400">{n2(previewRed)} stakes</b></> : <>Sem odd de saída: red do método <b className="text-rose-400">-{n2(o.redMethod)}</b></>}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {o.slug && (
          <a href={`${LAYBACK}${o.slug}?n=sport:soccer`} target="_blank" rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold text-zinc-200 hover:border-emerald-500/40">
            <ExternalLink className="h-3.5 w-3.5" /> Layback
          </a>
        )}
        {tab === 'alerted' && (
          <button disabled={busy} onClick={enter} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-4 text-xs font-black text-black hover:bg-emerald-400 disabled:opacity-50">
            <Check className="h-3.5 w-3.5" /> Entrei
          </button>
        )}
        {tab !== 'alerted' && o.entered && (
          <>
            <button disabled={busy} onClick={saveOdds} className="inline-flex h-9 items-center rounded-lg bg-emerald-500 px-4 text-xs font-black text-black hover:bg-emerald-400 disabled:opacity-50">Salvar odds</button>
            {tab === 'open' && <button disabled={busy} onClick={undo} className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-zinc-400 hover:text-white"><Undo2 className="h-3.5 w-3.5" /> desfazer</button>}
          </>
        )}
      </div>

      {s && (h.shots != null || h.shotsOn != null) && tab !== 'done' && (
        <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
          <StatBar label="No alvo" h={h.shotsOn} a={a.shotsOn} highlight />
          <StatBar label="Chutes" h={h.shots} a={a.shots} />
          <StatBar label="Na área" h={h.shotsInBox} a={a.shotsInBox} />
          <StatBar label="Cantos" h={h.corners} a={a.corners} />
        </div>
      )}
    </div>
  );
}
