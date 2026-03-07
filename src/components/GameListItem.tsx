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
import { LiveMatchGraphics } from "@/components/LiveMatchGraphics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PreMatchModal } from "@/components/PreMatchAnalysis/PreMatchModal";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
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
    if (!isLive || isHalfTime) return;

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
  }, [isLive, isHalfTime]);

  const getMethodName = (methodId: string) => {
    const method = methods.find(m => m.id === methodId);
    if (method) return method.name;
    const shortId = methodId?.substring(0, 4) || '????';
    return `Método (${shortId}...)`;
  };

  const getFinancialStatus = (op: { odd?: number; stakeValue?: number }) => {
    const hasOdd = op.odd && op.odd > 0;
    const hasStake = op.stakeValue && op.stakeValue > 0;
    return { hasOdd, hasStake, complete: hasOdd && hasStake, partial: (hasOdd || hasStake) && !(hasOdd && hasStake) };
  };

  // Calculate scores prioritizing the most comprehensive data source
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

    // Fallback if we have a score but no event details yet
    const rawHome = liveScore?.homeScore ?? game.finalScoreHome ?? 0;
    const rawAway = liveScore?.awayScore ?? game.finalScoreAway ?? 0;

    if (rawHome > goals.homeGoals.length) {
      const missing = rawHome - goals.homeGoals.length;
      goals.homeGoals = [...goals.homeGoals, ...Array(missing).fill(0).map(() => ({ playerName: 'Gol...', minute: '??', detail: '' }))];
    }
    if (rawAway > goals.awayGoals.length) {
      const missing = rawAway - goals.awayGoals.length;
      goals.awayGoals = [...goals.awayGoals, ...Array(missing).fill(0).map(() => ({ playerName: 'Gol...', minute: '??', detail: '' }))];
    }

    return goals;
  }, [fixtureCache?.key_events, liveScore?.events, liveScore?.homeTeamId, liveScore?.awayTeamId, liveScore?.homeScore, liveScore?.awayScore, game.goalEvents, game.finalScoreHome, game.finalScoreAway]);

  const homeScore = homeGoals.length;
  const awayScore = awayGoals.length;
  const hasScore = liveScore?.homeScore !== undefined || game.finalScoreHome !== undefined;

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
        isHighlighted && "ring-2 ring-yellow-500 bg-yellow-500/10 z-20",
        compact || isMobile ? "py-2 px-3" : "py-4 px-4"
      )}
        onClick={() => onSelect?.()}
      >
        {isHighlighted && (
          <div className="absolute top-0 right-0 px-2 py-1 bg-yellow-500 border-b border-l border-yellow-600 rounded-bl-sm z-30 shadow-lg">
            <span className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> ÚLTIMO GOL
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5 w-full">
          {/* Top row: Country & League Flag */}
          {(game.country || game.league) && (
            <div className="flex items-center gap-2 px-1 py-0.5 mb-1 opacity-80 group-hover:opacity-100 transition-opacity">
              {game.leagueFlag && (
                <img src={game.leagueFlag} alt={game.country || game.league} className="h-3 w-auto rounded-[1px] shadow-sm border border-white/10" />
              )}
              <span className="text-[10px] font-bold text-muted-foreground/90 uppercase tracking-[0.15em] leading-none">
                {(() => {
                  const country = game.country;
                  const league = game.league;
                  if (!country) return league;
                  if (!league) return country;
                  if (league.toLowerCase().includes(country.toLowerCase())) return league;
                  return `${country} - ${league}`;
                })()}
              </span>
            </div>
          )}

          <div className="grid grid-cols-[45px_1fr_auto] items-start gap-2 w-full">
            <CollapsibleTrigger asChild>
              <div className="grid grid-cols-[45px_1fr] items-stretch gap-2 col-span-2 cursor-pointer min-w-0 w-full">
                {/* Left Column: Time / Status */}
                <div className="flex flex-col items-center justify-center border-r border-white/5 pr-2 py-1 min-h-[40px]">
                  {isLive || isFinished || isHalfTime || isPenalty || isExtraTime ? (
                    <>
                      <span className={cn("text-[10px] font-black uppercase tracking-tight text-center leading-none", status.color)}>
                        {status.text}
                      </span>
                      {status.subText && (
                        <span className={cn("text-[9px] font-bold text-center mt-0.5 leading-none", status.color === 'text-primary' ? 'text-primary' : `${status.color}/80`)}>
                          {status.subText}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground">{game.time}</span>
                  )}
                </div>

                {/* Center Column: Teams and Score */}
                <div className="flex flex-col justify-center py-1 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex-1 space-y-2 min-w-0">
                      {/* Home Team Section */}
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0">
                            <AvatarImage src={homeTeamLogo} alt={game.homeTeam} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-500 text-[8px]"><Shield className="h-2 w-2" /></AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] sm:text-sm font-medium text-gray-200 truncate">{game.homeTeam}</span>
                          {homeRedCards.length > 0 && <span className="text-red-500 font-bold text-[10px]">🟥</span>}
                        </div>
                        {/* Home Goals */}
                        {homeGoals.length > 0 && (
                          <div className="flex flex-col gap-0.5 pl-6 sm:pl-7 text-[9px] text-gray-400">
                            {homeGoals.map((g, i) => (
                              <span key={`h-g-${i}`} className="truncate flex items-center gap-1.5">
                                <span className="text-gray-500 text-[8px]">⚽</span>
                                <span className="text-gray-300">{g.playerName}</span>
                                <span className="text-emerald-500/60">({g.minute}')</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Away Team Section */}
                      <div className="flex flex-col gap-0.5 mt-1 border-t border-white/5 pt-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0">
                            <AvatarImage src={awayTeamLogo} alt={game.awayTeam} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-500 text-[8px]"><Shield className="h-2 w-2" /></AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] sm:text-sm font-medium text-gray-200 truncate">{game.awayTeam}</span>
                          {awayRedCards.length > 0 && <span className="text-red-500 font-bold text-[10px]">🟥</span>}
                        </div>
                        {/* Away Goals */}
                        {awayGoals.length > 0 && (
                          <div className="flex flex-col gap-0.5 pl-6 sm:pl-7 text-[9px] text-gray-400">
                            {awayGoals.map((g, i) => (
                              <span key={`a-g-${i}`} className="truncate flex items-center gap-1.5">
                                <span className="text-gray-500 text-[8px]">⚽</span>
                                <span className="text-gray-300">{g.playerName}</span>
                                <span className="text-emerald-500/60">({g.minute}')</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center shrink-0 ml-1">
                      <div className={cn(
                        "flex items-center gap-1 font-black tabular-nums bg-[#1A232E]/60 rounded border border-white/5 shadow-inner",
                        isMobile ? "text-base px-1.5 py-0.5" : "text-xl px-3 py-1.5"
                      )}>
                        <span className={cn("transition-colors", hasScore ? "text-emerald-500" : "text-emerald-500/30")}>{hasScore ? homeScore : '0'}</span>
                        <span className="text-gray-700 text-[10px]">:</span>
                        <span className={cn("transition-colors", hasScore ? "text-emerald-500" : "text-emerald-500/30")}>{hasScore ? awayScore : '0'}</span>
                      </div>
                    </div>
                  </div>

                  {isLive && (
                    <div className="w-full mt-3 pb-1">
                      <LiveMatchGraphics
                        dominance={dominance}
                        ldiHistory={ldiHistory}
                        momentumSeries={fixtureCache?.momentum_series}
                        stats={fixtureCache?.normalized_stats}
                        homeTeam={game.homeTeam}
                        awayTeam={game.awayTeam}
                        homeRedCards={homeRedCards.length}
                        awayRedCards={awayRedCards.length}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleTrigger>

            {/* Right Column: Actions */}
            <div className={cn(
              "flex flex-col items-center justify-center gap-1 transition-opacity",
              !isMobile && "opacity-0 group-hover:opacity-100"
            )}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-white/5">
                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {game.api_fixture_id && <DropdownMenuItem onClick={() => setShowPreMatch(true)}><BarChart3 className="h-4 w-4 mr-2" />Análise pré-jogo</DropdownMenuItem>}
                  {onEdit && <DropdownMenuItem onClick={() => onEdit(game)}><Settings className="h-4 w-4 mr-2" />Editar métodos</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => onDelete(game.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Remover</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-white/5">
                  <ChevronRight className={cn("h-3.5 w-3.5 text-gray-500 transition-transform", isExpanded && "rotate-90")} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Methods Row */}
          {game.methodOperations.length > 0 && (
            <div className={cn("flex flex-wrap items-center gap-1.5 mt-2", (compact || isMobile) ? "ml-0" : "ml-16")}>
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
          <div className={cn("mt-2", (compact || isMobile) ? "ml-0" : "ml-16")}>
            <Collapsible>
              <CollapsibleTrigger className="text-[10px] text-gray-500 hover:text-gray-400 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {game.notes ? 'Ver observações' : 'Adicionar observação'}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1">
                  <GameNotesEditor notes={game.notes} onSave={(notes) => onUpdate(game.id, { notes })} compact />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* AI Moment */}
          <div className={cn("mt-2 mb-1 flex items-center gap-1.5 text-[10px] text-gray-400 italic", (compact || isMobile) ? "ml-0" : "ml-16")}>
            <Sparkles className="h-3 w-3 text-emerald-500/60" />
            {aiMomentText}
          </div>
        </div>
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
                      <span
                        className={cn(
                          "text-[10px] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1",
                          operation.result === 'Green' ? "bg-emerald-500 text-white" : operation.result === 'Red' ? "bg-red-500 text-white" : "bg-zinc-700 text-zinc-300",
                          !methods.some(m => m.id === operation.methodId) && "ring-1 ring-amber-500/50"
                        )}
                        title={!methods.some(m => m.id === operation.methodId) ? "Método não encontrado" : undefined}
                      >
                        {!methods.some(m => m.id === operation.methodId) && <AlertCircle className="h-2.5 w-2.5 text-amber-500" />}
                        {getMethodName(operation.methodId)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleResultClick(operation.methodId, 'Green')} className={cn("h-6 w-6 rounded-full flex items-center justify-center border", operation.result === 'Green' ? "bg-emerald-500 border-emerald-500" : "bg-zinc-800 border-emerald-500/50 text-emerald-500")}>
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleResultClick(operation.methodId, 'Red')} className={cn("h-6 w-6 rounded-full flex items-center justify-center border", operation.result === 'Red' ? "bg-red-500 border-red-500" : "bg-zinc-800 border-red-500/50 text-red-500")}>
                        <X className="h-3.5 w-3.5" />
                      </button>
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
