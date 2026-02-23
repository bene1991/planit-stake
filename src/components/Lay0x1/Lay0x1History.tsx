import { useLay0x1CalibrationHistory, CalibrationHistoryRecord } from '@/hooks/useLay0x1CalibrationHistory';
import { useLay0x1Weights } from '@/hooks/useLay0x1Weights';
import { useLay0x1Analyses } from '@/hooks/useLay0x1Analyses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Shield, BarChart3, ArrowRight, RefreshCw, Sparkles, Ban, Target } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEIGHT_LABELS: Record<string, string> = {
  offensive_weight: 'Ofensivo Casa',
  defensive_weight: 'Defensivo Visitante',
  over_weight: 'Over 1.5',
  league_avg_weight: 'Média Liga',
  h2h_weight: 'H2H',
  odds_weight: 'Odds',
};

export const Lay0x1History = () => {
  const { history, loading: historyLoading } = useLay0x1CalibrationHistory();
  const { weights, loading: weightsLoading } = useLay0x1Weights();
  const { analyses } = useLay0x1Analyses();

  const loading = historyLoading || weightsLoading;

  const resolvedAnalyses = analyses.filter(a => a.result);
  const totalGreens = resolvedAnalyses.filter(a => a.result === 'Green').length;
  const totalReds = resolvedAnalyses.filter(a => a.result === 'Red').length;
  const currentRate = resolvedAnalyses.length > 0 ? Math.round((totalGreens / resolvedAnalyses.length) * 100) : 0;
  const roi = totalGreens - totalReds;

  const lastHistory = history[0];
  const previousRate = lastHistory ? Math.round(lastHistory.general_rate * 100) : currentRate;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Model Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Resumo do Modelo Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Versão (Ciclo)</p>
              <p className="text-xl font-bold text-primary">v{weights.cycle_count}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Taxa Acerto</p>
              <p className="text-xl font-bold">{currentRate}%</p>
              {lastHistory && (
                <p className={`text-xs ${currentRate >= previousRate ? 'text-green-500' : 'text-red-500'}`}>
                  {currentRate >= previousRate ? '↑' : '↓'} antes: {previousRate}%
                </p>
              )}
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Ajustes Realizados</p>
              <p className="text-xl font-bold">{history.length}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">ROI (unidades)</p>
              <p className={`text-xl font-bold ${roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {roi >= 0 ? '+' : ''}{roi}
              </p>
            </div>
          </div>

          {/* Current weights bar */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Pesos Atuais do Modelo</p>
            {Object.entries(WEIGHT_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs w-32 truncate">{label}</span>
                <Progress value={(weights as any)[key] || 0} className="flex-1 h-2" />
                <span className="text-xs font-mono w-10 text-right">{(weights as any)[key]}</span>
              </div>
            ))}
          </div>

          {/* Dynamic min score indicator */}
          <div className="mt-3 flex items-center gap-2 p-2 rounded bg-muted/50">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs">Score Mínimo Dinâmico: <strong>{(weights as any).min_score ?? 65}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Detected Patterns (from latest calibration) */}
      {lastHistory?.patterns_detected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Padrões Identificados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lastHistory.patterns_detected.top_red_leagues?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Ligas com mais Red</p>
                <div className="flex flex-wrap gap-1.5">
                  {lastHistory.patterns_detected.top_red_leagues.map((l: any, i: number) => (
                    <Badge key={i} variant="destructive" className="text-xs">
                      {l.league}: {Math.round(l.rate * 100)}% Red ({l.reds}/{l.total})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {lastHistory.patterns_detected.consecutive_red_leagues?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">⚠️ 2+ Reds Consecutivos</p>
                <div className="flex flex-wrap gap-1.5">
                  {lastHistory.patterns_detected.consecutive_red_leagues.map((league: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs border-red-500 text-red-500">
                      {league}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {lastHistory.patterns_detected.odds_performance?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Desempenho por Faixa de Odds</p>
                <div className="grid grid-cols-3 gap-2">
                  {lastHistory.patterns_detected.odds_performance.map((o: any, i: number) => (
                    <div key={i} className="text-center p-2 rounded bg-muted/50">
                      <p className="text-xs font-mono">{o.range}</p>
                      <p className={`text-sm font-bold ${o.rate >= 70 ? 'text-green-500' : o.rate >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {o.rate}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">{o.total} jogos</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lastHistory.patterns_detected.red_avg_offensive && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingDown className="w-3 h-3 text-red-500" />
                <span>Média ofensiva nos Reds: <strong>{lastHistory.patterns_detected.red_avg_offensive.median}</strong> ({lastHistory.patterns_detected.red_avg_offensive.count} jogos)</span>
              </div>
            )}

            {lastHistory.patterns_detected.red_avg_over15 && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingDown className="w-3 h-3 text-red-500" />
                <span>Over 1.5 combinado nos Reds: <strong>{lastHistory.patterns_detected.red_avg_over15.median}%</strong></span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Calibration Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Timeline de Calibrações ({history.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma calibração realizada ainda.</p>
              <p className="text-xs">A calibração ocorre automaticamente a cada 30 jogos resolvidos.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record) => (
                <CalibrationCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function CalibrationCard({ record }: { record: CalibrationHistoryRecord }) {
  const weightKeys = Object.keys(WEIGHT_LABELS);
  const aiRec = record.ai_recommendations as any;
  const hasAI = aiRec && Object.keys(aiRec).length > 0;

  const strengthened = weightKeys.filter(k => (record.new_weights[k] || 0) > (record.old_weights[k] || 0));
  const weakened = weightKeys.filter(k => (record.new_weights[k] || 0) < (record.old_weights[k] || 0));

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Ciclo {record.cycle_number}
          </Badge>
          {record.forced_rebalance && (
            <Badge variant="secondary" className="text-xs gap-1">
              <RefreshCw className="w-3 h-3" /> Anti-overfitting
            </Badge>
          )}
          {hasAI && (
            <Badge className="text-xs gap-1 bg-purple-600">
              <Sparkles className="w-3 h-3" /> IA
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {format(new Date(record.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span>Taxa: <strong>{Math.round(record.general_rate * 100)}%</strong></span>
        <span>Jogos: <strong>{record.total_analyses}</strong></span>
        <span>Tipo: <strong>{record.trigger_type}</strong></span>
      </div>

      {/* AI Recommendations Section */}
      {hasAI && (
        <div className="border border-purple-500/20 rounded-lg p-2.5 bg-purple-500/5 space-y-2">
          <p className="text-xs font-medium flex items-center gap-1.5 text-purple-400">
            <Sparkles className="w-3.5 h-3.5" /> Recomendações da IA
          </p>
          
          {aiRec.strategic_summary && (
            <p className="text-xs text-muted-foreground italic">"{aiRec.strategic_summary}"</p>
          )}

          {aiRec.trends?.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground">Tendências:</p>
              {aiRec.trends.map((t: string, i: number) => (
                <p key={i} className="text-[10px] text-muted-foreground">• {t}</p>
              ))}
            </div>
          )}

          {aiRec.leagues_to_block?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Ban className="w-3 h-3 text-red-500" />
              <span className="text-[10px] text-red-400">Ligas bloqueadas pela IA:</span>
              {aiRec.leagues_to_block.map((l: string, i: number) => (
                <Badge key={i} variant="destructive" className="text-[10px] h-4">{l}</Badge>
              ))}
            </div>
          )}

          {aiRec.recommended_min_score && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <Target className="w-3 h-3 text-primary" />
              <span>Score mínimo recomendado: <strong>{aiRec.recommended_min_score}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Weight deltas */}
      <div className="grid grid-cols-2 gap-1">
        {strengthened.length > 0 && (
          <div>
            <p className="text-[10px] text-green-500 font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Fortalecidos
            </p>
            {strengthened.map(k => (
              <p key={k} className="text-[10px] text-muted-foreground">
                {WEIGHT_LABELS[k]}: {record.old_weights[k]} <ArrowRight className="w-2 h-2 inline" /> {record.new_weights[k]}
              </p>
            ))}
          </div>
        )}
        {weakened.length > 0 && (
          <div>
            <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Enfraquecidos
            </p>
            {weakened.map(k => (
              <p key={k} className="text-[10px] text-muted-foreground">
                {WEIGHT_LABELS[k]}: {record.old_weights[k]} <ArrowRight className="w-2 h-2 inline" /> {record.new_weights[k]}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Changes summary */}
      {record.changes_summary?.length > 0 && (
        <div className="border-t pt-2 mt-2">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Alterações</p>
          {record.changes_summary.map((change, i) => (
            <p key={i} className="text-[10px] text-muted-foreground">• {change}</p>
          ))}
        </div>
      )}
    </div>
  );
}
