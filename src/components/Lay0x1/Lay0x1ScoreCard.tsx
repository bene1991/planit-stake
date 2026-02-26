import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, XCircle, Target, Ban, CalendarPlus, Check, ChevronDown, ChevronRight } from 'lucide-react';

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
  homeOdd?: number;
  drawOdd?: number;
  awayOdd?: number;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  onSelect?: () => void;
  isSelected?: boolean;
}

const classificationColor: Record<string, string> = {
  'Muito Forte': 'text-emerald-400',
  'Forte': 'text-blue-400',
  'Moderado': 'text-yellow-400',
  'Não recomendado': 'text-red-400',
};

const scoreRingColor: Record<string, string> = {
  'Muito Forte': 'text-emerald-400',
  'Forte': 'text-blue-400',
  'Moderado': 'text-yellow-400',
  'Não recomendado': 'text-red-400',
};

export const Lay0x1ScoreCard = ({ homeTeam, awayTeam, league, time, scoreValue, classification, approved, criteria, reasons, onSave, saving, backtestResult, onForceAdd, forceAdding, onBlockLeague, onSendToPlanning, sendingToPlanning, alreadyInPlanning, homeOdd, drawOdd, awayOdd, homeTeamLogo, awayTeamLogo, onSelect, isSelected }: ScoreCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const criteriaList = [
    { label: 'Gols marcados (casa)', value: criteria.home_goals_avg.toFixed(2), met: criteria.criteria_met.home_goals_avg },
    { label: 'Gols sofridos (fora)', value: criteria.away_conceded_avg.toFixed(2), met: criteria.criteria_met.away_conceded_avg },
    { label: 'Odd visitante', value: criteria.away_odd.toFixed(2), met: criteria.criteria_met.away_odd },
    { label: 'Over 1.5 combinado', value: `${criteria.over15_combined.toFixed(0)}%`, met: criteria.criteria_met.over15_combined },
    { label: 'H2H 0x1 (últ. 5)', value: `${criteria.h2h_0x1_count}`, met: criteria.criteria_met.h2h_no_0x1 },
  ];

  const TeamLogo = ({ src, name }: { src?: string; name: string }) => (
    src ? (
      <img src={src} alt="" className="w-5 h-5 rounded-sm object-contain shrink-0" />
    ) : (
      <div className="w-5 h-5 rounded-sm bg-muted/40 flex items-center justify-center shrink-0">
        <span className="text-[8px] font-bold text-muted-foreground">{name.charAt(0)}</span>
      </div>
    )
  );

  return (
    <div className={`group rounded-lg border transition-all ${
      isSelected
        ? 'bg-primary/10 border-primary/60'
        : approved 
          ? 'bg-card/80 border-border/60 hover:border-primary/40' 
          : 'bg-card/40 border-border/30 opacity-80 hover:opacity-100'
    }`}>
      {/* Main row — Fulltrader style */}
      <button 
        onClick={() => { onSelect?.(); setExpanded(!expanded); }}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        {/* Time */}
        <div className="shrink-0 w-11 text-center">
          <span className="text-xs font-medium text-muted-foreground">{time || '—'}</span>
        </div>

        {/* Teams stacked */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <TeamLogo src={homeTeamLogo} name={homeTeam} />
            <span className="text-sm font-medium truncate">{homeTeam}</span>
          </div>
          <div className="flex items-center gap-2">
            <TeamLogo src={awayTeamLogo} name={awayTeam} />
            <span className="text-sm font-medium truncate">{awayTeam}</span>
          </div>
        </div>

        {/* Odds column */}
        <div className="shrink-0 w-12 text-right space-y-1">
          <p className="text-xs font-mono font-semibold">{homeOdd ? homeOdd.toFixed(2) : '—'}</p>
          <p className="text-xs font-mono font-semibold">{awayOdd ? awayOdd.toFixed(2) : '—'}</p>
        </div>

        {/* Score ring */}
        <div className="shrink-0 relative w-10 h-10 flex items-center justify-center">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" className="text-muted/15" strokeWidth="3" />
            <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor"
              className={scoreRingColor[classification] || 'text-muted-foreground'}
              strokeWidth="3" strokeDasharray={`${(scoreValue / 100) * 106.8} 106.8`} strokeLinecap="round" />
          </svg>
          <span className="absolute text-[10px] font-bold">{scoreValue}</span>
        </div>

        {/* Backtest result or approval indicator */}
        <div className="shrink-0 w-5 flex items-center">
          {backtestResult ? (
            <span className={`text-xs font-bold ${backtestResult.was0x1 ? 'text-red-400' : 'text-emerald-400'}`}>
              {backtestResult.was0x1 ? 'R' : 'G'}
            </span>
          ) : (
            <ChevronRight className={`w-4 h-4 text-muted-foreground/50 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          )}
        </div>
      </button>

      {/* Expanded detail — stats + actions */}
      {expanded && (
        <div className="border-t border-border/30 px-3 pb-3 pt-2 space-y-3">
          {/* Backtest score */}
          {backtestResult && (
            <div className={`flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-semibold ${
              backtestResult.was0x1 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              <span>Placar: {backtestResult.scoreHome} x {backtestResult.scoreAway}</span>
              <span>{backtestResult.was0x1 ? '❌ RED (0x1)' : '✅ GREEN'}</span>
            </div>
          )}

          {/* Classification + Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${classificationColor[classification] || ''}`}>
              {classification}
            </Badge>
            {approved ? (
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                <CheckCircle className="w-3 h-3 mr-1" /> Aprovado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">
                <XCircle className="w-3 h-3 mr-1" /> Reprovado
              </Badge>
            )}
            {onBlockLeague && (
              <button
                onClick={(e) => { e.stopPropagation(); onBlockLeague(league); }}
                className="inline-flex items-center gap-0.5 text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
                title="Bloquear liga"
              >
                <Ban className="w-3 h-3" /> Bloquear
              </button>
            )}
          </div>

          {/* Odds 1X2 row */}
          {(homeOdd || drawOdd || awayOdd) && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground mr-1">1X2</span>
              <div className="flex gap-1.5">
                {homeOdd ? (
                  <div className="bg-muted/40 rounded px-2 py-0.5 text-center min-w-[48px]">
                    <p className="text-[9px] text-muted-foreground">Casa</p>
                    <p className="text-xs font-bold font-mono">{homeOdd.toFixed(2)}</p>
                  </div>
                ) : null}
                {drawOdd ? (
                  <div className="bg-muted/40 rounded px-2 py-0.5 text-center min-w-[48px]">
                    <p className="text-[9px] text-muted-foreground">Empate</p>
                    <p className="text-xs font-bold font-mono">{drawOdd.toFixed(2)}</p>
                  </div>
                ) : null}
                {awayOdd ? (
                  <div className="bg-muted/40 rounded px-2 py-0.5 text-center min-w-[48px]">
                    <p className="text-[9px] text-muted-foreground">Fora</p>
                    <p className="text-xs font-bold font-mono">{awayOdd.toFixed(2)}</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Stats table — Fulltrader style */}
          <div className="rounded-md border border-border/30 overflow-hidden">
            <div className="bg-muted/20 px-3 py-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Dados Lay 0×1</span>
            </div>
            <div className="divide-y divide-border/20">
              {criteriaList.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    {c.met 
                      ? <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" /> 
                      : <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                    }
                    <span className="text-muted-foreground">{c.label}</span>
                  </div>
                  <span className={`font-mono font-semibold ${c.met ? 'text-foreground' : 'text-red-400'}`}>{c.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reasons */}
          {reasons.length > 0 && (
            <div className="text-xs text-red-400/80 space-y-0.5 pl-1">
              {reasons.map((r, i) => <p key={i}>• {r}</p>)}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {approved && onSave && (
              <button
                onClick={onSave}
                disabled={saving}
                className="flex-1 py-1.5 px-3 rounded-md bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Target className="w-3 h-3" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            )}

            {!approved && onForceAdd && (
              <button
                onClick={onForceAdd}
                disabled={forceAdding}
                className="flex-1 py-1.5 px-3 rounded-md border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Target className="w-3 h-3" />
                {forceAdding ? 'Adicionando...' : 'Adicionar'}
              </button>
            )}

            {onSendToPlanning && (
              <button
                onClick={onSendToPlanning}
                disabled={sendingToPlanning || alreadyInPlanning}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                  alreadyInPlanning 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-accent/50 text-accent-foreground hover:bg-accent/80 border border-border/40'
                }`}
              >
                {alreadyInPlanning ? (
                  <><Check className="w-3 h-3" /> No plano</>
                ) : sendingToPlanning ? (
                  <><CalendarPlus className="w-3 h-3 animate-pulse" /> Enviando...</>
                ) : (
                  <><CalendarPlus className="w-3 h-3" /> Planejamento</>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
