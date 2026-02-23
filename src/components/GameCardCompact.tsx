import { Game, Method, GoalEvent } from "@/types";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, Check, X, Minus, Trash2, Trophy, Settings, Sparkles, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamLogo } from "@/hooks/useTeamLogo";
import { useState, useEffect, useRef, useMemo } from "react";
import { ApiFootballEvent, ApiFootballFixture } from "@/hooks/useApiFootball";
import { GameNotesEditor } from "@/components/GameNotesEditor";
import { MatchStatsOverview } from "@/components/MatchStatsOverview";
import { useFixtureCache } from "@/hooks/useFixtureCache";
import { useFixtureOdds } from "@/hooks/useFixtureOdds";
import { OddsDisplay } from "@/components/OddsDisplay";
import { useDominanceAnalysis } from "@/hooks/useDominanceAnalysis";
import { LiveDominanceDisplay } from "@/components/LiveDominanceDisplay";
import { useLdiHistory } from "@/hooks/useLdiHistory";
import { useLiveMomentAI } from "@/hooks/useLiveMomentAI";
import { PreMatchModal } from "@/components/PreMatchAnalysis/PreMatchModal";

interface FixtureData {
  fixture: ApiFootballFixture;
  statistics: any;
  events: ApiFootballEvent[];
}

interface GameCardCompactProps {
  game: Game;
  methods: Method[];
  onUpdate: (gameId: string, updates: Partial<Game>) => void;
  onDelete: (gameId: string) => void;
  onEdit?: (game: Game) => void;
  fixtureData?: FixtureData | null;
  lastGlobalRefresh?: number;
  globalPaused?: boolean;
}

export function GameCardCompact({ 
  game, 
  methods, 
  onUpdate, 
  onDelete, 
  onEdit,
  fixtureData,
  lastGlobalRefresh,
  globalPaused = false,
}: GameCardCompactProps) {
  const [localElapsed, setLocalElapsed] = useState<{ minutes: number; seconds: number } | null>(null);
  const [showPreMatch, setShowPreMatch] = useState(false);
  const lastSyncRef = useRef<number>(0);
  
  const { logoUrl: homeLogo } = useTeamLogo(game.homeTeam);
  const { logoUrl: awayLogo } = useTeamLogo(game.awayTeam);
  
  const homeTeamLogo = game.homeTeamLogo || homeLogo;
  const awayTeamLogo = game.awayTeamLogo || awayLogo;

  // Fetch cached stats: stop auto-fetch when all methods are resolved (Green/Red)
  const allMethodsResolved = game.methodOperations.length > 0 
    && game.methodOperations.every(op => op.result === 'Green' || op.result === 'Red' || op.result === 'Void');
  const isLiveForFetch = (game.status === 'Live' || game.status === 'Pending') && !allMethodsResolved;
  const { data: fixtureCache, loading: cacheLoading } = useFixtureCache(game.api_fixture_id, isLiveForFetch, globalPaused);
  const dominance = useDominanceAnalysis(fixtureCache);
  const ldiHistory = useLdiHistory(
    game.api_fixture_id ? Number(game.api_fixture_id) : undefined,
    fixtureCache?.minute_now,
    dominance.dominanceIndex
  );

  // Default empty stats for display when no cache data
  const emptyStats = {
    home: { possession: 0, shots_total: 0, shots_on: 0, shots_off: 0, shots_blocked: 0, corners: 0, fouls: 0, offsides: 0, yellow: 0, red: 0 },
    away: { possession: 0, shots_total: 0, shots_on: 0, shots_off: 0, shots_blocked: 0, corners: 0, fouls: 0, offsides: 0, yellow: 0, red: 0 }
  };

  // Fetch BTTS from API-Football
  const fixtureStatus = fixtureData?.fixture?.fixture?.status?.short;
  const isGameLive = fixtureStatus 
    ? ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(fixtureStatus) 
    : (game.status === 'Live' || game.status === 'Pending');
  
  const { preMatch: oddsData, loading: oddsLoading, refetch: refetchOdds, lastUpdate: oddsLastUpdate } = useFixtureOdds(
    game.api_fixture_id,
    isGameLive
  );

  const isLive = isGameLive;
  const isHalfTime = fixtureStatus === 'HT';
  const isExtraTime = fixtureStatus === 'ET';
  const isPenalty = fixtureStatus === 'P';
  
  // Check if bookmaker is Betfair
  const isBetfair = oddsData?.bookmakerId ? [6, 15].includes(oddsData.bookmakerId) : false;
  
  const apiElapsed = fixtureData?.fixture?.fixture?.status?.elapsed;
  
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

  // Use API fixture data for live games, fallback to persisted final scores for finished games
  const apiHomeScore = fixtureData?.fixture?.goals?.home;
  const apiAwayScore = fixtureData?.fixture?.goals?.away;
  const persistedHomeScore = game.finalScoreHome;
  const persistedAwayScore = game.finalScoreAway;
  
  // AI moment text for live games
  const { text: aiMomentText } = useLiveMomentAI(
    game.status === 'Live',
    game.homeTeam,
    game.awayTeam,
    apiHomeScore ?? persistedHomeScore ?? null,
    apiAwayScore ?? persistedAwayScore ?? null,
    dominance,
    fixtureCache,
    ldiHistory
  );
  
  // Priority: API data > persisted scores
  const homeScore = apiHomeScore ?? persistedHomeScore ?? '-';
  const awayScore = apiAwayScore ?? persistedAwayScore ?? '-';
  const hasScore = apiHomeScore !== null && apiHomeScore !== undefined || 
                   persistedHomeScore !== null && persistedHomeScore !== undefined;

  const handleResultClick = (methodId: string, result: 'Green' | 'Red' | 'Void') => {
    const updatedOperations = game.methodOperations.map(op =>
      op.methodId === methodId ? { ...op, result } : op
    );
    onUpdate(game.id, { methodOperations: updatedOperations });
  };

  const getStatusBadge = () => {
    if (isHalfTime) {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-black px-1.5 py-0.5 rounded bg-amber-500">
          <span className="h-1 w-1 rounded-full bg-black" />
          INT
        </span>
      );
    }
    if (isExtraTime) {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-black px-1.5 py-0.5 rounded bg-orange-500">
          <span className="h-1 w-1 rounded-full bg-black animate-pulse" />
          PRR
        </span>
      );
    }
    if (isPenalty) {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white px-1.5 py-0.5 rounded bg-purple-500">
          <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
          PEN
        </span>
      );
    }
    if (isLive) {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-black px-1.5 py-0.5 rounded bg-primary">
          <span className="h-1 w-1 rounded-full bg-black animate-pulse" />
          {localElapsed 
            ? `${localElapsed.minutes}'`
            : 'LIVE'
          }
        </span>
      );
    }
    return null;
  };

  // Get goal events for display - use API events if available, fallback to persisted goalEvents
  const { homeGoals, awayGoals } = useMemo(() => {
    const homeTeamId = fixtureData?.fixture?.teams?.home?.id;
    const awayTeamId = fixtureData?.fixture?.teams?.away?.id;
    
    // If we have live API events, use them
    if (fixtureData?.events?.length) {
      return {
        homeGoals: fixtureData.events
          .filter(e => e.type === 'Goal' && e.team?.id === homeTeamId)
          .map(e => ({
            teamId: e.team?.id || 0,
            playerName: e.player?.name || '',
            minute: e.time?.elapsed || 0,
            detail: e.detail,
          })),
        awayGoals: fixtureData.events
          .filter(e => e.type === 'Goal' && e.team?.id === awayTeamId)
          .map(e => ({
            teamId: e.team?.id || 0,
            playerName: e.player?.name || '',
            minute: e.time?.elapsed || 0,
            detail: e.detail,
          })),
      };
    }
    
    // Fallback to persisted goalEvents from database
    if (game.goalEvents?.length) {
      // For persisted events, we need to match team by position since we have teamId
      // The first team in persisted events with most goals is likely home
      const homeEvents = game.goalEvents.filter(e => {
        // If we have fixture data with team IDs, use those
        if (homeTeamId) return e.teamId === homeTeamId;
        // Otherwise we stored teamId as the API team ID, just split by that
        return true; // We'll handle this case differently below
      });
      
      // If we have team IDs from fixture, use them
      if (homeTeamId && awayTeamId) {
        return {
          homeGoals: game.goalEvents.filter(e => e.teamId === homeTeamId),
          awayGoals: game.goalEvents.filter(e => e.teamId === awayTeamId),
        };
      }
      
      // If no fixture data, use persisted as-is (we stored teamId correctly)
      // We'll need to infer home/away from scores if available
      const homeScore = game.finalScoreHome ?? 0;
      const awayScore = game.finalScoreAway ?? 0;
      
      // Group by teamId
      const byTeam = game.goalEvents.reduce((acc, e) => {
        if (!acc[e.teamId]) acc[e.teamId] = [];
        acc[e.teamId].push(e);
        return acc;
      }, {} as Record<number, GoalEvent[]>);
      
      const teamIds = Object.keys(byTeam).map(Number);
      if (teamIds.length === 2) {
        // Match by goal count
        const [team1, team2] = teamIds;
        const team1Goals = byTeam[team1].length;
        const team2Goals = byTeam[team2].length;
        
        if (team1Goals === homeScore && team2Goals === awayScore) {
          return { homeGoals: byTeam[team1], awayGoals: byTeam[team2] };
        } else if (team2Goals === homeScore && team1Goals === awayScore) {
          return { homeGoals: byTeam[team2], awayGoals: byTeam[team1] };
        }
      }
      
      // Fallback: first teamId = home
      if (teamIds.length >= 1) {
        return {
          homeGoals: byTeam[teamIds[0]] || [],
          awayGoals: teamIds.length > 1 ? byTeam[teamIds[1]] : [],
        };
      }
    }
    
    return { homeGoals: [], awayGoals: [] };
  }, [fixtureData?.events, fixtureData?.fixture?.teams, game.goalEvents, game.finalScoreHome, game.finalScoreAway]);

  return (
    <>
    <Card className={cn(
      "overflow-hidden transition-all duration-200",
      isLive ? "border-primary/50 shadow-glow" : "border-border/40 hover:border-primary/30"
    )}>
      <div className={cn(
        "p-4",
        isLive && "bg-gradient-neon-subtle"
      )}>
        {/* Main row: Home - Score - Away */}
        <div className="flex items-center justify-between gap-3">
          {/* Home Team */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-semibold truncate text-foreground">
              {game.homeTeam}
            </span>
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={homeTeamLogo} alt={game.homeTeam} />
              <AvatarFallback className="text-[10px] bg-secondary">
                <Shield className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Score + Time */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums text-foreground">{hasScore ? homeScore : '-'}</span>
              <span className="text-muted-foreground text-lg">-</span>
              <span className="text-2xl font-bold tabular-nums text-foreground">{hasScore ? awayScore : '-'}</span>
            </div>
            {isLive && localElapsed ? (
              <span className={cn(
                "text-xs font-medium mt-0.5",
                isHalfTime ? "text-amber-500" : "text-primary"
              )}>
                {isHalfTime ? 'Intervalo' : `${localElapsed.minutes}:${String(localElapsed.seconds).padStart(2, '0')}`}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground mt-0.5">{game.time}</span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={awayTeamLogo} alt={game.awayTeam} />
              <AvatarFallback className="text-[10px] bg-secondary">
                <Shield className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold truncate text-right text-foreground">
              {game.awayTeam}
            </span>
          </div>
        </div>

        {/* Goal scorers */}
        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <div className="flex justify-between gap-4 mt-2 pt-2 border-t border-border/20">
            <div className="flex-1 text-right">
              {homeGoals.map((goal, i) => (
                <div key={i} className="text-[10px] text-muted-foreground">
                  {goal.playerName} {goal.minute}'{goal.detail === 'Penalty' ? ' (Pen.)' : ''}
                </div>
              ))}
            </div>
            <div className="flex-shrink-0">
              <Trophy className="h-3 w-3 text-muted-foreground/50" />
            </div>
            <div className="flex-1 text-left">
              {awayGoals.map((goal, i) => (
                <div key={i} className="text-[10px] text-muted-foreground">
                  {goal.playerName} {goal.minute}'{goal.detail === 'Penalty' ? ' (Pen.)' : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Dominance Display + AI Moment */}
        {isLive && game.api_fixture_id && (
          <div className="mt-3 pt-2 border-t border-border/20 space-y-1.5">
            <LiveDominanceDisplay 
              result={dominance} 
              homeTeam={game.homeTeam} 
              awayTeam={game.awayTeam} 
              ldiHistory={ldiHistory}
              normalizedStats={fixtureCache?.normalized_stats}
            />
            {aiMomentText && (
              <div className="flex items-start gap-1 px-2 py-1 rounded bg-muted/50">
                <Sparkles className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-[10px] sm:text-[11px] text-muted-foreground italic leading-tight">{aiMomentText}</span>
              </div>
            )}
          </div>
        )}

        {/* Stats Overview - Always visible */}
        <div className="mt-3 pt-2 border-t border-border/20">
          <MatchStatsOverview 
            stats={fixtureCache?.normalized_stats || emptyStats} 
            loading={cacheLoading}
          />
        </div>

        {/* Odds Section - Match Odds + BTTS from API-Football */}
        {game.api_fixture_id && (
          <div className="mt-3 pt-2 border-t border-border/20">
            <OddsDisplay 
              matchOdds={oddsData?.matchOdds}
              btts={oddsData?.btts}
              bookmaker={oddsData?.bookmaker}
              isBetfair={isBetfair}
              onRefetch={refetchOdds}
              loading={oddsLoading}
              lastUpdate={oddsLastUpdate}
            />
          </div>
        )}

        {/* Notes section */}
        <div className="mt-2 pt-2 border-t border-border/20">
          <GameNotesEditor
            notes={game.notes}
            onSave={(notes) => onUpdate(game.id, { notes })}
            compact
          />
        </div>

        {/* Footer: Date, League, Actions */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{game.date} • {game.time}</span>
            <span className="flex items-center gap-1">
              <Trophy className="h-2.5 w-2.5 text-primary" />
              {game.league}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {game.api_fixture_id && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowPreMatch(true)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                title="Análise pré-jogo"
              >
                <BarChart3 className="h-3 w-3" />
              </Button>
            )}
            {onEdit && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onEdit(game)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                title="Editar métodos"
              >
                <Settings className="h-3 w-3" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onDelete(game.id)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              title="Remover jogo"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Methods as Pills with Always Visible Buttons */}
        {game.methodOperations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/30">
            {game.methodOperations.map((operation) => (
              <div key={operation.methodId} className="flex items-center gap-1.5">
                {/* Method name pill */}
                <span className={cn(
                  "text-[10px] px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1",
                  operation.result === 'Green' && "bg-emerald-500 text-white shadow-sm shadow-emerald-500/50",
                  operation.result === 'Red' && "bg-red-500 text-white shadow-sm shadow-red-500/50",
                  operation.result === 'Void' && "bg-amber-500 text-white shadow-sm shadow-amber-500/50",
                  !operation.result && "bg-zinc-700 text-zinc-300"
                )}>
                  {getMethodName(operation.methodId)}
                  {operation.result === 'Green' && <Check className="h-3 w-3" />}
                  {operation.result === 'Red' && <X className="h-3 w-3" />}
                  {operation.result === 'Void' && <Minus className="h-3 w-3" />}
                </span>
                
                {/* Always visible Green/Red/Void buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleResultClick(operation.methodId, 'Green')}
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center transition-all",
                      operation.result === 'Green' 
                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/50" 
                        : "bg-zinc-800 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/50"
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleResultClick(operation.methodId, 'Red')}
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center transition-all",
                      operation.result === 'Red' 
                        ? "bg-red-500 text-white shadow-sm shadow-red-500/50" 
                        : "bg-zinc-800 text-red-500 hover:bg-red-500/20 border border-red-500/50"
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleResultClick(operation.methodId, 'Void')}
                    className={cn(
                      "h-5 w-5 rounded-full flex items-center justify-center transition-all",
                      operation.result === 'Void' 
                        ? "bg-amber-500 text-white shadow-sm shadow-amber-500/50" 
                        : "bg-zinc-800 text-amber-500 hover:bg-amber-500/20 border border-amber-500/50"
                    )}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>

    {game.api_fixture_id && (
      <PreMatchModal
        open={showPreMatch}
        onOpenChange={setShowPreMatch}
        fixtureId={game.api_fixture_id}
        homeTeam={game.homeTeam}
        awayTeam={game.awayTeam}
      />
    )}
    </>
  );
}
