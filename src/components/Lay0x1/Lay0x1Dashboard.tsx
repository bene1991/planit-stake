import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLay0x1Analyses } from '@/hooks/useLay0x1Analyses';
import { useLay0x1Weights } from '@/hooks/useLay0x1Weights';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Target, Trophy, AlertTriangle, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const Lay0x1Dashboard = () => {
  const { analyses, metrics, resolveAnalysis, refetch } = useLay0x1Analyses();
  const { weights } = useLay0x1Weights();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, { home: string; away: string }>>({});
  const [calibrating, setCalibrating] = useState(false);

  const pendingAnalyses = analyses.filter(a => !a.result);
  const resolvedAnalyses = analyses.filter(a => a.result);

  // Equity chart data
  const equityData = resolvedAnalyses
    .slice()
    .reverse()
    .reduce((acc: { name: string; equity: number }[], a, i) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].equity : 0;
      acc.push({
        name: `#${i + 1}`,
        equity: prev + (a.result === 'Green' ? 1 : -1),
      });
      return acc;
    }, []);

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
                <Tooltip />
                <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
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
          <h3 className="text-sm font-semibold mb-2">Pendentes ({pendingAnalyses.length})</h3>
          <div className="space-y-2">
            {pendingAnalyses.map(a => (
              <Card key={a.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.home_team} vs {a.away_team}</p>
                    <p className="text-xs text-muted-foreground">{a.league} • Score: {a.score_value}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="H"
                      className="w-12 h-8 text-center text-xs"
                      value={scoreInputs[a.id]?.home || ''}
                      onChange={(e) => setScoreInputs(prev => ({
                        ...prev,
                        [a.id]: { ...prev[a.id], home: e.target.value }
                      }))}
                    />
                    <span className="text-xs">x</span>
                    <Input
                      placeholder="A"
                      className="w-12 h-8 text-center text-xs"
                      value={scoreInputs[a.id]?.away || ''}
                      onChange={(e) => setScoreInputs(prev => ({
                        ...prev,
                        [a.id]: { ...prev[a.id], away: e.target.value }
                      }))}
                    />
                    <Button size="sm" variant="outline" className="h-8 text-xs"
                      disabled={resolvingId === a.id}
                      onClick={() => handleResolve(a.id)}>
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
            {resolvedAnalyses.slice(0, 20).map(a => (
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
