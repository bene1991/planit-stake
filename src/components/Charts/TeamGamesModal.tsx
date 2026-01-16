import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Game, Method } from '@/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';

interface TeamGamesModalProps {
  team: string;
  games: Game[];
  methods: Method[];
  onClose: () => void;
}

export function TeamGamesModal({ team, games, methods, onClose }: TeamGamesModalProps) {
  const teamData = useMemo(() => {
    // Filter games where this team played
    const teamGames = games.filter(
      (g) =>
        (g.homeTeam === team || g.awayTeam === team) &&
        g.methodOperations.length > 0 &&
        g.methodOperations.every((op) => op.result)
    );

    // Get all operations from these games
    const allOps = teamGames.flatMap((g) => 
      g.methodOperations.map((op) => ({
        ...op,
        game: g,
        methodName: methods.find((m) => m.id === op.methodId)?.name || 'Método Desconhecido',
      }))
    );

    const greens = allOps.filter((op) => op.result === 'Green').length;
    const reds = allOps.filter((op) => op.result === 'Red').length;
    const total = allOps.length;
    const winRate = total > 0 ? (greens / total) * 100 : 0;

    // Calculate profit in stakes
    let profit = 0;
    allOps.forEach((op) => {
      if (op.profit !== undefined && op.profit !== null && op.stakeValue && op.stakeValue > 0) {
        profit += op.profit / op.stakeValue;
      } else if (op.result === 'Green') {
        profit += op.odd && op.odd > 0 ? op.odd - 1 : 0;
      } else if (op.result === 'Red') {
        profit -= 1;
      }
    });

    // Sort games by date descending
    teamGames.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      games: teamGames,
      operations: allOps,
      greens,
      reds,
      total,
      winRate,
      profit,
    };
  }, [team, games, methods]);

  const getMethodName = (methodId: string) => {
    return methods.find((m) => m.id === methodId)?.name || 'Método Desconhecido';
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">👕</span>
            <span>{team}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Operações:</span>
            <Badge variant="outline">{teamData.total}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-600">{teamData.greens} Greens</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-600">{teamData.reds} Reds</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Win Rate:</span>
            <Badge variant={teamData.winRate >= 60 ? 'default' : teamData.winRate >= 50 ? 'secondary' : 'destructive'}>
              {teamData.winRate.toFixed(1)}%
            </Badge>
          </div>
          {teamData.profit !== 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Lucro:</span>
              <Badge variant={teamData.profit >= 0 ? 'default' : 'destructive'}>
                {teamData.profit >= 0 ? '+' : ''}{teamData.profit.toFixed(2)} stakes
              </Badge>
            </div>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {teamData.games.map((game) => (
              <div
                key={game.id}
                className="rounded-lg border p-3 transition-colors hover:bg-muted/30"
              >
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {format(parseISO(game.date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  <span>•</span>
                  <span>{game.league}</span>
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <span className={game.homeTeam === team ? 'font-bold' : ''}>
                    {game.homeTeam}
                  </span>
                  {game.finalScoreHome !== null && game.finalScoreAway !== null && (
                    <Badge variant="outline" className="font-mono">
                      {game.finalScoreHome} - {game.finalScoreAway}
                    </Badge>
                  )}
                  <span className={game.awayTeam === team ? 'font-bold' : ''}>
                    {game.awayTeam}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {game.methodOperations.map((op, opIndex) => (
                    <Badge
                      key={`${op.methodId}-${opIndex}`}
                      variant={op.result === 'Green' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {getMethodName(op.methodId)}
                      {op.odd && op.odd > 0 && ` @${op.odd.toFixed(2)}`}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
