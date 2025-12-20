import { Game, Method } from "@/types";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, Check, X, Trash2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamLogo } from "@/hooks/useTeamLogo";
import { useState, useEffect, useRef, useMemo } from "react";
import { ApiFootballEvent, ApiFootballFixture } from "@/hooks/useApiFootball";
import { AttackMomentum } from "@/components/LiveStats/AttackMomentum";

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
  onFetchDetails?: (fixtureId: number) => Promise<{ success: boolean; statistics?: any; events?: ApiFootballEvent[] }>;
  lastGlobalRefresh?: number;
}

export function GameCardCompact({ 
  game, 
  methods, 
  onUpdate, 
  onDelete, 
  onEdit,
  fixtureData,
  onFetchDetails,
  lastGlobalRefresh,
}: GameCardCompactProps) {
  const [localElapsed, setLocalElapsed] = useState<{ minutes: number; seconds: number } | null>(null);
  const lastSyncRef = useRef<number>(0);
  
  const { logoUrl: homeLogo } = useTeamLogo(game.homeTeam);
  const { logoUrl: awayLogo } = useTeamLogo(game.awayTeam);
  
  const homeTeamLogo = game.homeTeamLogo || homeLogo;
  const awayTeamLogo = game.awayTeamLogo || awayLogo;

  const fixtureStatus = fixtureData?.fixture?.fixture?.status?.short;
  const isLive = fixtureStatus ? ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(fixtureStatus) : game.status === 'Live';
  const isHalfTime = fixtureStatus === 'HT';
  const isExtraTime = fixtureStatus === 'ET';
  const isPenalty = fixtureStatus === 'P';
  
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

  const homeScore = fixtureData?.fixture?.goals?.home ?? '-';
  const awayScore = fixtureData?.fixture?.goals?.away ?? '-';
  const hasScore = fixtureData?.fixture?.goals?.home !== null;

  const handleResultClick = (methodId: string, result: 'Green' | 'Red') => {
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

  // Get goal events for display
  const homeGoals = fixtureData?.events?.filter(
    e => e.type === 'Goal' && e.team?.id === fixtureData?.fixture?.teams?.home?.id
  ) || [];
  const awayGoals = fixtureData?.events?.filter(
    e => e.type === 'Goal' && e.team?.id === fixtureData?.fixture?.teams?.away?.id
  ) || [];

  return (
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
                  {goal.player?.name} {goal.time?.elapsed}'{goal.detail === 'Penalty' ? ' (Pen.)' : ''}
                </div>
              ))}
            </div>
            <div className="flex-shrink-0">
              <Trophy className="h-3 w-3 text-muted-foreground/50" />
            </div>
            <div className="flex-1 text-left">
              {awayGoals.map((goal, i) => (
                <div key={i} className="text-[10px] text-muted-foreground">
                  {goal.player?.name} {goal.time?.elapsed}'{goal.detail === 'Penalty' ? ' (Pen.)' : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attack Momentum Chart - para jogos ao vivo com eventos OU estatísticas */}
        {isLive && fixtureData && (fixtureData.events?.length > 0 || fixtureData.statistics) && (
          <div className="mt-3 pt-2 border-t border-border/20">
            <AttackMomentum
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
              homeTeamId={fixtureData?.fixture?.teams?.home?.id}
              awayTeamId={fixtureData?.fixture?.teams?.away?.id}
              events={fixtureData.events}
              statistics={fixtureData.statistics}
              currentMinute={localElapsed?.minutes || apiElapsed || 0}
            />
          </div>
        )}

        {/* Footer: Date, League, Delete */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{game.date} • {game.time}</span>
            <span className="flex items-center gap-1">
              <Trophy className="h-2.5 w-2.5 text-primary" />
              {game.league}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete(game.id)}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
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
                  !operation.result && "bg-zinc-700 text-zinc-300"
                )}>
                  {getMethodName(operation.methodId)}
                  {operation.result === 'Green' && <Check className="h-3 w-3" />}
                  {operation.result === 'Red' && <X className="h-3 w-3" />}
                </span>
                
                {/* Always visible Green/Red buttons */}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
