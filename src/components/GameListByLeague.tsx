import { Game, Method } from "@/types";
import { Trophy } from "lucide-react";
import { GameListItem } from "./GameListItem";
import { ApiFootballEvent, ApiFootballFixture } from "@/hooks/useApiFootball";
import { useMemo } from "react";

interface FixtureData {
  fixture: ApiFootballFixture;
  statistics: any;
  events: ApiFootballEvent[];
}

interface GameListByLeagueProps {
  games: Game[];
  methods: Method[];
  onUpdate: (gameId: string, updates: Partial<Game>) => void;
  onDelete: (gameId: string) => void;
  onEdit?: (game: Game) => void;
  getStatsForGame: (game: Game) => FixtureData | null;
  lastGlobalRefresh?: number;
}

export function GameListByLeague({
  games,
  methods,
  onUpdate,
  onDelete,
  onEdit,
  getStatsForGame,
  lastGlobalRefresh,
}: GameListByLeagueProps) {
  // Group games by league
  const gamesByLeague = useMemo(() => {
    const groups = new Map<string, Game[]>();
    
    games.forEach((game) => {
      const league = game.league || 'Outros';
      if (!groups.has(league)) {
        groups.set(league, []);
      }
      groups.get(league)!.push(game);
    });

    // Sort games within each league by time
    groups.forEach((leagueGames) => {
      leagueGames.sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time}`).getTime();
        const dateTimeB = new Date(`${b.date}T${b.time}`).getTime();
        return dateTimeA - dateTimeB;
      });
    });

    // Convert to array and sort leagues alphabetically
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [games]);

  if (games.length === 0) {
    return null;
  }

  return (
    <div className="divide-y divide-border/50">
      {gamesByLeague.map(([league, leagueGames]) => (
        <div key={league}>
          {/* League Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 sticky top-0 z-10">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{league}</span>
            <span className="text-xs text-muted-foreground">({leagueGames.length})</span>
          </div>

          {/* Games in this league */}
          <div>
            {leagueGames.map((game) => (
              <GameListItem
                key={game.id}
                game={game}
                methods={methods}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onEdit={onEdit}
                fixtureData={getStatsForGame(game)}
                lastGlobalRefresh={lastGlobalRefresh}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
