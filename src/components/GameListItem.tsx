import { Game, Method } from "@/types";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, Check, X, ChevronRight, Settings, Trash2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamLogo } from "@/hooks/useTeamLogo";
import { useState, useEffect, useRef, useMemo } from "react";
import { GameNotesEditor } from "@/components/GameNotesEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LiveScore {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  status: string;
  statusLong: string;
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
}: GameListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localElapsed, setLocalElapsed] = useState<{ minutes: number; seconds: number } | null>(null);
  const lastSyncRef = useRef<number>(0);
  
  const { logoUrl: homeLogo } = useTeamLogo(game.homeTeam);
  const { logoUrl: awayLogo } = useTeamLogo(game.awayTeam);
  
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

  // Use live score data if available, fallback to game data
  const homeScore = liveScore?.homeScore ?? game.finalScoreHome ?? null;
  const awayScore = liveScore?.awayScore ?? game.finalScoreAway ?? null;
  const hasScore = homeScore !== null;

  const handleResultClick = (methodId: string, result: 'Green' | 'Red') => {
    const updatedOperations = game.methodOperations.map(op =>
      op.methodId === methodId ? { ...op, result } : op
    );
    onUpdate(game.id, { methodOperations: updatedOperations });
  };

  // Format status/time display
  const getStatusDisplay = () => {
    if (isHalfTime) {
      return { text: 'INT', subText: '45\'', color: 'text-amber-500' };
    }
    if (isExtraTime) {
      return { text: 'PRR', subText: localElapsed ? `${localElapsed.minutes}'` : '', color: 'text-orange-500' };
    }
    if (isPenalty) {
      return { text: 'PEN', subText: '', color: 'text-purple-500' };
    }
    if (isLive && localElapsed) {
      const period = localElapsed.minutes <= 45 ? '1T' : '2T';
      return { text: period, subText: `${localElapsed.minutes}'`, color: 'text-primary' };
    }
    if (isFinished) {
      return { text: 'FIM', subText: '', color: 'text-muted-foreground' };
    }
    return { text: game.time, subText: '', color: 'text-muted-foreground' };
  };

  const status = getStatusDisplay();

  // Calculate method results summary
  const methodsSummary = useMemo(() => {
    const greens = game.methodOperations.filter(op => op.result === 'Green').length;
    const reds = game.methodOperations.filter(op => op.result === 'Red').length;
    const pending = game.methodOperations.filter(op => !op.result).length;
    return { greens, reds, pending };
  }, [game.methodOperations]);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      {/* Main Row */}
      <div className={cn(
        "border-b border-border/30 hover:bg-muted/30 transition-colors",
        isLive && "bg-primary/5",
        isHighlighted && "goal-highlight"
      )}>
        <div className="flex items-stretch">
          {/* Status Column */}
          <div className={cn(
            "w-12 sm:w-14 flex-shrink-0 flex flex-col items-center justify-center py-2 border-r border-border/30",
            status.color
          )}>
            <span className="text-[10px] sm:text-xs font-bold">{status.text}</span>
            {status.subText && (
              <span className="text-[9px] sm:text-[10px]">{status.subText}</span>
            )}
          </div>

          {/* Teams + Score Column */}
          <CollapsibleTrigger asChild>
            <div className="flex-1 py-2 px-2 sm:px-3 cursor-pointer min-w-0 max-w-md">
              {/* Home Team Row */}
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <Avatar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0">
                  <AvatarImage src={homeTeamLogo} alt={game.homeTeam} />
                  <AvatarFallback className="text-[6px] sm:text-[8px] bg-secondary">
                    <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs sm:text-sm flex-1 truncate">{game.homeTeam}</span>
                <span className={cn(
                  "text-xs sm:text-sm font-bold w-5 sm:w-6 text-right tabular-nums flex-shrink-0",
                  isLive && "text-foreground",
                  !hasScore && "text-muted-foreground"
                )}>
                  {hasScore ? homeScore : '-'}
                </span>
              </div>
              
              {/* Away Team Row */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Avatar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0">
                  <AvatarImage src={awayTeamLogo} alt={game.awayTeam} />
                  <AvatarFallback className="text-[6px] sm:text-[8px] bg-secondary">
                    <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs sm:text-sm flex-1 truncate">{game.awayTeam}</span>
                <span className={cn(
                  "text-xs sm:text-sm font-bold w-5 sm:w-6 text-right tabular-nums flex-shrink-0",
                  isLive && "text-foreground",
                  !hasScore && "text-muted-foreground"
                )}>
                  {hasScore ? awayScore : '-'}
                </span>
              </div>
            </div>
          </CollapsibleTrigger>

          {/* Actions Column */}
          <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 flex-shrink-0 border-l border-border/30">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-0">
                  <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(game)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Editar métodos
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => onDelete(game.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-0">
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground transition-transform",
                  isExpanded && "rotate-90"
                )} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        
        {/* Methods pills row - always visible below teams */}
        {game.methodOperations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-2 sm:px-3 pb-2 ml-12 sm:ml-14">
            {game.methodOperations.map((operation) => (
              <span
                key={operation.methodId}
                className={cn(
                  "text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5",
                  operation.result === 'Green' && "bg-emerald-500/20 text-emerald-400",
                  operation.result === 'Red' && "bg-red-500/20 text-red-400",
                  !operation.result && "bg-muted text-muted-foreground"
                )}
              >
                {getMethodName(operation.methodId)}
                {operation.result === 'Green' && <Check className="h-2.5 w-2.5" />}
                {operation.result === 'Red' && <X className="h-2.5 w-2.5" />}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      <CollapsibleContent>
        <div className="bg-muted/20 border-b border-border/30 p-3 space-y-3">
          {/* Methods with Green/Red buttons */}
          {game.methodOperations.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Métodos</span>
              <div className="flex flex-wrap gap-2">
                {game.methodOperations.map((operation) => (
                  <div key={operation.methodId} className="flex items-center gap-1.5">
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
            </div>
          )}

          {/* Notes */}
          <GameNotesEditor
            notes={game.notes}
            onSave={(notes) => onUpdate(game.id, { notes })}
            compact
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
