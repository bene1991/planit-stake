import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLay0x1Analyses } from '@/hooks/useLay0x1Analyses';
import { useLay0x1Weights } from '@/hooks/useLay0x1Weights';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Target, Trophy, AlertTriangle, BarChart3, Info, RefreshCw } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export const Lay0x1Dashboard = () => {
  const { analyses, metrics, resolveAnalysis, refetch } = useLay0x1Analyses();
  const { weights } = useLay0x1Weights();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, { home: string; away: string }>>({});
  const [calibrating, setCalibrating] = useState(false);
  const [autoResolving, setAutoResolving] = useState(false);
  const [resolveProgress, setResolveProgress] = useState({ current: 0, total: 0 });

  const pendingAnalyses = analyses.filter(a => !a.result);
  const resolvedAnalyses = analyses.filter(a => a.result);

  // Equity chart data
  const equityData = useMemo(() => resolvedAnalyses
    .slice()
    .reverse()
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
        month,
        winRate: Math.round((greens / total) * 100),
        total,
        greens,
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
        league: league.length > 20 ? league.substring(0, 18) + '…' : league,
        winRate: Math.round((greens / total) * 100),
        total,
        greens,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [resolvedAnalyses]);

  const handleResolve = async (id: string) => {
    const input = scoreInputs[id];
    if (!input?.home || !input?.away) {
      toast.error('Informe o placar');
      return;
    }
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
      if (res.data?.error) {
        toast.error(res.data.error);
      } else {
        toast.success(`Calibração #${res.data?.cycle || '?'} concluída!`);
      }
    } catch {
      toast.error('Erro na calibração');
    }
    setCalibrating(false);
  };

  const handleAutoResolve = useCallback(async () => {
    if (pendingAnalyses.length === 0) return;
    setAutoResolving(true);
    setResolveProgress({ current: 0, total: pendingAnalyses.length });

    let resolvedCount = 0;
    let skippedCount = 0;
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
            const homeGoals = fixture.goals?.home ?? 0;
            const awayGoals = fixture.goals?.away ?? 0;
            await resolveAnalysis(analysis.id, homeGoals, awayGoals);
            resolvedCount++;
          } else {
            skippedCount++;
          }
        } catch {
          skippedCount++;
        }
        setResolveProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }));
    }

    setAutoResolving(false);
    if (resolvedCount > 0) {
      toast.success(`${resolvedCount} jogo(s) resolvido(s) automaticamente${skippedCount > 0 ? ` • ${skippedCount} ainda não terminaram` : ''}`);
      refetch();
    } else if (skippedCount > 0) {
      toast.info(`Nenhum jogo terminou ainda (${skippedCount} pendentes)`);
    }
  }, [pendingAnalyses, resolveAnalysis, refetch]);

  return (
    <div className="space-y-4">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{metrics.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="w-5 h-5 mx-auto text-emerald-400 mb-1" />
            <p className="text-2xl font-bold text-emerald-400">{metrics.greens}</p>
            <p className="text-xs text-muted-foreground">Greens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto text-red-400 mb-1" />
            <p className="text-2xl font-bold text-red-400">{metrics.reds}</p>
            <p className="text-xs text-muted-foreground">Reds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-5 h-5 mx-auto text-blue-400 mb-1" />
            <p className="text-2xl font-bold">{metrics.winRate}%</p>
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

      {/* League Performance */}
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
                <div key={l.league} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1 mr-2">{l.league}</span>
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
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calibration */}
      {metrics.resolved >= 10 && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Modelo Evolutivo</p>
              <p className="text-xs text-muted-foreground">
                Ciclo #{weights.cycle_count} • {metrics.resolved} jogos resolvidos
                {metrics.resolved > 0 && ` • Próx. calibração: ${30 - (metrics.resolved % 30)} jogos`}
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
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-xs"
              disabled={autoResolving}
              onClick={handleAutoResolve}
            >
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
                    <p className="text-xs text-muted-foreground">{a.league} • Score: {a.score_value}</p>
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolvedAnalyses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Histórico ({resolvedAnalyses.length})</h3>
          <div className="space-y-1.5">
            {resolvedAnalyses.slice(0, 20).map(a => {
              const redInsights = a.criteria_snapshot?.red_insights as string[] | undefined;
              return (
                <Card key={a.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">{a.home_team} vs {a.away_team}</p>
                      <p className="text-xs text-muted-foreground">{a.league} • {a.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {a.final_score_home}-{a.final_score_away}
                      </span>
                      <Badge className={a.result === 'Green' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                        {a.result}
                      </Badge>
                      {a.was_0x1 && <Badge variant="outline" className="text-red-400 text-xs">0x1</Badge>}
                      {redInsights && redInsights.length > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-red-400 cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p className="font-semibold text-xs mb-1">Análise do Red:</p>
                              <ul className="text-xs space-y-0.5">
                                {redInsights.map((insight, i) => (
                                  <li key={i}>• {insight}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
