import { Game, Method } from "@/types";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, Check, X, ChevronDown, Trash2, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamLogo } from "@/hooks/useTeamLogo";
import { useState } from "react";
import { LiveStatsInline } from "./LiveStatsInline";
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
}

export function GameCardCompact({ 
  game, 
  methods, 
  onUpdate, 
  onDelete, 
  onEdit,
  fixtureData,
  onFetchDetails,
}: GameCardCompactProps) {
  const [expanded, setExpanded] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [hasLoadedDetails, setHasLoadedDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { logoUrl: homeLogo } = useTeamLogo(game.homeTeam);
  const { logoUrl: awayLogo } = useTeamLogo(game.awayTeam);
  
  const homeTeamLogo = game.homeTeamLogo || homeLogo;
  const awayTeamLogo = game.awayTeamLogo || awayLogo;

  // Determine if game is live from fixture data or game status
  const fixtureStatus = fixtureData?.fixture?.fixture?.status?.short;
  const isLive = fixtureStatus ? ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(fixtureStatus) : game.status === 'Live';
  
  const greenCount = game.methodOperations.filter(op => op.result === 'Green').length;
  const redCount = game.methodOperations.filter(op => op.result === 'Red').length;
  const pendingCount = game.methodOperations.filter(op => !op.result).length;

  const getMethodName = (methodId: string) => {
    return methods.find(m => m.id === methodId)?.name || 'Método';
  };

  // Get score from fixture data
  const homeScore = fixtureData?.fixture?.goals?.home ?? '-';
  const awayScore = fixtureData?.fixture?.goals?.away ?? '-';
  const elapsed = fixtureData?.fixture?.fixture?.status?.elapsed;
  const hasScore = fixtureData?.fixture?.goals?.home !== null;

  const handleResultClick = (methodId: string, result: 'Green' | 'Red') => {
    const updatedOperations = game.methodOperations.map(op =>
      op.methodId === methodId ? { ...op, result } : op
    );
    onUpdate(game.id, { methodOperations: updatedOperations });
  };

  const handleFetchDetails = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!fixtureData?.fixture || !onFetchDetails) return;
    
    setLoadingDetails(true);
    try {
      await onFetchDetails(fixtureData.fixture.fixture.id);
      setHasLoadedDetails(true);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fixtureData?.fixture || !onFetchDetails) return;
    
    setIsRefreshing(true);
    try {
      await onFetchDetails(fixtureData.fixture.fixture.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const hasDetailedStats = fixtureData?.statistics || fixtureData?.events?.length > 0;

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      isLive ? "border-primary/50 shadow-glow" : "border-border/40 hover:border-primary/30",
      expanded && "col-span-full"
    )}>
      {/* Compact Header */}
      <div 
        className={cn(
          "p-3 cursor-pointer hover:bg-muted/30 transition-colors",
          isLive && "bg-gradient-neon-subtle"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between gap-2">
          {/* League & Live Badge */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <p className="text-[10px] uppercase text-muted-foreground font-bold truncate">
              {game.league}
            </p>
            {isLive && (
              <>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-black px-1.5 py-0.5 rounded bg-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
                  {elapsed ? `${elapsed}'` : 'LIVE'}
                </span>
                
                {/* Botão de refresh */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-5 w-5 p-0 text-primary hover:bg-primary/20"
                  title="Atualizar estatísticas"
                >
                  <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                </Button>
              </>
            )}
          </div>
          
          {/* Delete Button */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => { e.stopPropagation(); onDelete(game.id); }}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Teams Row */}
        <div className="flex items-center justify-between gap-2 mt-2">
          {/* Home Team */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarImage src={homeTeamLogo} alt={game.homeTeam} />
              <AvatarFallback className="text-[8px]">
                <Shield className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium truncate">{game.homeTeam}</span>
          </div>

          {/* Score / Time */}
          <div className="flex flex-col items-center px-2">
            {hasScore ? (
              <span className="text-sm font-bold">
                {homeScore} - {awayScore}
              </span>
            ) : isLive && !fixtureData ? (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Ao vivo
              </span>
            ) : (
              <>
                <span className="text-xs font-bold">{game.time}</span>
                <span className="text-[9px] text-muted-foreground">
                  {new Date(game.date + "T00:00:00").toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
                </span>
              </>
            )}
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-xs font-medium truncate text-right">{game.awayTeam}</span>
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarImage src={awayTeamLogo} alt={game.awayTeam} />
              <AvatarFallback className="text-[8px]">
                <Shield className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Methods Summary */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
          <div className="flex items-center gap-1.5">
            {greenCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                {greenCount}G
              </span>
            )}
            {redCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">
                {redCount}R
              </span>
            )}
            {pendingCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {pendingCount}P
              </span>
            )}
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )} />
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border/30">
          {/* On-demand Stats Button - Only show for live games */}
          {isLive && fixtureData?.fixture && !hasDetailedStats && (
            <div className="p-3 border-b border-border/30 bg-muted/20">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchDetails}
                disabled={loadingDetails}
                className="w-full h-8 text-xs"
              >
                {loadingDetails ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : (
                  <BarChart3 className="h-3 w-3 mr-2" />
                )}
                Ver Estatísticas (+2 req)
              </Button>
            </div>
          )}

          {/* Live Stats - Only show if we have detailed stats */}
          {isLive && hasDetailedStats && (
            <LiveStatsInline 
              fixture={fixtureData?.fixture || null}
              statistics={fixtureData?.statistics}
              events={fixtureData?.events || []}
              loading={loadingDetails}
            />
          )}

          {/* Methods List */}
          <div className="p-3 space-y-2">
            {game.methodOperations.map((operation) => (
              <div 
                key={operation.methodId} 
                className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
              >
                <span className="text-xs font-medium">{getMethodName(operation.methodId)}</span>
                
                {operation.result ? (
                  <span className={cn(
                    "text-xs font-bold px-2 py-1 rounded",
                    operation.result === 'Green' ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
                  )}>
                    {operation.result === 'Green' ? <Check className="h-3 w-3 inline mr-1" /> : <X className="h-3 w-3 inline mr-1" />}
                    {operation.result.toUpperCase()}
                  </span>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResultClick(operation.methodId, 'Green')}
                      className="h-6 px-2 text-[10px] text-primary border-primary/30 hover:bg-primary/20"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Green
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResultClick(operation.methodId, 'Red')}
                      className="h-6 px-2 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/20"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Red
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
