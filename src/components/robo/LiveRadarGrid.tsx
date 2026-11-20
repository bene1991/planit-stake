import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Radar, RefreshCw, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface RadarFixture {
  fixture_id: string;
  home_team: string;
  away_team: string;
  league_id: string;
  league_name: string;
  home_score: number;
  away_score: number;
  minute: number;
  status: string;
  stats_snapshot: any;
  updated_at: string;
}

const formatStaleness = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s atrás`;
  return `${Math.floor(s / 60)}min atrás`;
};

const LiveRadarGrid: React.FC = () => {
  const [fixtures, setFixtures] = useState<RadarFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [leagueFilter, setLeagueFilter] = useState<string>('all');

  const load = async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from('radar_live_fixtures')
      .select('*')
      .order('league_name', { ascending: true })
      .order('minute', { ascending: false });
    if (!error && data) setFixtures(data as RadarFixture[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const channel = supabase
      .channel('public:radar_live_fixtures')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'radar_live_fixtures' }, () => load())
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, []);

  const leagues = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of fixtures) if (f.league_id) m.set(f.league_id, f.league_name || f.league_id);
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [fixtures]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fixtures.filter(f => {
      if (leagueFilter !== 'all' && f.league_id !== leagueFilter) return false;
      if (q && !(`${f.home_team} ${f.away_team}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [fixtures, search, leagueFilter]);

  const grouped = useMemo(() => {
    const m = new Map<string, RadarFixture[]>();
    for (const f of filtered) {
      const k = f.league_name || '—';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Radar className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Radar — Todos os Jogos Avaliados</h3>
            <p className="text-[11px] text-gray-500">
              {filtered.length} jogos · stats coletados pelo cron do robô · sem requisição extra
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-[#1e2333] border border-[#2a3142] text-gray-200 hover:border-emerald-500/40"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      <div className="flex gap-2 flex-wrap rounded-2xl border border-white/10 bg-zinc-900/50 p-3 backdrop-blur-xl">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar time..."
            className="pl-7 h-9 bg-black/40 border-white/10 text-xs"
          />
        </div>
        <select
          value={leagueFilter}
          onChange={(e) => setLeagueFilter(e.target.value)}
          className="h-9 bg-black/40 border border-white/10 rounded-md px-2 text-xs text-gray-200 min-w-[200px]"
        >
          <option value="all">Todas as ligas ({leagues.length})</option>
          {leagues.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando jogos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-[#2a3142] rounded-md">
          Nenhum jogo ao vivo sendo avaliado agora.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([league, items]) => (
            <section key={league}>
              <div className="mb-3 flex items-center gap-3">
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300">{league}</h4>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-zinc-400">{items.length}</span>
                <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map(f => <FixtureCard key={f.fixture_id} fixture={f} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

const num = (v: any) => {
  const n = parseFloat(String(v ?? 0).replace('%', ''));
  return Number.isFinite(n) ? n : 0;
};

const FixtureCard: React.FC<{ fixture: RadarFixture }> = ({ fixture: f }) => {
  const s = f.stats_snapshot || {};
  const h = s.h || {};
  const a = s.a || {};
  const stale = Date.now() - new Date(f.updated_at).getTime() > 3 * 60 * 1000;
  const isHT = f.status === 'HT';
  const pct = Math.min(100, Math.max(0, ((f.minute || 0) / 90) * 100));
  const goals = f.home_score + f.away_score;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/70 to-zinc-950/80 backdrop-blur-xl p-4 shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-emerald-500/5">
      <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-emerald-500/10 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1">
          <span className="relative flex h-1.5 w-1.5">
            {!isHT && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[11px] font-black text-emerald-400 tabular-nums">
            {isHT ? 'INTERVALO' : `${f.minute}'`}
          </span>
        </span>
        <span className={cn('text-[10px] font-medium tabular-nums', stale ? 'text-amber-400' : 'text-zinc-500')}>
          {formatStaleness(f.updated_at)}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="truncate text-sm font-bold text-zinc-100" title={f.home_team}>{f.home_team}</span>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3.5 py-1.5 shadow-inner">
          <span className="text-2xl font-black tabular-nums leading-none text-white">{f.home_score}</span>
          <span className="text-zinc-600">:</span>
          <span className="text-2xl font-black tabular-nums leading-none text-white">{f.away_score}</span>
        </div>
        <span className="truncate text-right text-sm font-bold text-zinc-100" title={f.away_team}>{f.away_team}</span>
      </div>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5" title={`${goals} gol(s)`}>
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-300 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 space-y-2.5">
        <StatBar label="No alvo" h={h.shotsOn} a={a.shotsOn} highlight />
        <StatBar label="Chutes" h={h.shots} a={a.shots} />
        <StatBar label="Na área" h={h.shotsInBox} a={a.shotsInBox} />
        <StatBar label="Cantos" h={h.corners} a={a.corners} />
        <StatBar label="xG" h={h.xg} a={a.xg} decimals />
        <StatBar label="Posse" h={h.possession} a={a.possession} suffix="%" />
      </div>
    </div>
  );
};

const StatBar: React.FC<{ label: string; h: any; a: any; suffix?: string; highlight?: boolean; decimals?: boolean }> = ({ label, h, a, suffix = '', highlight, decimals }) => {
  const hv = num(h), av = num(a), t = hv + av;
  const hp = t > 0 ? (hv / t) * 100 : 50;
  const fmt = (v: number) => (decimals ? v.toFixed(2) : String(Math.round(v))) + suffix;
  const hLead = hv > av, aLead = av > hv;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] tabular-nums">
        <span className={cn('font-bold', hLead ? (highlight ? 'text-emerald-400' : 'text-white') : 'text-zinc-500')}>{fmt(hv)}</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-600">{label}</span>
        <span className={cn('font-bold', aLead ? (highlight ? 'text-emerald-400' : 'text-white') : 'text-zinc-500')}>{fmt(av)}</span>
      </div>
      <div className="mt-1 flex h-1 gap-0.5 overflow-hidden rounded-full">
        <div className={cn('rounded-l-full transition-all duration-700', hLead && highlight ? 'bg-emerald-400' : hLead ? 'bg-zinc-300' : 'bg-zinc-700')} style={{ width: `${hp}%` }} />
        <div className={cn('rounded-r-full transition-all duration-700', aLead && highlight ? 'bg-emerald-400' : aLead ? 'bg-zinc-300' : 'bg-zinc-700')} style={{ width: `${100 - hp}%` }} />
      </div>
    </div>
  );
};

export default LiveRadarGrid;
