import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLay0x1Analyses } from '@/hooks/useLay0x1Analyses';
import { useLay0x1Weights } from '@/hooks/useLay0x1Weights';
import { useLay0x1BlockedLeagues } from '@/hooks/useLay0x1BlockedLeagues';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Target, Trophy, AlertTriangle, BarChart3, Info, RefreshCw, Trash2, Ban, ChevronDown, Brain, Loader2, CalendarDays } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { subDays, format, startOfDay } from 'date-fns';
import { getNowInBrasilia } from '@/utils/timezone';

export const Lay0x1Dashboard = () => {
  const { analyses, metrics, resolveAnalysis, deleteAnalysis, refetch } = useLay0x1Analyses();
  const { weights } = useLay0x1Weights();
  const { blockLeague, isBlocked } = useLay0x1BlockedLeagues();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, { home: string; away: string }>>({});
  const [calibrating, setCalibrating] = useState(false);
  const [autoResolving, setAutoResolving] = useState(false);
  const [resolveProgress, setResolveProgress] = useState({ current: 0, total: 0 });
  const [expandedRedId, setExpandedRedId] = useState<string | null>(null);
  const [analyzingRedId, setAnalyzingRedId] = useState<string | null>(null);

  // Filter: only from yesterday onwards (no old backtest data)
  const yesterdayStr = useMemo(() => {
    const now = getNowInBrasilia();
    return format(subDays(now, 1), 'yyyy-MM-dd');
  }, []);

  const recentAnalyses = useMemo(() =>
    analyses.filter(a => a.date >= yesterdayStr),
    [analyses, yesterdayStr]
  );

  // Pending = recent + no result
  const pendingAnalyses = recentAnalyses.filter(a => !a.result);

  // Resolved = recent + has result (regardless of classification)
  const resolvedAnalyses = useMemo(() =>
    recentAnalyses
      .filter(a => a.result)
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    [recentAnalyses]
  );

  // Metrics from recent data only
  const filteredMetrics = useMemo(() => {
    const all = recentAnalyses;
    const resolved = all.filter(a => a.result);
    const greens = resolved.filter(a => a.result === 'Green').length;
    const reds = resolved.filter(a => a.result === 'Red').length;
    const winRate = resolved.length > 0 ? Math.round((greens / resolved.length) * 1000) / 10 : 0;
    return { total: all.length, resolved: resolved.length, pending: all.filter(a => !a.result).length, greens, reds, winRate };
  }, [recentAnalyses]);

  // Equity chart data
  const equityData = useMemo(() => resolvedAnalyses
    .slice().reverse()
    .reduce((acc: { name: string; equity: number }[], a, i) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].equity : 0;
      acc.push({ name: `#${i + 1}`, equity: prev + (a.result === 'Green' ? 1 : -1) });
      return acc;
    }, []), [resolvedAnalyses]);

  // Monthly evolution data
  const monthlyData = useMemo(() => {
    const byMonth: Record<string, { greens: number; total: number }> = {};
    resolvedAnalyses.forEach(a => {
      const month = a.date?.substring(0, 7) || 'N/A';
      if (!byMonth[month]) byMonth[month] = { greens: 0, total: 0 };
      byMonth[month].total++;
      if (a.result === 'Green') byMonth[month].greens++;
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { greens, total }]) => ({
        month, winRate: Math.round((greens / total) * 100), total, greens,
      }));
  }, [resolvedAnalyses]);

  // Daily results data
  const dailyData = useMemo(() => {
    const byDay: Record<string, { greens: number; reds: number; total: number }> = {};
    resolvedAnalyses.forEach(a => {
      const day = a.date || 'N/A';
      if (!byDay[day]) byDay[day] = { greens: 0, reds: 0, total: 0 };
      byDay[day].total++;
      if (a.result === 'Green') byDay[day].greens++;
      else byDay[day].reds++;
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, { greens, reds, total }]) => ({
        date: date.substring(5),
        greens,
        reds: -reds,
        total,
        winRate: Math.round((greens / total) * 100),
      }));
  }, [resolvedAnalyses]);

  // League performance data
  const leagueData = useMemo(() => {
    const byLeague: Record<string, { greens: number; total: number }> = {};
    resolvedAnalyses.forEach(a => {
      const league = a.league || 'N/A';
      if (!byLeague[league]) byLeague[league] = { greens: 0, total: 0 };
      byLeague[league].total++;
      if (a.result === 'Green') byLeague[league].greens++;
    });
    return Object.entries(byLeague)
      .map(([league, { greens, total }]) => ({
        league, leagueFull: league,
        leagueShort: league.length > 20 ? league.substring(0, 18) + '…' : league,
        winRate: Math.round((greens / total) * 100), total, greens,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [resolvedAnalyses]);

  // Group resolved by date
  const resolvedByDate = useMemo(() => {
    const map = new Map<string, typeof resolvedAnalyses>();
    for (const a of resolvedAnalyses) {
      const day = a.date || 'N/A';
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(a);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [resolvedAnalyses]);

  const handleResolve = async (id: string) => {
    const input = scoreInputs[id];
    if (!input?.home || !input?.away) { toast.error('Informe o placar'); return; }
    setResolvingId(id);
    const err = await resolveAnalysis(id, parseInt(input.home), parseInt(input.away));
    if (!err) toast.success('Resultado registrado!');
    else toast.error('Erro ao registrar');
    setResolvingId(null);
  };

  const handleCalibrate = async () => {
    setCalibrating(true);
    try {
      const res = await supabase.functions.invoke('calibrate-lay0x1');
      if (res.data?.error) toast.error(res.data.error);
      else toast.success(`Calibração #${res.data?.cycle || '?'} concluída!`);
    } catch { toast.error('Erro na calibração'); }
    setCalibrating(false);
  };

  const handleAutoResolve = useCallback(async () => {
    if (pendingAnalyses.length === 0) return;
    setAutoResolving(true);
    setResolveProgress({ current: 0, total: pendingAnalyses.length });
    let resolvedCount = 0, skippedCount = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < pendingAnalyses.length; i += BATCH_SIZE) {
      const batch = pendingAnalyses.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (analysis) => {
        try {
          const res = await supabase.functions.invoke('api-football', {
            body: { endpoint: 'fixtures', params: { id: analysis.fixture_id } },
          });
          const fixture = res.data?.response?.[0];
          const status = fixture?.fixture?.status?.short;
          if (['FT', 'AET', 'PEN'].includes(status)) {
            await resolveAnalysis(analysis.id, fixture.goals?.home ?? 0, fixture.goals?.away ?? 0);
            resolvedCount++;
          } else { skippedCount++; }
        } catch { skippedCount++; }
        setResolveProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }));
    }

    setAutoResolving(false);
    if (resolvedCount > 0) {
      toast.success(`${resolvedCount} resolvido(s)${skippedCount > 0 ? ` • ${skippedCount} pendentes` : ''}`);
      refetch();
    } else if (skippedCount > 0) {
      toast.info(`Nenhum jogo terminou (${skippedCount} pendentes)`);
    }
  }, [pendingAnalyses, resolveAnalysis, refetch]);

  const handleReanalyzeRed = useCallback(async (analysisId: string) => {
    setAnalyzingRedId(analysisId);
    try {
      const res = await supabase.functions.invoke('analyze-red-lay0x1', {
        body: { analysis_id: analysisId },
      });
      if (res.data?.analysis) {
        toast.success('Análise de IA atualizada');
        refetch();
      } else {
        toast.error(res.data?.error || 'Erro na análise');
      }
    } catch { toast.error('Erro ao chamar IA'); }
    setAnalyzingRedId(null);
  }, [refetch]);

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <CalendarDays className="w-3.5 h-3.5" />
        <span>Dados a partir de {yesterdayStr} (excluindo backtest antigo)</span>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{filteredMetrics.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="w-5 h-5 mx-auto text-emerald-400 mb-1" />
            <p className="text-2xl font-bold text-emerald-400">{filteredMetrics.greens}</p>
            <p className="text-xs text-muted-foreground">Greens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto text-red-400 mb-1" />
            <p className="text-2xl font-bold text-red-400">{filteredMetrics.reds}</p>
            <p className="text-xs text-muted-foreground">Reds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-5 h-5 mx-auto text-blue-400 mb-1" />
            <p className="text-2xl font-bold">{filteredMetrics.winRate}%</p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Equity Chart */}
      {equityData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Curva de Equity</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={equityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip />
                <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly Evolution */}
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                <RechartsTooltip formatter={(value: number) => `${value}%`} />
                <Bar dataKey="winRate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily Results */}
      {dailyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Resultados por Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData} stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip
                  formatter={(value: number, name: string) => {
                    const absVal = Math.abs(value);
                    return [absVal, name === 'greens' ? 'Greens' : 'Reds'];
                  }}
                  labelFormatter={(label) => `Dia: ${label}`}
                />
                <Bar dataKey="greens" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} stackId="stack" />
                <Bar dataKey="reds" fill="hsl(0 84% 60%)" radius={[0, 0, 4, 4]} stackId="stack" />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Greens</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Reds</span>
            </div>
          </CardContent>
        </Card>
      )}

      {leagueData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Performance por Liga
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {leagueData.map(l => (
                <div key={l.leagueFull} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1 mr-2">{l.leagueShort}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${l.winRate}%`,
                          backgroundColor: l.winRate >= 70 ? 'hsl(var(--primary))' : l.winRate >= 50 ? 'hsl(45 93% 47%)' : 'hsl(0 84% 60%)',
                        }}
                      />
                    </div>
                    <span className="w-10 text-right font-medium">{l.winRate}%</span>
                    <span className="w-8 text-right text-muted-foreground">({l.total})</span>
                    {!isBlocked(l.leagueFull) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0"
                              onClick={() => blockLeague(l.leagueFull, l.winRate < 50 ? 'performance_ruim' : 'nao_disponivel')}>
                              <Ban className="w-3 h-3 text-muted-foreground hover:text-red-400" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Bloquear liga</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {isBlocked(l.leagueFull) && (
                      <Badge variant="outline" className="text-red-400 text-[10px] px-1">bloqueada</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calibration */}
      {filteredMetrics.resolved >= 10 && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Modelo Evolutivo</p>
              <p className="text-xs text-muted-foreground">
                Ciclo #{weights.cycle_count} • {filteredMetrics.resolved} jogos resolvidos
                {filteredMetrics.resolved > 0 && ` • Próx. calibração: ${30 - (filteredMetrics.resolved % 30)} jogos`}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleCalibrate} disabled={calibrating}>
              {calibrating ? 'Calibrando...' : 'Recalibrar Pesos'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending */}
      {pendingAnalyses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Pendentes ({pendingAnalyses.length})</h3>
            <Button size="sm" variant="outline" className="gap-2 text-xs" disabled={autoResolving} onClick={handleAutoResolve}>
              <RefreshCw className={`w-3.5 h-3.5 ${autoResolving ? 'animate-spin' : ''}`} />
              {autoResolving ? `Resolvendo ${resolveProgress.current}/${resolveProgress.total}...` : 'Resolver Pendentes'}
            </Button>
          </div>
          {autoResolving && (
            <Progress value={(resolveProgress.current / resolveProgress.total) * 100} className="h-1.5 mb-2" />
          )}
          <div className="space-y-2">
            {pendingAnalyses.map(a => (
              <Card key={a.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.home_team} vs {a.away_team}</p>
                    <p className="text-xs text-muted-foreground">{a.league} • {a.date} • Score: {a.score_value}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input placeholder="H" className="w-12 h-8 text-center text-xs"
                      value={scoreInputs[a.id]?.home || ''}
                      onChange={(e) => setScoreInputs(prev => ({ ...prev, [a.id]: { ...prev[a.id], home: e.target.value } }))} />
                    <span className="text-xs">x</span>
                    <Input placeholder="A" className="w-12 h-8 text-center text-xs"
                      value={scoreInputs[a.id]?.away || ''}
                      onChange={(e) => setScoreInputs(prev => ({ ...prev, [a.id]: { ...prev[a.id], away: e.target.value } }))} />
                    <Button size="sm" variant="outline" className="h-8 text-xs"
                      disabled={resolvingId === a.id} onClick={() => handleResolve(a.id)}>
                      {resolvingId === a.id ? '...' : 'OK'}
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                            onClick={() => deleteAnalysis(a.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir (adiado/cancelado)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {!isBlocked(a.league) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                              onClick={() => blockLeague(a.league, 'nao_disponivel')}>
                              <Ban className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Bloquear liga</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Resolved — grouped by date */}
      {resolvedByDate.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Histórico ({resolvedAnalyses.length})</h3>
          <div className="space-y-3">
            {resolvedByDate.map(([date, dayAnalyses]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">{date}</span>
                  <span className="text-xs text-muted-foreground">({dayAnalyses.length} jogo{dayAnalyses.length > 1 ? 's' : ''})</span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
                <div className="space-y-1.5">
                  {dayAnalyses.map(a => {
                    const aiAnalysis = a.criteria_snapshot?.ai_red_analysis;
                    const redInsights = a.criteria_snapshot?.red_insights as string[] | undefined;
                    const isExpanded = expandedRedId === a.id;

                    return (
                      <Card key={a.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium">{a.home_team} vs {a.away_team}</p>
                              <p className="text-xs text-muted-foreground">{a.league}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {a.final_score_home}-{a.final_score_away}
                              </span>
                              <Badge className={a.result === 'Green' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                                {a.result}
                              </Badge>
                              {a.was_0x1 && <Badge variant="outline" className="text-red-400 text-xs">0x1</Badge>}
                              {a.was_0x1 && (
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                  onClick={() => setExpandedRedId(isExpanded ? null : a.id)}>
                                  <ChevronDown className={`w-4 h-4 text-red-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </Button>
                              )}
                              {redInsights && redInsights.length > 0 && !a.was_0x1 && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="w-4 h-4 text-red-400 cursor-pointer" />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      <ul className="text-xs space-y-0.5">
                                        {redInsights.map((insight, i) => <li key={i}>• {insight}</li>)}
                                      </ul>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </div>

                          {/* Expanded AI Red Analysis */}
                          {a.was_0x1 && isExpanded && (
                            <div className="mt-3 pt-3 border-t border-border space-y-2">
                              {aiAnalysis ? (
                                <>
                                  <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-red-400" />
                                    <span className="text-xs font-semibold text-red-400">Análise IA Pós-Red</span>
                                    {aiAnalysis.risk_score && (
                                      <Badge variant="outline" className="text-xs">
                                        Risco: {aiAnalysis.risk_score}/10
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{aiAnalysis.summary}</p>
                                  {aiAnalysis.key_factors?.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium mb-1">Fatores-chave:</p>
                                      <ul className="text-xs text-muted-foreground space-y-0.5">
                                        {aiAnalysis.key_factors.map((f: string, i: number) => <li key={i}>• {f}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                  {aiAnalysis.league_recommendation && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-muted-foreground">Liga:</span>
                                      <Badge variant="outline" className={
                                        aiAnalysis.league_recommendation === 'bloquear' ? 'text-red-400' :
                                        aiAnalysis.league_recommendation === 'monitorar' ? 'text-yellow-400' : 'text-emerald-400'
                                      }>
                                        {aiAnalysis.league_recommendation}
                                      </Badge>
                                      <span className="text-muted-foreground">{aiAnalysis.league_reason}</span>
                                    </div>
                                  )}
                                  {aiAnalysis.threshold_suggestions?.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium mb-1">Sugestões de ajuste:</p>
                                      {aiAnalysis.threshold_suggestions.map((s: any, i: number) => (
                                        <p key={i} className="text-xs text-muted-foreground">
                                          {s.param}: {s.current} → {s.suggested} ({s.reason})
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {aiAnalysis.pattern_detected && (
                                    <p className="text-xs text-yellow-400">⚠️ Padrão: {aiAnalysis.pattern_detected}</p>
                                  )}
                                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground"
                                    disabled={analyzingRedId === a.id}
                                    onClick={() => handleReanalyzeRed(a.id)}>
                                    {analyzingRedId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                                    Re-analisar com IA
                                  </Button>
                                </>
                              ) : (
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground mb-2">
                                    {redInsights?.length ? redInsights.map((ins, i) => <span key={i} className="block">• {ins}</span>) : 'Nenhuma análise detalhada disponível'}
                                  </p>
                                  <Button variant="outline" size="sm" className="gap-1 text-xs"
                                    disabled={analyzingRedId === a.id}
                                    onClick={() => handleReanalyzeRed(a.id)}>
                                    {analyzingRedId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                                    Analisar com IA
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
