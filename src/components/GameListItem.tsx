import { Game, Method, GoalEvent } from "@/types";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, Check, X, Minus, ChevronRight, Settings, Trash2, MoreVertical, DollarSign, AlertCircle, Sparkles, BarChart3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamLogo } from "@/hooks/useTeamLogo";
import { useState, useEffect, useRef, useMemo } from "react";
import { GameNotesEditor } from "@/components/GameNotesEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useFixtureCache, OnRedCardDetected } from "@/hooks/useFixtureCache";
import { useDominanceAnalysis } from "@/hooks/useDominanceAnalysis";
import { LiveDominanceDisplay } from "@/components/LiveDominanceDisplay";
import { useLdiHistory } from "@/hooks/useLdiHistory";
import { useLiveMomentAI } from "@/hooks/useLiveMomentAI";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PreMatchModal } from "@/components/PreMatchAnalysis/PreMatchModal";

interface LiveScoreEvent {
  minute: number;
  team: 'home' | 'away';
  type: string;
  player?: string;
  detail?: string;
}

interface LiveScore {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  status: string;
  statusLong: string;
  homeTeamId?: number;
  awayTeamId?: number;
  events?: LiveScoreEvent[];
  goalDetectedAt?: number;
}

interface GameListItemProps {
  game: Game;
  methods: Method[];
  onUpdate: (gameId: string, updates: Partial<Game>) => void;
  onDelete: (gameId: string) => void;
  onEdit?: (game: Game) => void;
  liveScore?: LiveScore | null;
  lastGlobalRefresh?: number;
  isHighlighted?: boolean;
  globalPaused?: boolean;
  onRedCardDetected?: OnRedCardDetected;
  onSelect?: () => void;
  isSelected?: boolean;
  compact?: boolean;
}

export function GameListItem({
  game,
  methods,
  onUpdate,
  onDelete,
  onEdit,
  liveScore,
  lastGlobalRefresh,
  isHighlighted,
  globalPaused = false,
  onRedCardDetected,
  onSelect,
  isSelected,
  compact = false,
}: GameListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPreMatch, setShowPreMatch] = useState(false);
  const [localElapsed, setLocalElapsed] = useState<{ minutes: number; seconds: number } | null>(null);
  const lastSyncRef = useRef<number>(0);

  const { logoUrl: homeLogo } = useTeamLogo(game.homeTeam);
  const { logoUrl: awayLogo } = useTeamLogo(game.awayTeam);

  const isLiveForFetch = (game.status === 'Live' || game.status === 'Pending');
  const { data: fixtureCache } = useFixtureCache(game.api_fixture_id, isLiveForFetch, globalPaused, liveScore?.goalDetectedAt, onRedCardDetected);
  const dominance = useDominanceAnalysis(fixtureCache);
  const ldiHistory = useLdiHistory(
    game.api_fixture_id ? Number(game.api_fixture_id) : undefined,
    fixtureCache?.minute_now,
    dominance.dominanceIndex
  );

  const { text: aiMomentText, loading: aiLoading } = useLiveMomentAI(
    isLiveForFetch && game.status === 'Live',
    game.homeTeam,
    game.awayTeam,
    liveScore?.homeScore ?? game.finalScoreHome ?? null,
    liveScore?.awayScore ?? game.finalScoreAway ?? null,
    dominance,
    fixtureCache,
    ldiHistory
  );
  const homeTeamLogo = game.homeTeamLogo || homeLogo;
  const awayTeamLogo = game.awayTeamLogo || awayLogo;

  const fixtureStatus = liveScore?.status;
  const isGameLive = fixtureStatus
    ? ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(fixtureStatus)
    : (game.status === 'Live' || game.status === 'Pending');

  const isLive = isGameLive;
  const isHalfTime = fixtureStatus === 'HT';
  const isExtraTime = fixtureStatus === 'ET';
  const isPenalty = fixtureStatus === 'P';
  const isFinished = fixtureStatus ? ['FT', 'AET', 'PEN'].includes(fixtureStatus) : game.status === 'Finished';

  const apiElapsed = liveScore?.elapsed;

  useEffect(() => {
    if (apiElapsed && isLive && lastGlobalRefresh) {
      if (lastGlobalRefresh > lastSyncRef.current) {
        setLocalElapsed({ minutes: apiElapsed, seconds: 0 });
        lastSyncRef.current = lastGlobalRefresh;
      }
    }
  }, [apiElapsed, isLive, lastGlobalRefresh]);

  useEffect(() => {
    if (apiElapsed && isLive && !localElapsed) {
      setLocalElapsed({ minutes: apiElapsed, seconds: 0 });
    }
  }, [apiElapsed, isLive, localElapsed]);

  useEffect(() => {
    if (!isLive || !localElapsed || isHalfTime) return;

    const interval = setInterval(() => {
      setLocalElapsed(prev => {
        if (!prev) return null;
        let newSeconds = prev.seconds + 1;
        let newMinutes = prev.minutes;
        if (newSeconds >= 60) {
          newSeconds = 0;
          newMinutes += 1;
        }
        return { minutes: newMinutes, seconds: newSeconds };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive, localElapsed, isHalfTime]);

  const getMethodName = (methodId: string) => {
    return methods.find(m => m.id === methodId)?.name || 'Método';
  };

  const getFinancialStatus = (op: { odd?: number; stakeValue?: number }) => {
    const hasOdd = op.odd && op.odd > 0;
    const hasStake = op.stakeValue && op.stakeValue > 0;
    return { hasOdd, hasStake, complete: hasOdd && hasStake, partial: (hasOdd || hasStake) && !(hasOdd && hasStake) };
  };

  const homeScore = liveScore?.homeScore ?? game.finalScoreHome ?? null;
  const awayScore = liveScore?.awayScore ?? game.finalScoreAway ?? null;
  const hasScore = homeScore !== null;

  const handleResultClick = (methodId: string, result: 'Green' | 'Red' | 'Void') => {
    const updatedOperations = game.methodOperations.map(op =>
      op.methodId === methodId ? { ...op, result } : op
    );
    onUpdate(game.id, { methodOperations: updatedOperations });
  };

  const status = useMemo(() => {
    if (isHalfTime) return { text: 'INT', subText: '45\'', color: 'text-amber-500' };
    if (isExtraTime) return { text: 'PRR', subText: localElapsed ? `${localElapsed.minutes}'` : '', color: 'text-orange-500' };
    if (isPenalty) return { text: 'PEN', subText: '', color: 'text-purple-500' };
    if (isLive && localElapsed) {
      const period = localElapsed.minutes <= 45 ? '1T' : '2T';
      return { text: period, subText: `${localElapsed.minutes}'`, color: 'text-primary' };
    }
    if (isFinished) return { text: 'FIM', subText: '', color: 'text-muted-foreground' };
    return { text: game.time, subText: '', color: 'text-muted-foreground' };
  }, [isHalfTime, isExtraTime, isPenalty, isLive, localElapsed, isFinished, game.time]);

  const { homeGoals, awayGoals } = useMemo(() => {
    const goals = { homeGoals: [] as any[], awayGoals: [] as any[] };

    if (fixtureCache?.key_events?.length) {
      const keyGoals = fixtureCache.key_events.filter(e => e.type === 'goal');
      goals.homeGoals = keyGoals.filter(e => e.team === 'home').map(e => ({ playerName: e.player || 'Gol', minute: e.minute, detail: e.detail }));
      goals.awayGoals = keyGoals.filter(e => e.team === 'away').map(e => ({ playerName: e.player || 'Gol', minute: e.minute, detail: e.detail }));
    }

    if (liveScore?.events?.length) {
      const liveGoals = liveScore.events.filter(e => e.type === 'goal');
      const lHome = liveGoals.filter(e => e.team === 'home').map(e => ({ playerName: e.player || 'Gol', minute: e.minute, detail: e.detail }));
      const lAway = liveGoals.filter(e => e.team === 'away').map(e => ({ playerName: e.player || 'Gol', minute: e.minute, detail: e.detail }));
      if (goals.homeGoals.length === 0) goals.homeGoals = lHome;
      if (goals.awayGoals.length === 0) goals.awayGoals = lAway;
    }

    if (goals.homeGoals.length === 0 && goals.awayGoals.length === 0 && game.goalEvents?.length) {
      const homeTeamId = liveScore?.homeTeamId;
      const awayTeamId = liveScore?.awayTeamId;
      if (homeTeamId && awayTeamId) {
        goals.homeGoals = game.goalEvents.filter(e => e.teamId === homeTeamId);
        goals.awayGoals = game.goalEvents.filter(e => e.teamId === awayTeamId);
      } else {
        const byTeam = game.goalEvents.reduce((acc, e) => { if (!acc[e.teamId]) acc[e.teamId] = []; acc[e.teamId].push(e); return acc; }, {} as Record<number, any[]>);
        const teamIds = Object.keys(byTeam).map(Number);
        if (teamIds.length >= 1) {
          goals.homeGoals = byTeam[teamIds[0]] || [];
          goals.awayGoals = teamIds.length > 1 ? byTeam[teamIds[1]] : [];
        }
      }
    }

    if (homeScore > 0 && goals.homeGoals.length === 0) {
      goals.homeGoals = Array(homeScore).fill(0).map(() => ({ playerName: 'Gol...', minute: '??', detail: '' }));
    }
    if (awayScore > 0 && goals.awayGoals.length === 0) {
      goals.awayGoals = Array(awayScore).fill(0).map(() => ({ playerName: 'Gol...', minute: '??', detail: '' }));
    }

    return goals;
  }, [fixtureCache?.key_events, liveScore?.events, liveScore?.homeTeamId, liveScore?.awayTeamId, game.goalEvents, homeScore, awayScore]);

  const { homeRedCards, awayRedCards } = useMemo(() => {
    if (fixtureCache?.key_events?.length) {
      const reds = fixtureCache.key_events.filter((e: any) => e.type === 'red_card');
      return {
        homeRedCards: reds.filter((e: any) => e.team === 'home'),
        awayRedCards: reds.filter((e: any) => e.team === 'away'),
      };
    }
    return { homeRedCards: [], awayRedCards: [] };
  }, [fixtureCache?.key_events]);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn(
        "bg-[#121A24] border-b border-white/5 transition-all duration-200 cursor-pointer group relative",
        "hover:bg-[#182230]",
        isSelected && "ring-1 ring-emerald-500/40 z-10",
        isHighlighted && "ring-1 ring-yellow-500/30 bg-[#1A1A10] z-20",
        compact ? "py-2 px-3" : "py-4 px-4"
      )}
        onClick={() => onSelect?.()}
      >
        {isHighlighted && (
          <div className="absolute top-0 right-0 px-1.5 py-0.5 bg-yellow-500/10 border-b border-l border-yellow-500/20 rounded-bl-sm">
            <span className="text-[8px] font-bold text-yellow-500 uppercase tracking-tighter">Último Gol</span>
          </div>
        )}
        <div className="flex items-start gap-3">
          <CollapsibleTrigger asChild>
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  {/* Home Team & Scorers */}
                  <div>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5 flex-shrink-0">
                        <AvatarImage src={homeTeamLogo} alt={game.homeTeam} />
                        <AvatarFallback className="bg-zinc-800 text-zinc-500 text-[8px]"><Shield className="h-3 w-3" /></AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-gray-200 truncate">{game.homeTeam}</span>
                      {homeRedCards.length > 0 && <span className="text-red-500 font-bold text-[10px]">🟥</span>}
                    </div>
                    {homeGoals.length > 0 && (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 ml-7">
                        {homeGoals.map((g, i) => (
                          <div key={`h-${i}`} className="text-[8px] text-gray-500 flex items-center gap-0.5">
                            <span className="opacity-40 text-[7px]">⚽</span> {g.playerName} {g.minute}'
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Away Team & Scorers */}
                  <div>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5 flex-shrink-0">
                        <AvatarImage src={awayTeamLogo} alt={game.awayTeam} />
                        <AvatarFallback className="bg-zinc-800 text-zinc-500 text-[8px]"><Shield className="h-3 w-3" /></AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-gray-200 truncate">{game.awayTeam}</span>
                      {awayRedCards.length > 0 && <span className="text-red-500 font-bold text-[10px]">🟥</span>}
                    </div>
                    {awayGoals.length > 0 && (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 ml-7">
                        {awayGoals.map((g, i) => (
                          <div key={`a-${i}`} className="text-[8px] text-gray-500 flex items-center gap-0.5">
                            <span className="opacity-40 text-[7px]">⚽</span> {g.playerName} {g.minute}'
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 px-4 border-l border-white/5">
                  <div className="flex items-center gap-2 font-black text-xl tabular-nums bg-white/5 px-3 py-1 rounded-md border border-white/5">
                    <span className="text-emerald-500">{hasScore ? homeScore : '-'}</span>
                    <span className="text-gray-700 text-xs">:</span>
                    <span className="text-emerald-500">{hasScore ? awayScore : '-'}</span>
                  </div>
                  <div className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                    status.color === 'text-primary' ? 'text-emerald-400 bg-emerald-500/10' : `${status.color} bg-white/5`
                  )}>
                    {status.text} {status.subText && <span className="opacity-60">{status.subText}</span>}
                  </div>
                </div>
              </div>

              {/* Dominance */}
              {dominance.dominanceIndex !== null && (
                <div className="space-y-1.5 px-0.5">
                  <div className="flex justify-between items-center text-[8px] font-bold text-gray-500 uppercase tracking-tighter">
                    <span>Pressão Mandante</span><span className="text-[9px] text-gray-400">Momento do Jogo</span><span>Pressão Visitante</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex relative shadow-inner">
                    <div className={cn("h-full transition-all duration-700 relative", dominance.dominantTeam === 'home' && "bg-[#00F59B] shadow-[0_0_8px_rgba(0,245,155,0.4)]", dominance.dominantTeam === 'away' && "bg-[#FF3366] shadow-[0_0_8px_rgba(255,51,102,0.4)]", dominance.dominantTeam === 'balanced' && "bg-gray-500/30")} style={{ width: `${dominance.dominanceIndex}%` }} />
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              {fixtureCache?.normalized_stats && (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Posse', h: `${fixtureCache.normalized_stats.home.possession}%`, a: `${fixtureCache.normalized_stats.away.possession}%` },
                    { label: 'Chutes', h: fixtureCache.normalized_stats.home.shots_total, a: fixtureCache.normalized_stats.away.shots_total },
                    { label: 'No Gol', h: fixtureCache.normalized_stats.home.shots_on, a: fixtureCache.normalized_stats.away.shots_on },
                    { label: 'Escanteios', h: fixtureCache.normalized_stats.home.corners, a: fixtureCache.normalized_stats.away.corners }
                  ].map((m, idx) => (
                    <div key={idx} className="bg-white/5 rounded-md p-1.5 border border-white/5 text-center flex flex-col justify-center">
                      <span className="text-[7px] text-gray-500 font-bold uppercase mb-0.5">{m.label}</span>
                      <div className="flex items-center justify-center gap-1 text-[10px] font-black tracking-tight">
                        <span className="text-[#00F59B]">{m.h}</span><span className="text-gray-700">|</span><span className="text-[#FF3366]">{m.a}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleTrigger>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreVertical className="h-3.5 w-3.5 text-muted-foreground" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {game.api_fixture_id && <DropdownMenuItem onClick={() => setShowPreMatch(true)}><BarChart3 className="h-4 w-4 mr-2" />Análise pré-jogo</DropdownMenuItem>}
                {onEdit && <DropdownMenuItem onClick={() => onEdit(game)}><Settings className="h-4 w-4 mr-2" />Editar métodos</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => onDelete(game.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Remover</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-zinc-800">
                <ChevronRight className={cn("h-4 w-4 text-gray-500 transition-transform", isExpanded && "rotate-90")} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Methods Row */}
        {game.methodOperations.length > 0 && (
          <div className={cn("flex flex-wrap items-center gap-1.5 mt-2", compact ? "ml-14" : "ml-16")}>
            {[...game.methodOperations].sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0)).map((operation) => {
              const financialStatus = getFinancialStatus(operation);
              return (
                <span key={operation.methodId} className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5", operation.result === 'Green' ? "bg-emerald-500/20 text-emerald-400" : operation.result === 'Red' ? "bg-red-500/20 text-red-400" : operation.result === 'Void' ? "bg-amber-500/20 text-amber-400" : financialStatus.complete ? "bg-emerald-500/10 border border-emerald-500/30 text-muted-foreground" : "bg-muted text-muted-foreground")}>
                  {getMethodName(operation.methodId)}{financialStatus.hasOdd && <span className="opacity-80">@{operation.odd?.toFixed(2)}</span>}
                  {operation.result === 'Green' && <Check className="h-2.5 w-2.5" />}{operation.result === 'Red' && <X className="h-2.5 w-2.5" />}{operation.result === 'Void' && <Minus className="h-2.5 w-2.5" />}
                </span>
              );
            })}
          </div>
        )}

        {/* Notes */}
        <div className={cn("mt-2", compact ? "ml-14" : "ml-16")}>
          <Collapsible><CollapsibleTrigger className="text-[10px] text-gray-500 hover:text-gray-400 flex items-center gap-1"><FileText className="h-3 w-3" />{game.notes ? 'Ver observações' : 'Adicionar observação'}</CollapsibleTrigger><CollapsibleContent><div className="mt-1"><GameNotesEditor notes={game.notes} onSave={(notes) => onUpdate(game.id, { notes })} compact /></div></CollapsibleContent></Collapsible>
        </div>

        {/* AI Moment */}
        {!compact && isLive && aiMomentText && (
          <div className={cn("mt-2 mb-1 flex items-center gap-1.5 text-[10px] text-gray-400 italic", compact ? "ml-14" : "ml-16")}>
            <Sparkles className="h-3 w-3 text-emerald-500/60" />{aiMomentText}
          </div>
        )}
      </div>

      <CollapsibleContent>
        <div className="bg-muted/20 border-b border-border/30 p-3 space-y-3">
          {game.methodOperations.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Métodos</span>
              <div className="flex flex-wrap gap-2">
                {game.methodOperations.map((operation) => (
                  <div key={operation.methodId} className="flex items-center gap-1.5">
                    <div className="flex flex-col">
                      <span className={cn("text-[10px] px-2.5 py-1 rounded-full font-semibold", operation.result === 'Green' ? "bg-emerald-500 text-white" : operation.result === 'Red' ? "bg-red-500 text-white" : "bg-zinc-700 text-zinc-300")}>{getMethodName(operation.methodId)}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleResultClick(operation.methodId, 'Green')} className={cn("h-6 w-6 rounded-full flex items-center justify-center border", operation.result === 'Green' ? "bg-emerald-500 border-emerald-500" : "bg-zinc-800 border-emerald-500/50 text-emerald-500")}><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleResultClick(operation.methodId, 'Red')} className={cn("h-6 w-6 rounded-full flex items-center justify-center border", operation.result === 'Red' ? "bg-red-500 border-red-500" : "bg-zinc-800 border-red-500/50 text-red-500")}><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>

      {game.api_fixture_id && (
        <PreMatchModal
          open={showPreMatch}
          onOpenChange={setShowPreMatch}
          fixtureId={game.api_fixture_id}
          homeTeam={game.homeTeam}
          awayTeam={game.awayTeam}
        />
      )}
    </Collapsible>
  );
}
