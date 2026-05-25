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

      <div className="flex gap-2 flex-wrap bg-[#1e2333] border border-[#2a3142] rounded-md p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar time..."
            className="pl-7 h-8 bg-[#2a3142] border-[#3b4256] text-xs"
          />
        </div>
        <select
          value={leagueFilter}
          onChange={(e) => setLeagueFilter(e.target.value)}
          className="h-8 bg-[#2a3142] border border-[#3b4256] rounded-md px-2 text-xs text-gray-200 min-w-[200px]"
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
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                {league} <span className="text-gray-600">({items.length})</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map(f => <FixtureCard key={f.fixture_id} fixture={f} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

const FixtureCard: React.FC<{ fixture: RadarFixture }> = ({ fixture: f }) => {
  const s = f.stats_snapshot || {};
  const h = s.h || {};
  const a = s.a || {};
  return (
    <div className="bg-[#1e2333] border border-[#2a3142] rounded-lg p-3 hover:border-emerald-500/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500">{f.status || '—'} · {formatStaleness(f.updated_at)}</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
          {f.minute}'
        </span>
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-200 font-semibold truncate flex-1">{f.home_team}</span>
        <span className="text-xl font-extrabold text-white mx-3">{f.home_score} - {f.away_score}</span>
        <span className="text-sm text-gray-200 font-semibold truncate flex-1 text-right">{f.away_team}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-400 border-t border-[#2a3142] pt-2">
        <StatRow label="Chutes" h={h.shots} a={a.shots} />
        <StatRow label="No alvo" h={h.shotsOn} a={a.shotsOn} highlight />
        <StatRow label="Posse" h={h.possession} a={a.possession} suffix="%" />
        <StatRow label="Cantos" h={h.corners} a={a.corners} />
        <StatRow label="Na área" h={h.shotsInBox} a={a.shotsInBox} />
        <StatRow label="xG" h={h.xg} a={a.xg} />
      </div>
    </div>
  );
};

const StatRow: React.FC<{ label: string; h: any; a: any; suffix?: string; highlight?: boolean }> = ({ label, h, a, suffix = '', highlight }) => (
  <div className={cn('flex flex-col items-center px-1', highlight && 'bg-emerald-500/5 rounded')}>
    <span className="text-[9px] text-gray-600 uppercase tracking-wider">{label}</span>
    <span className="text-[11px] font-bold text-gray-200">
      {h ?? 0}{suffix} <span className="text-gray-600">-</span> {a ?? 0}{suffix}
    </span>
  </div>
);

export default LiveRadarGrid;
