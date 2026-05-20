import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, BarChart3, Loader2, CalendarDays, TrendingDown, TrendingUp, Send, Clock, Pencil, Search, X, Shield, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, AreaChart, Area } from 'recharts';
import DailyProfitCalendar from './components/DailyProfitCalendar';

const GREEN_NET = 1 - 0.045;

interface Method {
  id: string;
  name: string;
  entry_minute: number;
  exit_minute: number;
  green_stake: number;
  red_stake: number;
  filters_snapshot: any;
  created_at: string;
}

const fetchAll = async (table: string, columns = '*') => {
  let all: any[] = [];
  let from = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + size - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return all;
};

const MethodDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'games' | 'analysis' | 'quarantine'>('games');
  const [editOpen, setEditOpen] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<'all' | '7d' | '30d' | 'this_month'>('all');
  const [filterLeague, setFilterLeague] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('');

  const [optimisticQuarantine, setOptimisticQuarantine] = useState<string[] | null>(null);
  const [savingQuarantine, setSavingQuarantine] = useState(false);

  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, number> | null>(null);

  const { data: method, isLoading: loadingMethod } = useQuery({
    queryKey: ['method', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategy_simulations')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Method;
    },
  });

  const quarantinedLeagues: string[] = optimisticQuarantine ?? (method?.filters_snapshot?.quarantine_leagues || []);
  const redOverrides: Record<string, number> = optimisticOverrides ?? (method?.filters_snapshot?.red_overrides || {});
  const setRedOverride = async (fixtureId: string, value: number | null) => {
    if (!method) return;
    const current: Record<string, number> = { ...(method.filters_snapshot?.red_overrides || {}) };
    if (value === null || Number.isNaN(value)) delete current[fixtureId];
    else current[fixtureId] = value;
    setOptimisticOverrides(current);
    const newSnap = { ...(method.filters_snapshot || {}), red_overrides: current };
    const { data: updated, error } = await supabase
      .from('strategy_simulations')
      .update({ filters_snapshot: newSnap })
      .eq('id', method.id)
      .select();
    if (error) {
      toast.error('Erro ao salvar red override: ' + error.message);
      setOptimisticOverrides(null);
      return;
    }
    if (!updated || updated.length === 0) {
      toast.error('Red override não persistiu (RLS bloqueou update)');
      setOptimisticOverrides(null);
      return;
    }
    toast.success(value === null ? 'Override removido' : `Red salvo: ${value}`);
    await queryClient.invalidateQueries({ queryKey: ['method', id] });
    setOptimisticOverrides(null);
  };
  const toggleQuarantine = async (league: string) => {
    if (!method) return;
    const current: string[] = method.filters_snapshot?.quarantine_leagues || [];
    const dates: Record<string, string> = { ...(method.filters_snapshot?.quarantine_dates || {}) };
    let next: string[];
    if (current.includes(league)) {
      next = current.filter(l => l !== league);
      delete dates[league];
    } else {
      next = [...current, league];
      dates[league] = new Date().toISOString();
    }
    setOptimisticQuarantine(next);
    setSavingQuarantine(true);
    const newSnap = { ...(method.filters_snapshot || {}), quarantine_leagues: next, quarantine_dates: dates };
    const { error } = await supabase
      .from('strategy_simulations')
      .update({ filters_snapshot: newSnap })
      .eq('id', method.id);
    setSavingQuarantine(false);
    if (error) {
      toast.error('Erro ao atualizar quarentena: ' + error.message);
      setOptimisticQuarantine(null);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['method', id] });
    setOptimisticQuarantine(null);
  };

  const { data: allVariations } = useQuery({
    queryKey: ['robot-variations-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('robot_variations')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data, isLoading: loadingAlerts } = useQuery({
    queryKey: ['method-alerts', id],
    enabled: !!method,
    queryFn: async () => {
      const [alerts, games] = await Promise.all([
        fetchAll('live_alerts'),
        fetchAll('games', 'api_fixture_id, status, final_score_home, final_score_away, country, league'),
      ]);
      const gamesMap = new Map(games.map((g: any) => [String(g.api_fixture_id), g]));
      // build league_id -> country map by joining alerts to games via fixture_id
      const leagueCountry = new Map<string, string>();
      for (const a of alerts) {
        const lid = String(a.league_id || '');
        if (!lid || leagueCountry.has(lid)) continue;
        const g = gamesMap.get(String(a.fixture_id));
        if (g && (g as any).country) leagueCountry.set(lid, (g as any).country);
      }
      return { alerts, gamesMap, leagueCountry };
    },
  });

  const result = useMemo(() => {
    if (!method || !data) return null;
    const variationIds: string[] = method.filters_snapshot?.variation_ids || [];
    const entryMin = method.entry_minute;
    const exitMin = method.exit_minute;
    const greenStake = method.green_stake;
    const redStake = method.red_stake;

    const periodFloor =
      filterPeriod === '7d' ? Date.now() - 7 * 24 * 3600 * 1000 :
      filterPeriod === '30d' ? Date.now() - 30 * 24 * 3600 * 1000 :
      filterPeriod === 'this_month' ? (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.getTime(); })() : 0;
    const teamQ = filterTeam.trim().toLowerCase();

    const filtered = (data.alerts as any[]).filter(a => {
      if (variationIds.length === 0 || !variationIds.includes(a.variation_id)) return false;
      if (periodFloor > 0 && new Date(a.created_at).getTime() < periodFloor) return false;
      if (filterLeague !== 'all' && String(a.league_id) !== filterLeague) return false;
      if (teamQ && !(`${a.home_team} ${a.away_team}`.toLowerCase().includes(teamQ))) return false;
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

    const games = deduped.map(a => {
      const goalEvents: any[] = typeof a.goal_events === 'string' ? JSON.parse(a.goal_events) : (a.goal_events || []);
      const fx = data.gamesMap.get(String(a.fixture_id));
      const finishedStatuses = ['Finished', 'FT', 'AET', 'PEN'];
      const isFinished = fx && finishedStatuses.includes((fx as any).status);
      const hasFinal = a.final_score && a.final_score !== 'pending';
      const isOld = a.created_at ? (Date.now() - new Date(a.created_at).getTime() > 4 * 3600 * 1000) : false;
      const analyzable = isFinished || hasFinal || isOld;

      const goalsInWindow = goalEvents.filter(g => {
        const m = (g.minute || 0) + (g.extra || 0);
        return m >= entryMin && m <= exitMin;
      });

      const result: 'green' | 'red' | 'pending' = !analyzable
        ? 'pending'
        : goalsInWindow.length > 0
        ? 'green'
        : 'red';

      const effectiveRed = redOverrides[String(a.fixture_id)] ?? redStake;
      const profit = result === 'green' ? greenStake * GREEN_NET : result === 'red' ? -effectiveRed : 0;

      const sorted = [...goalEvents].sort((x, y) => ((x.minute || 0) + (x.extra || 0)) - ((y.minute || 0) + (y.extra || 0)));

      const lid = String(a.league_id || '');
      const country = data.leagueCountry?.get(lid);
      const leagueLabel = country ? `${a.league_name} (${country})` : a.league_name;
      return {
        fixture_id: a.fixture_id,
        date: a.created_at,
        home_team: a.home_team,
        away_team: a.away_team,
        league: leagueLabel,
        league_id: lid,
        league_name: a.league_name,
        league_country: country || null,
        variation: a.variation_name,
        minute_at_alert: a.minute_at_alert,
        result,
        profit,
        goals: sorted.map(g => `${g.minute}${g.extra ? '+' + g.extra : ''}'`).join(', '),
        raw_goal_events: sorted,
        final_score: a.final_score || 'N/A',
        telegram_sent: !!a.telegram_sent,
        telegram_alert_minute: a.telegram_alert_minute || null,
      };
    }).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    const qSet = new Set(quarantinedLeagues.map(String));
    const mainGames = games.filter(g => !qSet.has(g.league_id));
    const quarantineGames = games.filter(g => qSet.has(g.league_id));

    const analyzable = mainGames.filter(g => g.result !== 'pending');
    const greens = analyzable.filter(g => g.result === 'green').length;
    const reds = analyzable.filter(g => g.result === 'red').length;
    const totalStakes = analyzable.reduce((s, g) => s + g.profit, 0);
    const winRate = analyzable.length ? (greens / analyzable.length) * 100 : 0;
    const roi = analyzable.length ? (totalStakes / analyzable.length) * 100 : 0;

    return { games: mainGames, allGames: games, quarantineGames, analyzable: analyzable.length, datasetSize: mainGames.length, greens, reds, totalStakes, winRate, roi };
  }, [method, data, redOverrides, filterPeriod, filterLeague, filterTeam, quarantinedLeagues]);

  const allLeagues = useMemo(() => {
    if (!method || !data) return [] as { id: string; label: string }[];
    const variationIds: string[] = method.filters_snapshot?.variation_ids || [];
    const m = new Map<string, string>();
    for (const a of (data.alerts as any[])) {
      if (variationIds.includes(a.variation_id) && a.league_id) {
        const lid = String(a.league_id);
        const country = data.leagueCountry?.get(lid);
        m.set(lid, country ? `${a.league_name} (${country})` : a.league_name);
      }
    }
    return Array.from(m.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [method, data]);

  const loading = loadingMethod || loadingAlerts;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando método...
      </div>
    );
  }

  if (!method) {
    return <div className="text-gray-400 p-6">Método não encontrado. <Link to="/robo" className="text-emerald-400 underline">Voltar</Link></div>;
  }

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/robo">
            <Button variant="ghost" size="sm" className="text-gray-300"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">{method.name}</h1>
            <p className="text-xs text-gray-500">
              Janela {method.entry_minute}' → {method.exit_minute}' · Stakes +{method.green_stake} / -{method.red_stake} · Criado em {format(parseISO(method.created_at), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="border-[#3b4256] text-gray-200 hover:bg-white/5">
          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar Método
        </Button>
      </div>

      <EditMethodDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        method={method}
        allVariations={allVariations || []}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['method', id] });
          queryClient.invalidateQueries({ queryKey: ['method-alerts', id] });
          queryClient.invalidateQueries({ queryKey: ['methods-list'] });
          setEditOpen(false);
        }}
      />

      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-[#1e2333] border-[#2a3142] p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Amostragem</p>
            <p className="text-2xl font-bold text-white mt-1">{result.analyzable}</p>
            <p className="text-[10px] text-gray-500">de {result.datasetSize} jogos</p>
          </Card>
          <Card className="bg-[#1e2333] border-[#2a3142] p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Win Rate</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{result.winRate.toFixed(1)}%</p>
            <p className="text-[10px] text-gray-500">{result.greens}G / {result.reds}R</p>
          </Card>
          <Card className="bg-[#1e2333] border-[#2a3142] p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Lucro em Stakes</p>
            <p className={cn('text-2xl font-bold mt-1', result.totalStakes >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              {result.totalStakes >= 0 ? '+' : ''}{result.totalStakes.toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-500">ROI: {result.roi.toFixed(1)}%</p>
          </Card>
          <Card className="bg-[#1e2333] border-[#2a3142] p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Variações</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{(method.filters_snapshot?.variation_ids || []).length}</p>
            <p className="text-[10px] text-gray-500">no método</p>
          </Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="bg-[#1e2333] border border-[#2a3142]">
          <TabsTrigger value="games" className="data-[state=active]:bg-[#2a3142]">
            <BarChart3 className="w-3.5 h-3.5 mr-2" /> Jogos
          </TabsTrigger>
          <TabsTrigger value="analysis" className="data-[state=active]:bg-[#2a3142]">
            <CalendarDays className="w-3.5 h-3.5 mr-2" /> Análise
          </TabsTrigger>
          <TabsTrigger value="quarantine" className="data-[state=active]:bg-[#2a3142]">
            <Shield className="w-3.5 h-3.5 mr-2" /> Quarentena {quarantinedLeagues.length > 0 && <span className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">{quarantinedLeagues.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="games" className="mt-4 space-y-3">
      <div className="flex flex-wrap items-end gap-2 bg-[#1e2333] border border-[#2a3142] rounded-md p-3">
        <div className="flex flex-col">
          <Label className="text-[10px] text-gray-500 mb-1">Período</Label>
          <Select value={filterPeriod} onValueChange={(v: any) => setFilterPeriod(v)}>
            <SelectTrigger className="w-[140px] h-8 bg-[#2a3142] border-[#3b4256] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tudo</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="this_month">Este mês</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col">
          <Label className="text-[10px] text-gray-500 mb-1">Liga</Label>
          <Select value={filterLeague} onValueChange={setFilterLeague}>
            <SelectTrigger className="w-[200px] h-8 bg-[#2a3142] border-[#3b4256] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ligas</SelectItem>
              {allLeagues.map(l => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col flex-1 min-w-[180px]">
          <Label className="text-[10px] text-gray-500 mb-1">Time</Label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              placeholder="Buscar time (casa ou visitante)..."
              className="pl-7 h-8 bg-[#2a3142] border-[#3b4256] text-xs"
            />
            {filterTeam && (
              <button onClick={() => setFilterTeam('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {(filterPeriod !== 'all' || filterLeague !== 'all' || filterTeam) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterPeriod('all'); setFilterLeague('all'); setFilterTeam(''); }} className="h-8 text-gray-400 hover:text-white">
            Limpar
          </Button>
        )}
        <div className="ml-auto text-[11px] text-gray-400 self-center">
          {result?.games.length || 0} jogo(s)
        </div>
      </div>

      <Card className="bg-[#1e2333] border-[#2a3142]">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center text-white">
            <BarChart3 className="w-4 h-4 mr-2 text-blue-400" /> Jogos do Método
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[700px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="bg-[#2a3142]/50 text-gray-400 text-[10px] uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Data</th>
                  <th className="px-2 py-2 text-left font-medium">Partida</th>
                  <th className="px-2 py-2 text-left font-medium">Liga</th>
                  <th className="px-2 py-2 text-left font-medium">Método</th>
                  <th className="px-2 py-2 text-center font-medium">Alerta</th>
                  <th className="px-2 py-2 text-center font-medium">Telegram</th>
                  <th className="px-2 py-2 text-left font-medium">Gols</th>
                  <th className="px-2 py-2 text-right font-medium">Fim</th>
                  <th className="px-2 py-2 text-right font-medium">Rdo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a3142]">
                {result?.games.map((g, i) => (
                  <tr key={`${g.fixture_id}-${i}`} className="hover:bg-white/5">
                    <td className="px-2 py-1.5 text-gray-400 text-[10px]">{g.date ? format(parseISO(g.date), 'dd/MM HH:mm') : '-'}</td>
                    <td className="px-2 py-1.5 text-gray-200 text-[11px]">
                      <div className="flex flex-col">
                        <span>{g.home_team} vs {g.away_team}</span>
                        <span className="text-[8px] text-gray-500">ID: {g.fixture_id}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-gray-400 text-[10px]">{g.league}</td>
                    <td className="px-2 py-1.5 text-gray-400 text-[10px]">{g.variation}</td>
                    <td className="px-2 py-1.5 text-center text-gray-400 text-[11px]">{g.minute_at_alert}'</td>
                    <td className="px-2 py-1.5 text-center">
                      {g.telegram_alert_minute ? (
                        <div className={cn('inline-flex flex-col items-center gap-0.5 p-1 rounded-md border',
                          g.telegram_sent ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20')}>
                          {g.telegram_sent ? (
                            <>
                              <Send className="w-3 h-3 text-emerald-500" />
                              <span className="text-[8px] font-bold text-emerald-500 uppercase">Enviado</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
                              <span className="text-[8px] font-bold text-amber-500 uppercase">@{g.telegram_alert_minute}'</span>
                            </>
                          )}
                        </div>
                      ) : g.telegram_sent ? (
                        <div className="inline-flex flex-col items-center gap-0.5 p-1 rounded-md border bg-emerald-500/10 border-emerald-500/20">
                          <Send className="w-3 h-3 text-emerald-500" />
                          <span className="text-[8px] font-bold text-emerald-500 uppercase">Enviado</span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center opacity-30">
                          <Send className="w-3 h-3 text-gray-500" />
                          <span className="text-[8px] font-bold text-gray-500 uppercase">Imediato</span>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-emerald-400 text-[10px]">{g.goals || '-'}</td>
                    <td className="px-2 py-1.5 text-right text-gray-400 text-[10px]">{g.final_score}</td>
                    <td className="px-2 py-1.5 text-right">
                      {g.result === 'red' ? (
                        <div className="inline-flex items-center gap-1 bg-rose-500/10 rounded px-1.5 py-0.5">
                          <span className="text-rose-500 text-[10px] font-bold">-</span>
                          <input
                            key={`red-${g.fixture_id}-${redOverrides[String(g.fixture_id)] ?? 'def'}`}
                            type="text"
                            inputMode="decimal"
                            defaultValue={redOverrides[String(g.fixture_id)] ?? method.red_stake}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value.replace(',', '.'));
                              setRedOverride(String(g.fixture_id), Number.isFinite(v) && v !== method.red_stake ? v : null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            className="w-12 bg-transparent text-rose-400 text-[11px] font-bold text-right outline-none border-b border-transparent hover:border-rose-500/40 focus:border-rose-500"
                            title="Editar red stake (clique fora pra salvar)"
                          />
                          {redOverrides[String(g.fixture_id)] !== undefined && (
                            <button
                              onClick={() => setRedOverride(String(g.fixture_id), null)}
                              className="text-[8px] text-gray-500 hover:text-white"
                              title="Restaurar padrão"
                            >×</button>
                          )}
                        </div>
                      ) : (
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                          g.result === 'green' && 'bg-emerald-500/10 text-emerald-500',
                          g.result === 'pending' && 'bg-amber-500/10 text-amber-500',
                        )}>
                          {g.result === 'green' ? `+${(method.green_stake * GREEN_NET).toFixed(3)}` : 'PENDENTE'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {result && result.games.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-gray-500">Nenhum jogo encontrado para as variações deste método.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="analysis" className="mt-4 space-y-4">
          {result && (
            <AnalysisTab
              games={result.games as any}
              greenStake={method.green_stake}
              redStake={method.red_stake}
              entryMin={method.entry_minute}
              exitMin={method.exit_minute}
              quarantinedLeagues={quarantinedLeagues}
              onToggleQuarantine={toggleQuarantine}
            />
          )}
        </TabsContent>

        <TabsContent value="quarantine" className="mt-4 space-y-3">
          <Card className="bg-[#1e2333] border-[#2a3142]">
            <CardHeader className="py-3">
              <CardTitle className="text-sm text-white flex items-center"><Shield className="w-4 h-4 mr-2 text-amber-400" /> Ligas em Quarentena</CardTitle>
              <p className="text-[10px] text-gray-500">Jogos dessas ligas ficam fora das estatísticas principais. Use pra acompanhar se voltam a performar.</p>
            </CardHeader>
            <CardContent>
              {quarantinedLeagues.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Nenhuma liga em quarentena. Vá na aba Análise → Top 10 Piores/Melhores Ligas e clique no escudo pra colocar uma liga aqui.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {quarantinedLeagues.map(l => {
                    // find a games entry with that league_id to label nicely
                    const sample = (result?.allGames || result?.quarantineGames || []).find((g: any) => String(g.league_id) === String(l)) as any;
                    const label = sample?.league || sample?.league_name || l;
                    return (
                      <button
                        key={l}
                        onClick={() => toggleQuarantine(l)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs hover:bg-amber-500/20"
                        title="Tirar da quarentena"
                      >
                        <ShieldOff className="w-3.5 h-3.5" /> {label} <X className="w-3 h-3 opacity-60" />
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {result && quarantinedLeagues.length > 0 && (() => {
            const qg = result.quarantineGames.filter((g: any) => g.result !== 'pending');
            const greens = qg.filter((g: any) => g.result === 'green').length;
            const reds = qg.filter((g: any) => g.result === 'red').length;
            const lucro = qg.reduce((s: number, g: any) => s + (g.profit || 0), 0);
            const wr = qg.length ? (greens / qg.length) * 100 : 0;
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-[#1e2333] border-[#2a3142] p-4">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Entradas Quarentena</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">{qg.length}</p>
                    <p className="text-[10px] text-gray-500">{greens}G / {reds}R</p>
                  </Card>
                  <Card className="bg-[#1e2333] border-[#2a3142] p-4">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Win Rate Quarentena</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">{wr.toFixed(1)}%</p>
                  </Card>
                  <Card className="bg-[#1e2333] border-[#2a3142] p-4">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Lucro Hipotético</p>
                    <p className={cn('text-2xl font-bold mt-1', lucro >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                      {lucro >= 0 ? '+' : ''}{lucro.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-500">se desbloqueasse hoje</p>
                  </Card>
                  <Card className="bg-[#1e2333] border-[#2a3142] p-4">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Impacto no Método</p>
                    <p className={cn('text-2xl font-bold mt-1', lucro <= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                      {lucro <= 0 ? '+' : ''}{(-lucro).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-500">stakes economizadas</p>
                  </Card>
                </div>

                {(() => {
                  const dates: Record<string, string> = method.filters_snapshot?.quarantine_dates || {};
                  const rows = quarantinedLeagues.map(lid => {
                    const added = dates[lid];
                    const ligaGames = (result.allGames || []).filter((g: any) => String(g.league_id) === String(lid) && g.result !== 'pending');
                    const sample = ligaGames[0] || (result.quarantineGames || []).find((g: any) => String(g.league_id) === String(lid));
                    const label = sample?.league || sample?.league_name || lid;
                    const before = added ? ligaGames.filter((g: any) => new Date(g.date) < new Date(added)) : ligaGames;
                    const after = added ? ligaGames.filter((g: any) => new Date(g.date) >= new Date(added)) : [];
                    const agg = (arr: any[]) => {
                      const greens = arr.filter(g => g.result === 'green').length;
                      const reds = arr.filter(g => g.result === 'red').length;
                      const e = greens + reds;
                      const profit = arr.reduce((s, g) => s + (g.profit || 0), 0);
                      return { e, greens, reds, profit, wr: e ? (greens / e) * 100 : 0 };
                    };
                    return { lid, label, added, b: agg(before), a: agg(after) };
                  });
                  return (
                    <Card className="bg-[#1e2333] border-[#2a3142]">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm text-white flex items-center"><Shield className="w-4 h-4 mr-2 text-amber-400" /> Comparação: Antes vs Depois da Quarentena</CardTitle>
                        <p className="text-[10px] text-gray-500">Acompanhe se a liga está melhorando ou continuando ruim depois que você bloqueou.</p>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[#2a3142]/40 text-gray-400 text-[10px] uppercase">
                              <tr>
                                <th className="px-2 py-2 text-left" rowSpan={2}>Liga</th>
                                <th className="px-2 py-2 text-center" rowSpan={2}>Bloqueada em</th>
                                <th className="px-2 py-2 text-center border-l border-[#2a3142]" colSpan={4}>Antes (histórico)</th>
                                <th className="px-2 py-2 text-center border-l border-[#2a3142]" colSpan={4}>Depois (ao vivo)</th>
                                <th className="px-2 py-2 text-center border-l border-[#2a3142]" rowSpan={2}>Veredito</th>
                              </tr>
                              <tr>
                                <th className="px-1.5 py-1 text-center border-l border-[#2a3142] text-[9px]">Jogos</th>
                                <th className="px-1.5 py-1 text-center text-[9px]">WR</th>
                                <th className="px-1.5 py-1 text-center text-[9px]">G/R</th>
                                <th className="px-1.5 py-1 text-center text-[9px]">Lucro</th>
                                <th className="px-1.5 py-1 text-center border-l border-[#2a3142] text-[9px]">Jogos</th>
                                <th className="px-1.5 py-1 text-center text-[9px]">WR</th>
                                <th className="px-1.5 py-1 text-center text-[9px]">G/R</th>
                                <th className="px-1.5 py-1 text-center text-[9px]">Lucro</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2a3142]">
                              {rows.map(r => {
                                const wrDelta = r.a.e > 0 ? r.a.wr - r.b.wr : null;
                                const verdict = r.a.e === 0
                                  ? <span className="text-gray-500 text-[10px]">aguardando jogos</span>
                                  : wrDelta! > 5
                                    ? <span className="text-emerald-400 text-[10px] font-bold">↑ Melhorou {wrDelta!.toFixed(1)}pp</span>
                                    : wrDelta! < -5
                                      ? <span className="text-rose-400 text-[10px] font-bold">↓ Piorou {Math.abs(wrDelta!).toFixed(1)}pp</span>
                                      : <span className="text-amber-400 text-[10px]">~ Estável ({wrDelta!.toFixed(1)}pp)</span>;
                                return (
                                  <tr key={r.lid} className="hover:bg-white/5">
                                    <td className="px-2 py-1.5 text-gray-200 text-[11px]">{r.label}</td>
                                    <td className="px-2 py-1.5 text-center text-gray-400 text-[10px]">{r.added ? format(parseISO(r.added), 'dd/MM HH:mm') : '—'}</td>
                                    <td className="px-1.5 py-1.5 text-center text-gray-300 text-[10px] border-l border-[#2a3142]">{r.b.e}</td>
                                    <td className="px-1.5 py-1.5 text-center text-amber-400 text-[10px] font-bold">{r.b.wr.toFixed(1)}%</td>
                                    <td className="px-1.5 py-1.5 text-center text-[10px]"><span className="text-emerald-400">{r.b.greens}</span>/<span className="text-rose-400">{r.b.reds}</span></td>
                                    <td className={cn('px-1.5 py-1.5 text-center text-[10px] font-semibold', r.b.profit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{r.b.profit >= 0 ? '+' : ''}{r.b.profit.toFixed(2)}</td>
                                    <td className="px-1.5 py-1.5 text-center text-gray-300 text-[10px] border-l border-[#2a3142]">{r.a.e}</td>
                                    <td className="px-1.5 py-1.5 text-center text-amber-400 text-[10px] font-bold">{r.a.e ? r.a.wr.toFixed(1) + '%' : '—'}</td>
                                    <td className="px-1.5 py-1.5 text-center text-[10px]">{r.a.e ? <><span className="text-emerald-400">{r.a.greens}</span>/<span className="text-rose-400">{r.a.reds}</span></> : '—'}</td>
                                    <td className={cn('px-1.5 py-1.5 text-center text-[10px] font-semibold', r.a.profit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{r.a.e ? (r.a.profit >= 0 ? '+' : '') + r.a.profit.toFixed(2) : '—'}</td>
                                    <td className="px-2 py-1.5 text-center border-l border-[#2a3142]">{verdict}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[9px] text-gray-600 p-2 border-t border-[#2a3142]">
                          * Ligas bloqueadas antes desta atualização não têm data registrada — todo o histórico conta como "Antes".
                        </p>
                      </CardContent>
                    </Card>
                  );
                })()}

                <Card className="bg-[#1e2333] border-[#2a3142]">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm text-white">Jogos das Ligas em Quarentena</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-sm">
                        <thead className="bg-[#2a3142]/40 text-gray-400 text-[10px] uppercase sticky top-0">
                          <tr>
                            <th className="px-2 py-2 text-left">Data</th>
                            <th className="px-2 py-2 text-left">Partida</th>
                            <th className="px-2 py-2 text-left">Liga</th>
                            <th className="px-2 py-2 text-right">Fim</th>
                            <th className="px-2 py-2 text-right">Rdo (hipotético)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a3142]">
                          {result.quarantineGames.map((g: any, i: number) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="px-2 py-1.5 text-gray-400 text-[10px]">{g.date ? format(parseISO(g.date), 'dd/MM HH:mm') : '-'}</td>
                              <td className="px-2 py-1.5 text-gray-200 text-[11px]">{g.home_team} vs {g.away_team}</td>
                              <td className="px-2 py-1.5 text-amber-400 text-[10px]">{g.league}</td>
                              <td className="px-2 py-1.5 text-right text-gray-400 text-[10px]">{g.final_score}</td>
                              <td className={cn('px-2 py-1.5 text-right text-[11px] font-bold',
                                g.result === 'green' ? 'text-emerald-400' : g.result === 'red' ? 'text-rose-400' : 'text-amber-400')}>
                                {g.result === 'pending' ? 'PENDENTE' : (g.profit >= 0 ? '+' : '') + g.profit.toFixed(3)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface AnalysisGame {
  date: string;
  result: 'green' | 'red' | 'pending';
  profit: number;
  league: string;
  home_team: string;
  away_team: string;
  final_score: string;
  raw_goal_events: any[];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const AnalysisTab: React.FC<{ games: AnalysisGame[]; greenStake: number; redStake: number; entryMin: number; exitMin: number; quarantinedLeagues: string[]; onToggleQuarantine: (l: string) => void }> = ({ games, greenStake, redStake, entryMin, exitMin, quarantinedLeagues, onToggleQuarantine }) => {
  const analyzable = useMemo(() => games.filter(g => g.result !== 'pending'), [games]);
  const [dayDetail, setDayDetail] = useState<{ date: Date; games: AnalysisGame[] } | null>(null);

  // chronological (oldest -> newest) for time-series
  const chrono = useMemo(() => [...analyzable].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [analyzable]);

  const equityData = useMemo(() => {
    let acc = 0;
    return chrono.map((g, i) => {
      acc += g.profit || 0;
      return { index: i + 1, date: g.date, profit: Number(acc.toFixed(2)) };
    });
  }, [chrono]);

  const stats = useMemo(() => {
    let peak = 0, maxDD = 0, equity = 0;
    let curGreen = 0, curRed = 0;
    let maxGreen = 0, maxRed = 0;
    let redLossSum = 0, redCount = 0, redMin = Infinity, redMax = 0;
    let greenWinSum = 0, greenCount = 0;
    for (const g of chrono) {
      equity += g.profit || 0;
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDD) maxDD = dd;
      if (g.result === 'green') {
        curGreen++; curRed = 0; if (curGreen > maxGreen) maxGreen = curGreen;
        greenWinSum += g.profit; greenCount++;
      }
      else if (g.result === 'red') {
        curRed++; curGreen = 0; if (curRed > maxRed) maxRed = curRed;
        const loss = Math.abs(g.profit);
        redLossSum += loss; redCount++;
        if (loss < redMin) redMin = loss;
        if (loss > redMax) redMax = loss;
      }
    }
    const last = chrono[chrono.length - 1];
    const currentStreak = !last ? { type: 'none', count: 0 } :
      last.result === 'green' ? { type: 'green', count: curGreen } :
      last.result === 'red' ? { type: 'red', count: curRed } : { type: 'none', count: 0 };
    return {
      maxDD, maxGreen, maxRed, currentStreak,
      avgRed: redCount ? redLossSum / redCount : 0,
      minRed: redCount ? redMin : 0,
      maxRedLoss: redCount ? redMax : 0,
      redCount,
      avgGreen: greenCount ? greenWinSum / greenCount : 0,
    };
  }, [chrono]);

  const heatmap = useMemo(() => {
    // 7 weekdays x 6 time blocks of 4h each
    const blocks = [{label:'00-04',start:0,end:4},{label:'04-08',start:4,end:8},{label:'08-12',start:8,end:12},{label:'12-16',start:12,end:16},{label:'16-20',start:16,end:20},{label:'20-24',start:20,end:24}];
    const grid: { profit: number; entries: number; greens: number; reds: number }[][] = Array.from({ length: 7 }, () => blocks.map(() => ({ profit: 0, entries: 0, greens: 0, reds: 0 })));
    for (const g of analyzable) {
      if (!g.date) continue;
      const d = parseISO(g.date);
      const wd = getDay(d);
      const hr = d.getHours();
      const bi = blocks.findIndex(b => hr >= b.start && hr < b.end);
      if (bi < 0) continue;
      const cell = grid[wd][bi];
      cell.profit += g.profit || 0;
      cell.entries++;
      if (g.result === 'green') cell.greens++;
      else if (g.result === 'red') cell.reds++;
    }
    let absMax = 0;
    for (const row of grid) for (const c of row) absMax = Math.max(absMax, Math.abs(c.profit));
    return { grid, blocks, absMax };
  }, [analyzable]);

  const monthly = useMemo(() => {
    const m = new Map<string, { name: string; profit: number; greens: number; reds: number }>();
    for (const g of analyzable) {
      if (!g.date) continue;
      const key = format(parseISO(g.date), 'yyyy-MM');
      if (!m.has(key)) m.set(key, { name: key, profit: 0, greens: 0, reds: 0 });
      const x = m.get(key)!;
      x.profit += g.profit || 0;
      if (g.result === 'green') x.greens++; else if (g.result === 'red') x.reds++;
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name)).map(x => ({ ...x, profit: Number(x.profit.toFixed(2)), label: format(parseISO(x.name + '-01'), 'MMM/yy', { locale: ptBR }) }));
  }, [analyzable]);

  const winningGoalMinutes = useMemo(() => {
    const buckets: Record<number, number> = {};
    for (let i = 1; i <= 90; i++) buckets[i] = 0;
    for (const g of analyzable) {
      if (g.result !== 'green') continue;
      // first goal in window
      const inWin = (g.raw_goal_events || []).filter((ev: any) => {
        const m = (ev.minute || 0) + (ev.extra || 0);
        return m >= entryMin && m <= exitMin;
      }).sort((a: any, b: any) => ((a.minute || 0) + (a.extra || 0)) - ((b.minute || 0) + (b.extra || 0)));
      if (inWin.length === 0) continue;
      const m = Math.min(90, (inWin[0].minute || 0) + (inWin[0].extra || 0));
      if (m >= 1) buckets[m] = (buckets[m] || 0) + 1;
    }
    return Object.entries(buckets).map(([min, count]) => ({ minute: Number(min), count }));
  }, [analyzable, entryMin, exitMin]);

  const goalsByMinute = useMemo(() => {
    const buckets: Record<number, number> = {};
    for (let i = 1; i <= 90; i++) buckets[i] = 0;
    for (const g of analyzable) {
      for (const ev of g.raw_goal_events || []) {
        const m = Math.min(90, (ev.minute || 0) + (ev.extra || 0));
        if (m >= 1) buckets[m] = (buckets[m] || 0) + 1;
      }
    }
    const arr = Object.entries(buckets).map(([min, count]) => ({ minute: Number(min), count }));
    const topMinutes = new Set(
      [...arr].filter(d => d.count > 0).sort((a, b) => b.count - a.count).slice(0, 10).map(d => d.minute)
    );
    return arr.map(d => ({ ...d, top: topMinutes.has(d.minute) }));
  }, [analyzable]);

  const byWeekday = useMemo(() => {
    const agg: { name: string; greens: number; reds: number; profit: number; winRate: number }[] = WEEKDAYS.map(n => ({ name: n, greens: 0, reds: 0, profit: 0, winRate: 0 }));
    for (const g of analyzable) {
      if (!g.date) continue;
      const day = getDay(parseISO(g.date));
      const a = agg[day];
      if (g.result === 'green') a.greens++;
      else if (g.result === 'red') a.reds++;
      a.profit += g.profit;
    }
    return agg.map(a => ({ ...a, winRate: (a.greens + a.reds) > 0 ? (a.greens / (a.greens + a.reds)) * 100 : 0 }));
  }, [analyzable]);

  const leagueAgg = useMemo(() => {
    const m = new Map<string, { id: string; name: string; label: string; greens: number; reds: number; profit: number }>();
    for (const g of analyzable as any[]) {
      const id = g.league_id || g.league || '—';
      if (!m.has(id)) m.set(id, { id, name: g.league_name || g.league || '—', label: g.league || g.league_name || '—', greens: 0, reds: 0, profit: 0 });
      const x = m.get(id)!;
      if (g.result === 'green') x.greens++; else if (g.result === 'red') x.reds++;
      x.profit += g.profit;
    }
    const all = Array.from(m.values()).map(x => ({ ...x, entries: x.greens + x.reds, winRate: x.greens + x.reds > 0 ? (x.greens / (x.greens + x.reds)) * 100 : 0 }));
    const best = [...all].sort((a, b) => b.profit - a.profit).slice(0, 10);
    const worst = [...all].sort((a, b) => a.profit - b.profit).slice(0, 10);
    return { best, worst };
  }, [analyzable]);

  const teamAgg = useMemo(() => {
    const m = new Map<string, { name: string; greens: number; reds: number; profit: number }>();
    for (const g of analyzable) {
      for (const t of [g.home_team, g.away_team]) {
        if (!t) continue;
        if (!m.has(t)) m.set(t, { name: t, greens: 0, reds: 0, profit: 0 });
        const x = m.get(t)!;
        if (g.result === 'green') x.greens++; else if (g.result === 'red') x.reds++;
        x.profit += g.profit;
      }
    }
    const all = Array.from(m.values())
      .map(x => ({ ...x, entries: x.greens + x.reds, winRate: x.greens + x.reds > 0 ? (x.greens / (x.greens + x.reds)) * 100 : 0 }))
      .filter(x => x.entries >= 3);
    return {
      best: [...all].sort((a, b) => b.profit - a.profit).slice(0, 10),
      worst: [...all].sort((a, b) => a.profit - b.profit).slice(0, 10),
    };
  }, [analyzable]);

  return (
    <>
      {/* Equity curve */}
      <Card className="bg-[#1e2333] border-[#2a3142]">
        <CardHeader className="py-3">
          <CardTitle className="text-sm text-white flex items-center"><TrendingUp className="w-4 h-4 mr-2 text-emerald-400" /> Evolução Patrimonial (stakes acumuladas)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  stroke="#8b949e"
                  tickFormatter={(d: any) => d ? format(parseISO(d), 'dd/MM') : ''}
                  minTickGap={40}
                />
                <YAxis tick={{ fontSize: 10 }} stroke="#8b949e" />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ backgroundColor: '#1a1f2d', border: '1px solid #2a3142', color: '#e5e7eb', fontSize: 12 }} labelStyle={{ color: '#9ca3af' }} itemStyle={{ color: '#e5e7eb' }} formatter={(v: any) => [`${v} stk`, 'Lucro acumulado']} labelFormatter={(d: any) => d ? format(parseISO(d), "dd/MM/yyyy 'às' HH:mm") : ''} />
                <ReferenceLine y={0} stroke="#4b5563" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#eq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Drawdown + sequências + red médio */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-[#1e2333] border-[#2a3142] p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Red Médio</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">-{stats.avgRed.toFixed(3)}</p>
          <p className="text-[10px] text-gray-500" title={`${stats.redCount} reds`}>
            min -{stats.minRed.toFixed(2)} · máx -{stats.maxRedLoss.toFixed(2)}
          </p>
        </Card>
        <Card className="bg-[#1e2333] border-[#2a3142] p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Drawdown Máximo</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">-{stats.maxDD.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">stakes (pico → vale)</p>
        </Card>
        <Card className="bg-[#1e2333] border-[#2a3142] p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Maior Streak Green</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.maxGreen}</p>
          <p className="text-[10px] text-gray-500">verdes seguidos</p>
        </Card>
        <Card className="bg-[#1e2333] border-[#2a3142] p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Maior Streak Red</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">{stats.maxRed}</p>
          <p className="text-[10px] text-gray-500">vermelhos seguidos</p>
        </Card>
        <Card className="bg-[#1e2333] border-[#2a3142] p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Sequência Atual</p>
          <p className={cn('text-2xl font-bold mt-1', stats.currentStreak.type === 'green' ? 'text-emerald-400' : stats.currentStreak.type === 'red' ? 'text-rose-400' : 'text-gray-400')}>
            {stats.currentStreak.count}
          </p>
          <p className="text-[10px] text-gray-500">{stats.currentStreak.type === 'green' ? 'greens' : stats.currentStreak.type === 'red' ? 'reds' : '—'}</p>
        </Card>
      </div>

      <DailyProfitCalendar
        games={analyzable as any}
        greenStake={greenStake}
        redStake={redStake}
        onDayClick={(date, dayGames) => setDayDetail({ date, games: dayGames as AnalysisGame[] })}
      />

      <Sheet open={!!dayDetail} onOpenChange={(o) => !o && setDayDetail(null)}>
        <SheetContent side="right" className="bg-[#161b27] border-l border-[#2a3142] text-gray-200 w-full sm:max-w-[640px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white">
              {dayDetail && format(dayDetail.date, "dd/MM/yyyy")} — {dayDetail?.games.length} jogo(s)
            </SheetTitle>
            {dayDetail && (() => {
              const g = dayDetail.games.filter(x => x.result === 'green').length;
              const r = dayDetail.games.filter(x => x.result === 'red').length;
              const p = dayDetail.games.reduce((s, x) => s + (x.profit || 0), 0);
              return (
                <p className="text-xs text-gray-400">
                  <span className="text-emerald-400">{g}G</span> · <span className="text-rose-400">{r}R</span> · Lucro:{' '}
                  <span className={p >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{p >= 0 ? '+' : ''}{p.toFixed(2)} stk</span>
                </p>
              );
            })()}
          </SheetHeader>
          <table className="w-full text-sm mt-4">
            <thead className="bg-[#2a3142]/40 text-gray-400 text-[10px] uppercase sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left">Hora</th>
                <th className="px-2 py-1.5 text-left">Partida</th>
                <th className="px-2 py-1.5 text-left">Liga</th>
                <th className="px-2 py-1.5 text-right">Fim</th>
                <th className="px-2 py-1.5 text-right">Rdo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a3142]">
              {dayDetail?.games.map((g, i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="px-2 py-1.5 text-gray-400 text-[10px]">{g.date ? format(parseISO(g.date), 'HH:mm') : '-'}</td>
                  <td className="px-2 py-1.5 text-gray-200 text-[11px]">{g.home_team} vs {g.away_team}</td>
                  <td className="px-2 py-1.5 text-gray-400 text-[10px]">{g.league}</td>
                  <td className="px-2 py-1.5 text-right text-gray-400 text-[10px]">{g.final_score}</td>
                  <td className={cn('px-2 py-1.5 text-right text-[11px] font-bold',
                    g.result === 'green' ? 'text-emerald-400' : 'text-rose-400')}>
                    {(g.profit >= 0 ? '+' : '') + g.profit.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SheetContent>
      </Sheet>

      {/* Performance mês a mês */}
      <Card className="bg-[#1e2333] border-[#2a3142]">
        <CardHeader className="py-3">
          <CardTitle className="text-sm text-white flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-blue-400" /> Performance Mês a Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#8b949e" />
                <YAxis tick={{ fontSize: 10 }} stroke="#8b949e" />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ backgroundColor: '#1a1f2d', border: '1px solid #2a3142', color: '#e5e7eb', fontSize: 12 }} labelStyle={{ color: '#9ca3af' }} itemStyle={{ color: '#e5e7eb' }} formatter={(v: any, _n: any, p: any) => [`${v} stk (${p?.payload?.greens}G / ${p?.payload?.reds}R)`, 'Lucro']} />
                <ReferenceLine y={0} stroke="#4b5563" />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                  {monthly.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? '#10b981' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap horário × dia da semana */}
      <Card className="bg-[#1e2333] border-[#2a3142]">
        <CardHeader className="py-3">
          <CardTitle className="text-sm text-white flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-amber-400" /> Heatmap Horário × Dia da Semana</CardTitle>
          <p className="text-[10px] text-gray-500">Lucro em stakes por bloco de 4h</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-gray-500 font-medium p-1.5"></th>
                  {heatmap.blocks.map(b => <th key={b.label} className="text-center text-gray-500 font-medium p-1.5">{b.label}h</th>)}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((wd, wi) => (
                  <tr key={wd}>
                    <td className="text-left text-gray-400 font-medium p-1.5">{wd}</td>
                    {heatmap.grid[wi].map((cell, ci) => {
                      const intensity = heatmap.absMax > 0 ? Math.min(1, Math.abs(cell.profit) / heatmap.absMax) : 0;
                      const bg = cell.entries === 0 ? 'rgba(255,255,255,0.02)' :
                        cell.profit >= 0 ? `rgba(16, 185, 129, ${0.12 + intensity * 0.7})` : `rgba(239, 68, 68, ${0.12 + intensity * 0.7})`;
                      return (
                        <td key={ci} className="p-0.5">
                          <div className="rounded-md p-2 min-h-[58px] flex flex-col items-center justify-center" style={{ backgroundColor: bg }}>
                            {cell.entries > 0 ? (
                              <>
                                <span className={cn('text-[11px] font-bold', cell.profit >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{cell.profit >= 0 ? '+' : ''}{cell.profit.toFixed(1)}</span>
                                <span className="text-[8px] text-gray-400">{cell.entries}e</span>
                              </>
                            ) : (
                              <span className="text-[10px] text-gray-600">—</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Distribuição minutos do gol vencedor */}
      <Card className="bg-[#1e2333] border-[#2a3142]">
        <CardHeader className="py-3">
          <CardTitle className="text-sm text-white flex items-center"><TrendingUp className="w-4 h-4 mr-2 text-emerald-400" /> Minuto do Gol Vencedor</CardTitle>
          <p className="text-[10px] text-gray-500">Em quais minutos cai o gol que confirma o green (1º gol na janela {entryMin}'–{exitMin}')</p>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={winningGoalMinutes}>
                <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="minute" tick={{ fontSize: 8 }} stroke="#8b949e" interval={0} />
                <YAxis tick={{ fontSize: 10 }} stroke="#8b949e" />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ backgroundColor: '#1a1f2d', border: '1px solid #2a3142', color: '#e5e7eb', fontSize: 12 }} labelStyle={{ color: '#9ca3af' }} itemStyle={{ color: '#e5e7eb' }} formatter={(v: any) => [`${v} greens`, '']} labelFormatter={(l: any) => `Minuto ${l}`} />
                <Bar dataKey="count" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1e2333] border-[#2a3142]">
        <CardHeader className="py-3">
          <CardTitle className="text-sm text-white flex items-center"><BarChart3 className="w-4 h-4 mr-2 text-amber-400" /> Gols por Minuto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={goalsByMinute}>
                <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="minute" tick={{ fontSize: 8 }} stroke="#8b949e" interval={0} />
                <YAxis tick={{ fontSize: 10 }} stroke="#8b949e" />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ backgroundColor: '#1a1f2d', border: '1px solid #2a3142', color: '#e5e7eb', fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#e5e7eb' }}
                  formatter={(v: any, _n: any, p: any) => [`${v} gols${p?.payload?.top ? '  🔥 Top 10' : ''}`, `Minuto ${p?.payload?.minute}`]}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {goalsByMinute.map((d, i) => <Cell key={i} fill={d.top ? '#f59e0b' : '#3b82f6'} fillOpacity={d.top ? 1 : 0.45} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1e2333] border-[#2a3142]">
        <CardHeader className="py-3">
          <CardTitle className="text-sm text-white flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-blue-400" /> Resultado por Dia da Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byWeekday}>
                <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#8b949e" />
                <YAxis tick={{ fontSize: 10 }} stroke="#8b949e" />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ backgroundColor: '#1a1f2d', border: '1px solid #2a3142', color: '#e5e7eb', fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#e5e7eb' }}
                  formatter={(v: any, n: any) => n === 'profit' ? [`${Number(v).toFixed(2)} stk`, 'Lucro'] : [v, n]}
                />
                <ReferenceLine y={0} stroke="#4b5563" />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                  {byWeekday.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? '#10b981' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-7 gap-1 mt-2 text-center text-[10px]">
            {byWeekday.map(d => (
              <div key={d.name}>
                <div className="text-gray-500">{d.name}</div>
                <div className="text-emerald-400">{d.greens}G</div>
                <div className="text-rose-400">{d.reds}R</div>
                <div className="text-gray-400">{d.winRate.toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RankCard title="Top 10 Melhores Ligas" data={leagueAgg.best} positive quarantinable quarantined={quarantinedLeagues} onToggle={onToggleQuarantine} />
        <RankCard title="Top 10 Piores Ligas" data={leagueAgg.worst} positive={false} quarantinable quarantined={quarantinedLeagues} onToggle={onToggleQuarantine} />
        <RankCard title="Top 10 Melhores Times" data={teamAgg.best} positive subtitle="mín. 3 entradas" />
        <RankCard title="Top 10 Piores Times" data={teamAgg.worst} positive={false} subtitle="mín. 3 entradas" />
      </div>

    </>
  );
};

const RankCard: React.FC<{ title: string; data: any[]; positive: boolean; subtitle?: string; quarantinable?: boolean; quarantined?: string[]; onToggle?: (l: string) => void }> = ({ title, data, positive, subtitle, quarantinable, quarantined = [], onToggle }) => (
  <Card className="bg-[#1e2333] border-[#2a3142]">
    <CardHeader className="py-3">
      <CardTitle className="text-sm text-white flex items-center">
        {positive ? <TrendingUp className="w-4 h-4 mr-2 text-emerald-400" /> : <TrendingDown className="w-4 h-4 mr-2 text-rose-400" />}
        {title}
      </CardTitle>
      {subtitle && <p className="text-[10px] text-gray-500">{subtitle}</p>}
    </CardHeader>
    <CardContent className="p-0">
      <table className="w-full text-sm">
        <thead className="bg-[#2a3142]/40 text-gray-400 text-[10px] uppercase">
          <tr>
            <th className="px-2 py-1.5 text-left">#</th>
            <th className="px-2 py-1.5 text-left">Nome</th>
            <th className="px-2 py-1.5 text-center">G/R</th>
            <th className="px-2 py-1.5 text-center">WR</th>
            <th className="px-2 py-1.5 text-right">Lucro</th>
            {quarantinable && <th className="px-2 py-1.5 text-center w-8"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2a3142]">
          {data.map((d: any, i: number) => {
            const toggleKey = String(d.id ?? d.name);
            const display = d.label || d.name;
            const isQuar = quarantined.includes(toggleKey);
            return (
            <tr key={toggleKey} className={cn('hover:bg-white/5', isQuar && 'opacity-50')}>
              <td className="px-2 py-1.5 text-gray-500 text-[10px]">{i + 1}</td>
              <td className="px-2 py-1.5 text-gray-200 text-[11px] truncate max-w-[180px]" title={display}>{display}</td>
              <td className="px-2 py-1.5 text-center text-[10px]">
                <span className="text-emerald-400">{d.greens}</span>/<span className="text-rose-400">{d.reds}</span>
              </td>
              <td className="px-2 py-1.5 text-center text-gray-300 text-[10px]">{d.winRate.toFixed(0)}%</td>
              <td className={cn('px-2 py-1.5 text-right text-[11px] font-semibold', d.profit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {d.profit >= 0 ? '+' : ''}{d.profit.toFixed(2)}
              </td>
              {quarantinable && (
                <td className="px-1 py-1.5 text-center">
                  <button
                    onClick={() => onToggle && onToggle(toggleKey)}
                    className={cn('p-1 rounded hover:bg-white/10', isQuar ? 'text-amber-400' : 'text-gray-500 hover:text-amber-400')}
                    title={isQuar ? 'Tirar da quarentena' : 'Colocar em quarentena'}
                  >
                    <Shield className="w-3.5 h-3.5" />
                  </button>
                </td>
              )}
            </tr>
          );})}
          {data.length === 0 && <tr><td colSpan={quarantinable ? 6 : 5} className="p-6 text-center text-gray-500 text-xs">Sem dados.</td></tr>}
        </tbody>
      </table>
    </CardContent>
  </Card>
);

interface EditDialogProps {
  open: boolean;
  onClose: () => void;
  method: Method;
  allVariations: { id: string; name: string }[];
  onSaved: () => void;
}

const EditMethodDialog: React.FC<EditDialogProps> = ({ open, onClose, method, allVariations, onSaved }) => {
  const [name, setName] = useState(method.name);
  const [entry, setEntry] = useState(method.entry_minute);
  const [exit, setExit] = useState(method.exit_minute);
  const [green, setGreen] = useState(method.green_stake);
  const [red, setRed] = useState(method.red_stake);
  const [vars, setVars] = useState<string[]>(method.filters_snapshot?.variation_ids || []);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(method.name);
      setEntry(method.entry_minute);
      setExit(method.exit_minute);
      setGreen(method.green_stake);
      setRed(method.red_stake);
      setVars(method.filters_snapshot?.variation_ids || []);
    }
  }, [open, method]);

  const toggleVar = (id: string) => setVars(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const save = async () => {
    if (!name.trim()) { toast.error('Dê um nome para o método'); return; }
    if (vars.length === 0) { toast.error('Selecione pelo menos uma variação'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('strategy_simulations')
      .update({
        name: name.trim(),
        entry_minute: entry,
        exit_minute: exit,
        green_stake: green,
        red_stake: red,
        filters_snapshot: { ...(method.filters_snapshot || {}), variation_ids: vars, variation: vars.join(',') },
      })
      .eq('id', method.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Método atualizado');
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#161b27] border-[#2a3142] text-gray-200 max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-white">Editar Método</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-400">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#2a3142] border-[#3b4256]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-400">Minuto de Entrada</Label>
              <Input type="number" value={entry} onChange={(e) => setEntry(parseInt(e.target.value) || 0)} className="bg-[#2a3142] border-[#3b4256]" />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Minuto de Saída</Label>
              <Input type="number" value={exit} onChange={(e) => setExit(parseInt(e.target.value) || 0)} className="bg-[#2a3142] border-[#3b4256]" />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Ganho no Green</Label>
              <Input type="number" step="0.1" value={green} onChange={(e) => setGreen(parseFloat(e.target.value) || 0)} className="bg-[#2a3142] border-[#3b4256]" />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Perda no Red</Label>
              <Input type="number" step="0.1" value={red} onChange={(e) => setRed(parseFloat(e.target.value) || 0)} className="bg-[#2a3142] border-[#3b4256]" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1.5 block">Variações ({vars.length} selecionada(s))</Label>
            <div className="max-h-[220px] overflow-y-auto border border-[#2a3142] rounded-md p-2 space-y-1 bg-[#1a1f2d]">
              {allVariations.map(v => (
                <label key={v.id} className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded cursor-pointer">
                  <Checkbox checked={vars.includes(v.id)} onCheckedChange={() => toggleVar(v.id)} />
                  <span className="text-sm text-gray-200">{v.name}</span>
                </label>
              ))}
              {allVariations.length === 0 && <p className="text-xs text-gray-500 text-center py-4">Nenhuma variação ativa.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MethodDetail;
