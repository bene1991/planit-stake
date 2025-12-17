import { Game, Method } from "@/types";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, Check, X, Trash2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamLogo } from "@/hooks/useTeamLogo";
import { useState, useEffect, useRef } from "react";
import { ApiFootballEvent, ApiFootballFixture } from "@/hooks/useApiFootball";

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
  const [showActions, setShowActions] = useState<string | null>(null);
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
    setShowActions(null);
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

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200",
      isLive ? "border-primary/50 shadow-glow" : "border-border/40 hover:border-primary/30"
    )}>
      <div className={cn(
        "p-2.5",
        isLive && "bg-gradient-neon-subtle"
      )}>
        {/* Row 1: League + Status + Delete */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-2.5 w-2.5 text-primary" />
            <span className="text-[9px] uppercase text-muted-foreground font-bold truncate max-w-[100px]">
              {game.league}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {getStatusBadge()}
            {!hasScore && (
              <span className="text-[9px] text-muted-foreground font-medium">
                {game.time}
              </span>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onDelete(game.id)}
              className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>

        {/* Row 2: Teams + Score (horizontal) */}
        <div className="flex items-center justify-between gap-2">
          {/* Home */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarImage src={homeTeamLogo} alt={game.homeTeam} />
              <AvatarFallback className="text-[8px] bg-secondary">
                <Shield className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] font-medium truncate">
              {game.homeTeam}
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-1.5 flex-shrink-0 px-2">
            <span className="text-lg font-bold tabular-nums">{hasScore ? homeScore : '-'}</span>
            <span className="text-muted-foreground text-sm">-</span>
            <span className="text-lg font-bold tabular-nums">{hasScore ? awayScore : '-'}</span>
          </div>

          {/* Away */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <span className="text-[11px] font-medium truncate text-right">
              {game.awayTeam}
            </span>
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarImage src={awayTeamLogo} alt={game.awayTeam} />
              <AvatarFallback className="text-[8px] bg-secondary">
                <Shield className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Row 3: Methods as Pills */}
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/30">
          {game.methodOperations.map((operation) => {
            const isActive = showActions === operation.methodId;
            
            return (
              <div key={operation.methodId} className="relative">
                <button
                  onClick={() => setShowActions(isActive ? null : operation.methodId)}
                  className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full font-medium transition-all",
                    operation.result === 'Green' && "bg-primary/20 text-primary",
                    operation.result === 'Red' && "bg-destructive/20 text-destructive",
                    !operation.result && "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {getMethodName(operation.methodId)}
                  {operation.result === 'Green' && ' ✓'}
                  {operation.result === 'Red' && ' ✗'}
                  {!operation.result && ' ○'}
                </button>
                
                {/* Dropdown Actions */}
                {isActive && (
                  <div className="absolute top-full left-0 mt-1 z-10 flex gap-1 bg-background border border-border rounded-lg p-1 shadow-lg">
                    <Button
                      size="sm"
                      variant={operation.result === 'Green' ? "default" : "outline"}
                      onClick={() => handleResultClick(operation.methodId, 'Green')}
                      className={cn(
                        "h-5 px-1.5 text-[9px]",
                        operation.result === 'Green' 
                          ? "bg-primary text-primary-foreground" 
                          : "text-primary border-primary/30 hover:bg-primary/20"
                      )}
                    >
                      <Check className="h-2.5 w-2.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant={operation.result === 'Red' ? "destructive" : "outline"}
                      onClick={() => handleResultClick(operation.methodId, 'Red')}
                      className={cn(
                        "h-5 px-1.5 text-[9px]",
                        operation.result === 'Red' 
                          ? "" 
                          : "text-destructive border-destructive/30 hover:bg-destructive/20"
                      )}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
