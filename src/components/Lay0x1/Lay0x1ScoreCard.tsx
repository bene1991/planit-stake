import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, XCircle, Target, Ban, CalendarPlus, Check, ChevronDown, ChevronRight, Bot } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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
  onRegisterReal?: () => void;
  registeringReal?: boolean;
  isOperated?: boolean;
  iaSelected?: boolean;
  iaJustification?: string;
  iaCriteria?: {
    btts_pct: number;
    over25_pct: number;
    home_clean_sheet_pct: number;
    away_clean_sheet_pct: number;
    home_goals_avg_10: number;
    away_conceded_avg_10: number;
  };
  liveScore?: {
    events?: Array<{
      minute: number;
      team: 'home' | 'away';
      type: string;
      player?: string;
      detail?: string;
    }>;
  } | null;
  isMobile?: boolean;
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

export const Lay0x1ScoreCard = ({ homeTeam, awayTeam, league, time, scoreValue, classification, approved, criteria, reasons, onSave, saving, backtestResult, onForceAdd, forceAdding, onBlockLeague, onSendToPlanning, sendingToPlanning, alreadyInPlanning, homeOdd, drawOdd, awayOdd, homeTeamLogo, awayTeamLogo, onSelect, isSelected, onRegisterReal, registeringReal, isOperated, iaSelected, iaJustification, iaCriteria, liveScore, isMobile: isMobileProp }: ScoreCardProps) => {
  const isMobileSystem = useIsMobile();
  const isMobile = isMobileProp ?? isMobileSystem;
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
    <div className={`group rounded-lg border transition-all ${isSelected
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
            {/* Show latest home goal if any */}
            {(() => {
              const lastHomeGoal = liveScore?.events?.reverse()?.find(e => e.team === 'home' && e.type === 'goal');
              if (lastHomeGoal) {
                return (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0 ml-1">
                    ⚽ {lastHomeGoal.player || 'Gol'} {lastHomeGoal.minute}'
                  </span>
                );
              }
              return null;
            })()}
          </div>
          <div className="flex items-center gap-2">
            <TeamLogo src={awayTeamLogo} name={awayTeam} />
            <span className="text-sm font-medium truncate">{awayTeam}</span>
            {/* Show latest away goal if any */}
            {(() => {
              const lastAwayGoal = liveScore?.events?.reverse()?.find(e => e.team === 'away' && e.type === 'goal');
              if (lastAwayGoal) {
                return (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0 ml-1">
                    ⚽ {lastAwayGoal.player || 'Gol'} {lastAwayGoal.minute}'
                  </span>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* Odds column */}
        {!isMobile && (
          <div className="shrink-0 w-12 text-right space-y-1">
            <p className="text-xs font-mono font-semibold">{homeOdd ? homeOdd.toFixed(2) : '—'}</p>
            <p className="text-xs font-mono font-semibold">{awayOdd ? awayOdd.toFixed(2) : '—'}</p>
          </div>
        )}

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
            <div className={`flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-semibold ${backtestResult.was0x1 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
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
            {iaSelected && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[10px] bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/40 cursor-help">
                      <Bot className="w-3 h-3 mr-1" /> IA Selection
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    <p className="font-medium">{iaJustification}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

          {/* IA Criteria Details */}
          {iaCriteria && approved && (
            <div className="rounded-md border border-cyan-500/20 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 px-3 py-1.5 flex items-center gap-1.5">
                <Bot className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wide">Dados IA Selection</span>
                {iaSelected ? (
                  <CheckCircle className="w-3 h-3 text-emerald-400 ml-auto" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-400 ml-auto" />
                )}
              </div>
              <div className="divide-y divide-border/20">
                {[
                  { label: 'BTTS (Ambas Marcam)', value: `${iaCriteria.btts_pct.toFixed(0)}%`, met: iaCriteria.btts_pct > 50 },
                  { label: 'Over 2.5', value: `${iaCriteria.over25_pct.toFixed(0)}%`, met: iaCriteria.over25_pct > 60 },
                  { label: 'Clean Sheet Casa', value: `${iaCriteria.home_clean_sheet_pct.toFixed(0)}%`, met: iaCriteria.home_clean_sheet_pct <= 50 },
                  { label: 'Clean Sheet Fora', value: `${iaCriteria.away_clean_sheet_pct.toFixed(0)}%`, met: iaCriteria.away_clean_sheet_pct <= 40 },
                ].map((c, i) => (
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
              {iaJustification && (
                <div className={`px-3 py-1.5 text-[10px] border-t border-border/20 ${iaSelected ? 'text-cyan-400/80' : 'text-red-400/80'}`}>
                  {iaJustification}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className={cn(
            "flex gap-2",
            isMobile ? "flex-col" : "flex-row"
          )}>
            {approved && onSave && (
              <button
                onClick={(e) => { e.stopPropagation(); onSave(); }}
                disabled={saving}
                className="flex-1 py-1.5 px-3 rounded-md bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Target className="w-3 h-3" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            )}

            {!approved && onForceAdd && (
              <button
                onClick={(e) => { e.stopPropagation(); onForceAdd(); }}
                disabled={forceAdding}
                className="flex-1 py-1.5 px-3 rounded-md border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Target className="w-3 h-3" />
                {forceAdding ? 'Adicionando...' : 'Adicionar'}
              </button>
            )}

            {onSendToPlanning && (
              <button
                onClick={(e) => { e.stopPropagation(); onSendToPlanning(); }}
                disabled={sendingToPlanning || alreadyInPlanning}
                className={cn(
                  "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50",
                  alreadyInPlanning
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-accent/50 text-accent-foreground hover:bg-accent/80 border border-border/40'
                )}
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

            {onRegisterReal && (
              <button
                onClick={(e) => { e.stopPropagation(); onRegisterReal(); }}
                disabled={registeringReal}
                className="flex-1 py-1.5 px-3 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 border border-emerald-500/30"
              >
                <Target className="w-3 h-3" />
                {registeringReal ? 'Registrando...' : 'Operar Real'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
