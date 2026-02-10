import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Shield, CheckCircle2, XCircle, Calendar, Target } from "lucide-react";
import { Game, Method } from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface OddRangeGamesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range: string;
  games: Game[];
  methods: Method[];
  oddMin: number;
  oddMax: number;
  stats: {
    total: number;
    greens: number;
    reds: number;
    winRate: number;
    profit: number;
  };
}

export function OddRangeGamesModal({
  open,
  onOpenChange,
  range,
  games,
  methods,
  oddMin,
  oddMax,
  stats,
}: OddRangeGamesModalProps) {
  const getMethodName = (methodId: string) => {
    return methods.find(m => m.id === methodId)?.name || 'Método';
  };

  // Sort games by date (most recent first)
  const sortedGames = [...games].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateB.getTime() - dateA.getTime();
  });

  // Group by date
  const groupedByDate = sortedGames.reduce((acc, game) => {
    if (!acc[game.date]) {
      acc[game.date] = [];
    }
    acc[game.date].push(game);
    return acc;
  }, {} as Record<string, Game[]>);

  // Check if operation is in odd range
  const isInRange = (odd: number | undefined) => {
    if (!odd) return false;
    return odd >= oddMin && odd <= oddMax;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col p-0" style={{ maxHeight: '90vh' }}>
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Faixa de Odd: {range}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{stats.total} operações</span>
            <span>•</span>
            <span className="text-emerald-500">{stats.greens}G</span>
            <span>/</span>
            <span className="text-red-500">{stats.reds}R</span>
            <span>•</span>
            <span className={cn(
              "font-medium",
              stats.winRate >= 60 ? "text-emerald-500" :
              stats.winRate >= 50 ? "text-yellow-500" : "text-red-500"
            )}>
              {stats.winRate.toFixed(1)}% WR
            </span>
            <span>•</span>
            <span className={cn(
              "font-medium",
              stats.profit >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)} st
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ maxHeight: 'calc(90vh - 100px)' }}>
          {Object.entries(groupedByDate).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum jogo encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByDate).map(([date, dateGames]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {format(new Date(date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {dateGames.map((game) => (
                      <div 
                        key={game.id}
                        className="p-3 rounded-lg bg-muted/30 border border-border/50"
                      >
                        {/* Game Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-muted-foreground">
                            {game.time}
                          </span>
                          
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={game.homeTeamLogo} />
                              <AvatarFallback><Shield className="h-3 w-3" /></AvatarFallback>
                            </Avatar>
                            <span className="text-xs truncate">{game.homeTeam}</span>
                          </div>

                          <span className="text-xs font-bold px-1">
                            {game.finalScoreHome !== undefined && game.finalScoreHome !== null
                              ? `${game.finalScoreHome} - ${game.finalScoreAway}`
                              : 'vs'
                            }
                          </span>

                          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                            <span className="text-xs truncate text-right">{game.awayTeam}</span>
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={game.awayTeamLogo} />
                              <AvatarFallback><Shield className="h-3 w-3" /></AvatarFallback>
                            </Avatar>
                          </div>
                        </div>

                        {/* Operations - only show those in the odd range */}
                        <div className="flex flex-wrap gap-1.5">
                          {game.methodOperations
                            .filter(op => isInRange(op.odd) && op.result)
                            .map((op, idx) => (
                            <Badge
                              key={idx}
                              variant={op.result === 'Green' ? 'default' : op.result === 'Red' ? 'destructive' : 'secondary'}
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 gap-1",
                                op.result === 'Green' && "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
                                op.result === 'Red' && "bg-red-500/20 text-red-500 border-red-500/30"
                              )}
                            >
                              {op.result === 'Green' ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : op.result === 'Red' ? (
                                <XCircle className="h-3 w-3" />
                              ) : null}
                              {getMethodName(op.methodId)}
                              {op.odd && <span className="opacity-70">@{op.odd.toFixed(2)}</span>}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
