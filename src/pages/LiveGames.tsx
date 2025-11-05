import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { updateGameStatuses } from '@/utils/gameStatus';
import { Game } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function LiveGames() {
  const { games, loading, refreshGames } = useSupabaseGames();
  const [liveGames, setLiveGames] = useState<Game[]>([]);

  const updateStatuses = async () => {
    if (games.length === 0) return;
    
    const updatedGames = updateGameStatuses(games);
    const gamesLive = updatedGames.filter(game => game.status === 'Live');
    setLiveGames(gamesLive);
  };

  useEffect(() => {
    updateStatuses();
  }, [games]);

  // Auto-update every 30 seconds
  useEffect(() => {
    const interval = setInterval(updateStatuses, 30000);
    return () => clearInterval(interval);
  }, [games]);

  const handleRefresh = async () => {
    await refreshGames();
    toast.success('Jogos atualizados!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando jogos ao vivo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🔴 Jogos Ao Vivo</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe seus jogos em andamento
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {liveGames.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {liveGames.map((game) => (
            <Card key={game.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{game.league}</span>
                  <Badge variant="default" className="bg-red-500 animate-pulse">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      <span className="text-xs">AO VIVO</span>
                    </span>
                  </Badge>
                </div>

                {/* Teams */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={game.homeTeamLogo} alt={game.homeTeam} />
                      <AvatarFallback>
                        <Shield className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-sm font-semibold">{game.homeTeam}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={game.awayTeamLogo} alt={game.awayTeam} />
                      <AvatarFallback>
                        <Shield className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-sm font-semibold">{game.awayTeam}</h3>
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(`${game.date}T${game.time}`).toLocaleDateString('pt-BR')}</span>
                  <span>•</span>
                  <span>{game.time}</span>
                </div>

                {/* Operations */}
                {game.methodOperations && game.methodOperations.length > 0 && (
                  <div className="pt-2 border-t space-y-2">
                    {game.methodOperations.map((op, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="font-medium">Operação {idx + 1}</span>
                        {op.result ? (
                          <Badge variant={op.result === 'Green' ? 'default' : 'destructive'}>
                            {op.result}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Em andamento</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {game.notes && (
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    {game.notes}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<RefreshCw className="h-6 w-6" />}
          title="Nenhum jogo ao vivo"
          description="Não há jogos acontecendo agora no seu planejamento."
        />
      )}

      <div className="text-center text-sm text-muted-foreground">
        Atualização automática a cada 30 segundos
      </div>
    </div>
  );
}
