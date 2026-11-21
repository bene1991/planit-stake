// Cálculos da página pública /oferta: monta uma linha por jogo x método e agrega por qualquer recorte.
export const GREEN_NET = 0.955; // comissão de 4,5%
export const TZ = 'America/Sao_Paulo';

export type Method = { id: string; name: string; entry_minute: number; exit_minute: number; green_stake: number; red_stake: number; cfg: any };
export type Goal = { minute: number; extra?: number | null; team?: string };
export type Row = {
  key: string; methodId: string; method: string; fixture: string; league: string; home: string; away: string;
  date: string; day: string; month: string; weekday: number; hour: number;
  alertMin: number; entryMin: number; exitMin: number; goalsAtEntry: number; goalMin: number | null;
  score: string | null; liveScore: string | null; liveMinute: number | null; liveStatus: string | null;
  state: 'green' | 'red' | 'live'; profit: number | null; isLive: boolean; notified: boolean; line: number; hold: boolean;
};

const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const parts = (iso: string) => {
  const o: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(iso))) o[p.type] = p.value;
  const day = `${o.year}-${o.month}-${o.day}`;
  return { day, month: `${o.year}-${o.month}`, hour: Number(o.hour), weekday: new Date(`${day}T12:00:00Z`).getUTCDay() };
};

const gmin = (g: Goal) => (g.minute || 0) + (g.extra || 0);
const goalsOf = (a: any): Goal[] => (typeof a.goal_events === 'string' ? JSON.parse(a.goal_events) : a.goal_events || []);

// o cliente vê regras, não nomes de método: métodos com a mesma entrada e saída viram uma regra só
export const ruleKey = (m: Method) => `${m.entry_minute}-${m.exit_minute >= 95 ? 'fim' : m.exit_minute}`;
export const ruleLabel = (m: Method) => (m.exit_minute >= 95 ? `Entra aos ${m.entry_minute}' · sem saída` : `Entra aos ${m.entry_minute}' · sai aos ${m.exit_minute}'`);

export function buildRows(methods: Method[], alerts: any[], radar: any[]): Row[] {
  const live = new Map<string, any>(radar.map(r => [String(r.fixture_id), r]));
  const rows: Row[] = [];
  // cada método conta as suas próprias entradas (como nos métodos reais); a regra só serve para o cliente não ver o nome
  for (const m of methods) {
    const rk = ruleKey(m);
    const vids: string[] = m.cfg.variation_ids || [];
    const quarantine = new Set((m.cfg.quarantine_leagues || []).map(String));
    const redOv: Record<string, number> = m.cfg.red_overrides || {};
    const forced: Record<string, string> = m.cfg.result_overrides || {};
    const byFix = new Map<string, { a: any; notified: boolean }>();
    for (const a of alerts) {
      if (!vids.includes(a.variation_id) || quarantine.has(String(a.league_id))) continue;
      const k = String(a.fixture_id), e = byFix.get(k);
      const nt = (a.notified_method_ids || []).includes(m.id);
      if (!e) byFix.set(k, { a, notified: nt });
      else { e.notified = e.notified || nt; if ((a.minute_at_alert || 0) < (e.a.minute_at_alert || 0)) e.a = a; } // um alerta por jogo: o mais cedo
    }
    for (const { a, notified } of byFix.values()) {
      const fid = String(a.fixture_id);
      const lv = live.get(fid);
      const age = (Date.now() - new Date(a.created_at).getTime()) / 60000;
      const ended = lv ? ['FT', 'AET', 'PEN'].includes(String(lv.status)) : age >= 100;
      const isLive = !ended && age < 240;
      const goals = goalsOf(a);
      const entryMin = Math.max(m.entry_minute, a.minute_at_alert || 0);
      const inWin = goals.filter(g => gmin(g) >= entryMin && gmin(g) <= m.exit_minute).sort((x, y) => gmin(x) - gmin(y));
      const f = forced[fid];
      const green = f ? f === 'green' : inWin.length > 0;
      const p = parts(a.created_at);
      const goalsAtEntry = goals.filter(g => gmin(g) < entryMin).length;
      rows.push({
        key: `${fid}|${m.id}`, methodId: rk, method: ruleLabel(m), fixture: fid,
        league: a.league_name || '—', home: a.home_team, away: a.away_team,
        date: a.created_at, day: p.day, month: p.month, weekday: p.weekday, hour: p.hour,
        alertMin: a.minute_at_alert || 0, entryMin, exitMin: m.exit_minute, goalsAtEntry, goalMin: inWin[0] ? gmin(inWin[0]) : null,
        score: a.final_score && a.final_score !== 'pending' ? String(a.final_score).replace(/\s*x\s*/i, '–') : null,
        liveScore: lv ? `${lv.home_score ?? 0}–${lv.away_score ?? 0}` : null,
        liveMinute: lv?.minute ?? null, liveStatus: lv?.status ?? null,
        state: isLive && !green ? 'live' : green ? 'green' : 'red', isLive, notified, line: goalsAtEntry + 0.5, hold: m.exit_minute >= 95,
        profit: isLive && !green ? null : green ? m.green_stake * GREEN_NET : -(redOv[fid] ?? m.red_stake),
      });
    }
  }
  return rows.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export const finished = (rows: Row[]) => rows.filter(r => !r.isLive && r.profit != null);

export type Agg = { key: string; n: number; greens: number; reds: number; profit: number; win: number; roi: number };
export function group(rows: Row[], keyFn: (r: Row) => string): Agg[] {
  const m = new Map<string, Agg>();
  for (const r of rows) {
    const k = keyFn(r);
    const a = m.get(k) || { key: k, n: 0, greens: 0, reds: 0, profit: 0, win: 0, roi: 0 };
    a.n++; a.profit += r.profit || 0; if (r.state === 'green') a.greens++; else a.reds++;
    m.set(k, a);
  }
  return [...m.values()].map(a => ({ ...a, win: (a.greens / a.n) * 100, roi: a.profit / a.n }));
}

export function summary(rows: Row[]) {
  const done = [...finished(rows)].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  let eq = 0, peak = 0, dd = 0, r = 0, maxR = 0, g = 0, maxG = 0;
  const curve = done.map(x => {
    eq += x.profit!; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq);
    if (x.state === 'green') { g++; r = 0; maxG = Math.max(maxG, g); } else { r++; g = 0; maxR = Math.max(maxR, r); }
    return { date: x.date, profit: +eq.toFixed(2) };
  });
  const greens = done.filter(x => x.state === 'green').length;
  const days = group(done, x => x.day);
  const best = days.sort((a, b) => b.profit - a.profit)[0];
  return { done, curve, n: done.length, greens, reds: done.length - greens, profit: eq, dd, maxR, maxG, win: done.length ? (greens / done.length) * 100 : 0, roi: done.length ? eq / done.length : 0, activeDays: days.length, bestDay: best };
}

// teste: um jogo entra uma vez só por grupo de entrada (35' ou 50'). No grupo 35 vale o método de saída 70; nos outros, o primeiro.
export function onePerGame(rows: Row[]): Row[] {
  const grp = (r: Row) => `${r.fixture}|${r.methodId.split('-')[0]}`;
  const best = new Map<string, Row>();
  for (const r of rows) {
    const e = best.get(grp(r));
    if (!e || (r.methodId.startsWith('35-') && r.exitMin === 70 && e.exitMin !== 70)) best.set(grp(r), r);
  }
  return rows.filter(r => best.get(grp(r)) === r);
}
