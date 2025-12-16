import { Game, Method } from "@/types";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, Check, X, Trash2, Calendar, Trophy, MapPin } from "lucide-react";
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
  // Local elapsed time with seconds (auto-incrementing)
  const [localElapsed, setLocalElapsed] = useState<{ minutes: number; seconds: number } | null>(null);
  
  // Ref para rastrear última sincronização do tempo (evitar rollback)
  const lastSyncRef = useRef<number>(0);
  
  const { logoUrl: homeLogo } = useTeamLogo(game.homeTeam);
  const { logoUrl: awayLogo } = useTeamLogo(game.awayTeam);
  
  const homeTeamLogo = game.homeTeamLogo || homeLogo;
  const awayTeamLogo = game.awayTeamLogo || awayLogo;

  // Determine if game is live from fixture data or game status
  const fixtureStatus = fixtureData?.fixture?.fixture?.status?.short;
  const isLive = fixtureStatus ? ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(fixtureStatus) : game.status === 'Live';
  
  // Get elapsed from API
  const apiElapsed = fixtureData?.fixture?.fixture?.status?.elapsed;
  
  // Sync local elapsed with API elapsed (only when global refresh happens)
  useEffect(() => {
    if (apiElapsed && isLive && lastGlobalRefresh) {
      // Só sincroniza se lastGlobalRefresh mudou (indica novo refresh global)
      if (lastGlobalRefresh > lastSyncRef.current) {
        console.log(`[GameCardCompact] Syncing elapsed: ${apiElapsed} (global refresh: ${lastGlobalRefresh})`);
        setLocalElapsed({ minutes: apiElapsed, seconds: 0 });
        lastSyncRef.current = lastGlobalRefresh;
      }
    }
  }, [apiElapsed, isLive, lastGlobalRefresh]);
  
  // Inicializar localElapsed na primeira vez
  useEffect(() => {
    if (apiElapsed && isLive && !localElapsed) {
      setLocalElapsed({ minutes: apiElapsed, seconds: 0 });
    }
  }, [apiElapsed, isLive, localElapsed]);
  
  // Auto-increment elapsed every second while live
  useEffect(() => {
    if (!isLive || !localElapsed) return;
    
    // Don't increment during halftime
    if (fixtureStatus === 'HT') return;
    
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
  }, [isLive, localElapsed, fixtureStatus]);
  
  const greenCount = game.methodOperations.filter(op => op.result === 'Green').length;
  const redCount = game.methodOperations.filter(op => op.result === 'Red').length;
  const pendingCount = game.methodOperations.filter(op => !op.result).length;

  const getMethodName = (methodId: string) => {
    return methods.find(m => m.id === methodId)?.name || 'Método';
  };

  // Get score from fixture data
  const homeScore = fixtureData?.fixture?.goals?.home ?? '-';
  const awayScore = fixtureData?.fixture?.goals?.away ?? '-';
  const hasScore = fixtureData?.fixture?.goals?.home !== null;

  // Get goal events
  const goalEvents = fixtureData?.events?.filter(e => e.type === 'Goal') || [];
  const homeGoals = goalEvents.filter(e => e.team.id === fixtureData?.fixture?.teams?.home?.id);
  const awayGoals = goalEvents.filter(e => e.team.id === fixtureData?.fixture?.teams?.away?.id);

  // Get venue info
  const venue = fixtureData?.fixture?.fixture?.venue?.name;

  const handleResultClick = (methodId: string, result: 'Green' | 'Red') => {
    const updatedOperations = game.methodOperations.map(op =>
      op.methodId === methodId ? { ...op, result } : op
    );
    onUpdate(game.id, { methodOperations: updatedOperations });
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      isLive ? "border-primary/50 shadow-glow" : "border-border/40 hover:border-primary/30"
    )}>
      <div className={cn(
        "p-4",
        isLive && "bg-gradient-neon-subtle"
      )}>
        {/* Header: League + Delete */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-3 w-3 text-primary" />
            <p className="text-[10px] uppercase text-muted-foreground font-bold truncate">
              {game.league}
            </p>
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

        {/* Main Score Section - ScoreTabs Style */}
        <div className="flex items-center justify-center gap-4 my-4">
          {/* Home Team */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <Avatar className="h-14 w-14">
              <AvatarImage src={homeTeamLogo} alt={game.homeTeam} />
              <AvatarFallback className="text-xs bg-secondary">
                <Shield className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-center leading-tight max-w-[80px] truncate">
              {game.homeTeam}
            </span>
          </div>

          {/* Score / Time */}
          <div className="flex flex-col items-center">
            {hasScore ? (
              <>
                <span className="text-4xl font-bold tracking-tight">
                  {homeScore} - {awayScore}
                </span>
                {isLive && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-black px-2 py-0.5 rounded bg-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
                      {localElapsed 
                        ? `${localElapsed.minutes}:${localElapsed.seconds.toString().padStart(2, '0')}`
                        : fixtureStatus === 'HT' 
                          ? 'HT'
                          : 'LIVE'
                      }
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="text-2xl font-bold">{game.time}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(game.date + "T00:00:00").toLocaleDateString("pt-BR", { 
                    day: '2-digit', 
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </span>
              </>
            )}
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <Avatar className="h-14 w-14">
              <AvatarImage src={awayTeamLogo} alt={game.awayTeam} />
              <AvatarFallback className="text-xs bg-secondary">
                <Shield className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-center leading-tight max-w-[80px] truncate">
              {game.awayTeam}
            </span>
          </div>
        </div>

        {/* Goal Scorers */}
        {goalEvents.length > 0 && (
          <div className="flex justify-center gap-6 text-[10px] text-muted-foreground mb-3">
            <div className="text-right flex-1">
              {homeGoals.map((goal, i) => (
                <div key={i} className="truncate">
                  ⚽ {goal.player.name} {goal.time.elapsed}'
                  {goal.detail === 'Penalty' && ' (Pen.)'}
                  {goal.detail === 'Own Goal' && ' (OG)'}
                </div>
              ))}
            </div>
            <div className="text-left flex-1">
              {awayGoals.map((goal, i) => (
                <div key={i} className="truncate">
                  ⚽ {goal.player.name} {goal.time.elapsed}'
                  {goal.detail === 'Penalty' && ' (Pen.)'}
                  {goal.detail === 'Own Goal' && ' (OG)'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game Info Line */}
        <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground border-t border-border/30 pt-3 mb-3">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              {new Date(game.date + "T00:00:00").toLocaleDateString("pt-BR", { 
                day: '2-digit', 
                month: '2-digit' 
              })} • {game.time}
            </span>
          </div>
          {venue && (
            <>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{venue}</span>
              </div>
            </>
          )}
        </div>

        {/* Methods Summary Badge */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {greenCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-1 rounded bg-primary/20 text-primary">
              {greenCount} Green
            </span>
          )}
          {redCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-1 rounded bg-destructive/20 text-destructive">
              {redCount} Red
            </span>
          )}
          {pendingCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-1 rounded bg-muted text-muted-foreground">
              {pendingCount} Pendente
            </span>
          )}
        </div>

        {/* Methods List with Buttons - Always show Green/Red buttons to allow editing */}
        <div className="space-y-2 border-t border-border/30 pt-3">
          {game.methodOperations.map((operation) => (
            <div 
              key={operation.methodId} 
              className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
            >
              <span className="text-xs font-medium">{getMethodName(operation.methodId)}</span>
              
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={operation.result === 'Green' ? "default" : "outline"}
                  onClick={() => handleResultClick(operation.methodId, 'Green')}
                  className={cn(
                    "h-6 px-2 text-[10px]",
                    operation.result === 'Green' 
                      ? "bg-primary text-primary-foreground" 
                      : "text-primary border-primary/30 hover:bg-primary/20"
                  )}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Green
                </Button>
                <Button
                  size="sm"
                  variant={operation.result === 'Red' ? "destructive" : "outline"}
                  onClick={() => handleResultClick(operation.methodId, 'Red')}
                  className={cn(
                    "h-6 px-2 text-[10px]",
                    operation.result === 'Red' 
                      ? "" 
                      : "text-destructive border-destructive/30 hover:bg-destructive/20"
                  )}
                >
                  <X className="h-3 w-3 mr-1" />
                  Red
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}