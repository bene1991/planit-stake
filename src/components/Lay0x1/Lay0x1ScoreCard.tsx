import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Target, Clock, Ban, CalendarPlus, Check } from 'lucide-react';

interface CriteriaDetail {
  home_goals_avg: number;
  away_conceded_avg: number;
  away_odd: number;
  over15_combined: number;
  h2h_0x1_count: number;
  league_goals_avg: number;
  criteria_met: Record<string, boolean>;
}

interface BacktestResult {
  scoreHome: number;
  scoreAway: number;
  was0x1: boolean;
}

interface ScoreCardProps {
  homeTeam: string;
  awayTeam: string;
  league: string;
  time?: string;
  scoreValue: number;
  classification: string;
  approved: boolean;
  criteria: CriteriaDetail;
  reasons: string[];
  onSave?: () => void;
  saving?: boolean;
  backtestResult?: BacktestResult;
  onForceAdd?: () => void;
  forceAdding?: boolean;
  onBlockLeague?: (leagueName: string) => void;
  onSendToPlanning?: () => void;
  sendingToPlanning?: boolean;
  alreadyInPlanning?: boolean;
}

const classificationColor: Record<string, string> = {
  'Muito Forte': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Forte': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Moderado': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'Não recomendado': 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const Lay0x1ScoreCard = ({ homeTeam, awayTeam, league, time, scoreValue, classification, approved, criteria, reasons, onSave, saving, backtestResult, onForceAdd, forceAdding, onBlockLeague, onSendToPlanning, sendingToPlanning, alreadyInPlanning }: ScoreCardProps) => {
  const criteriaList = [
    { label: 'Média gols mandante (casa)', value: criteria.home_goals_avg.toFixed(2), met: criteria.criteria_met.home_goals_avg },
    { label: 'Média gols sofridos visitante (fora)', value: criteria.away_conceded_avg.toFixed(2), met: criteria.criteria_met.away_conceded_avg },
    { label: 'Odd visitante', value: criteria.away_odd.toFixed(2), met: criteria.criteria_met.away_odd },
    { label: 'Over 1.5 combinado', value: `${criteria.over15_combined.toFixed(0)}%`, met: criteria.criteria_met.over15_combined },
    { label: 'H2H 0x1 (últimos 5)', value: `${criteria.h2h_0x1_count}`, met: criteria.criteria_met.h2h_no_0x1 },
  ];

  return (
    <Card className={`${approved ? 'border-primary/30' : 'border-border/40 opacity-75'}`}>
      <CardContent className="p-4 space-y-3">
        {/* Backtest result badge */}
        {backtestResult && (
          <div className={`flex items-center justify-between p-2 rounded-lg text-xs font-semibold ${backtestResult.was0x1 ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
            <span>{backtestResult.scoreHome} x {backtestResult.scoreAway}</span>
            <span>{backtestResult.was0x1 ? '❌ RED (0x1)' : '✅ GREEN'}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{homeTeam} vs {awayTeam}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {time && (
                <>
                  <Clock className="w-3 h-3" />
                  <span className="font-medium">{time}</span>
                  <span className="mx-0.5">•</span>
                </>
              )}
              <span>{league}</span>
              {onBlockLeague && (
                <button
                  onClick={(e) => { e.stopPropagation(); onBlockLeague(league); }}
                  className="ml-1 inline-flex items-center gap-0.5 text-red-400/60 hover:text-red-400 transition-colors"
                  title="Bloquear liga"
                >
                  <Ban className="w-3 h-3" />
                </button>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="4" />
                <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor"
                  className={scoreValue >= 85 ? 'text-emerald-400' : scoreValue >= 75 ? 'text-blue-400' : scoreValue >= 65 ? 'text-yellow-400' : 'text-red-400'}
                  strokeWidth="4" strokeDasharray={`${(scoreValue / 100) * 150.8} 150.8`} strokeLinecap="round" />
              </svg>
              <span className="absolute text-sm font-bold">{scoreValue}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={classificationColor[classification] || 'bg-muted'}>
            {classification}
          </Badge>
          {approved ? (
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
              <CheckCircle className="w-3 h-3 mr-1" /> Aprovado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-red-400 border-red-500/30">
              <XCircle className="w-3 h-3 mr-1" /> Reprovado
            </Badge>
          )}
        </div>

        <div className="space-y-1.5">
          {criteriaList.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                {c.met ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                <span className="text-muted-foreground">{c.label}</span>
              </div>
              <span className={c.met ? 'text-foreground' : 'text-red-400'}>{c.value}</span>
            </div>
          ))}
        </div>

        {reasons.length > 0 && (
          <div className="text-xs text-red-400/80 space-y-0.5">
            {reasons.map((r, i) => <p key={i}>• {r}</p>)}
          </div>
        )}

        {approved && onSave && (
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full mt-2 py-1.5 px-3 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Target className="w-3 h-3" />
            {saving ? 'Salvando...' : 'Salvar análise'}
          </button>
        )}

        {!approved && onForceAdd && (
          <button
            onClick={onForceAdd}
            disabled={forceAdding}
            className="w-full mt-2 py-1.5 px-3 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Target className="w-3 h-3" />
            {forceAdding ? 'Adicionando...' : 'Adicionar manualmente'}
          </button>
        )}

        {onSendToPlanning && (
          <button
            onClick={onSendToPlanning}
            disabled={sendingToPlanning || alreadyInPlanning}
            className={`w-full mt-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 ${
              alreadyInPlanning 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-accent/50 text-accent-foreground hover:bg-accent/80 border border-border/40'
            }`}
          >
            {alreadyInPlanning ? (
              <><Check className="w-3 h-3" /> Já no planejamento</>
            ) : sendingToPlanning ? (
              <><CalendarPlus className="w-3 h-3 animate-pulse" /> Enviando...</>
            ) : (
              <><CalendarPlus className="w-3 h-3" /> Enviar p/ Planejamento</>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
};
