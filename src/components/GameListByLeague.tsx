import { Game, Method } from "@/types";
import { Trophy } from "lucide-react";
import { GameListItem } from "./GameListItem";
import { ApiFootballEvent, ApiFootballFixture } from "@/hooks/useApiFootball";
import { useMemo } from "react";
import { GameSortOrder } from "./GameStatusTabs";

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
  sortOrder?: GameSortOrder;
}

export function GameListByLeague({
  games,
  methods,
  onUpdate,
  onDelete,
  onEdit,
  getStatsForGame,
  lastGlobalRefresh,
  sortOrder = 'time',
}: GameListByLeagueProps) {
  // Sort games based on sortOrder
  const sortedGames = useMemo(() => {
    const sorted = [...games];
    
    sorted.sort((a, b) => {
      if (sortOrder === 'elapsed') {
        // Sort by elapsed time (live games first, then by minute descending)
        const fixtureA = getStatsForGame(a);
        const fixtureB = getStatsForGame(b);
        
        const elapsedA = fixtureA?.fixture?.fixture?.status?.elapsed ?? 0;
        const elapsedB = fixtureB?.fixture?.fixture?.status?.elapsed ?? 0;
        
        const isLiveA = a.status === 'Live' || ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(fixtureA?.fixture?.fixture?.status?.short || '');
        const isLiveB = b.status === 'Live' || ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(fixtureB?.fixture?.fixture?.status?.short || '');
        
        // Live games first
        if (isLiveA && !isLiveB) return -1;
        if (!isLiveA && isLiveB) return 1;
        
        // If both live, sort by elapsed time (higher first)
        if (isLiveA && isLiveB) {
          return elapsedB - elapsedA;
        }
        
        // Non-live games by start time
        const dateTimeA = new Date(`${a.date}T${a.time}`).getTime();
        const dateTimeB = new Date(`${b.date}T${b.time}`).getTime();
        return dateTimeA - dateTimeB;
      }
      
      if (sortOrder === 'league') {
        // Sort by league name, then by time
        const leagueCompare = a.league.localeCompare(b.league);
        if (leagueCompare !== 0) return leagueCompare;
        
        const dateTimeA = new Date(`${a.date}T${a.time}`).getTime();
        const dateTimeB = new Date(`${b.date}T${b.time}`).getTime();
        return dateTimeA - dateTimeB;
      }
      
      // Default: sort by time
      const dateTimeA = new Date(`${a.date}T${a.time}`).getTime();
      const dateTimeB = new Date(`${b.date}T${b.time}`).getTime();
      return dateTimeA - dateTimeB;
    });
    
    return sorted;
  }, [games, sortOrder, getStatsForGame]);

  // Group games by league (only for league sort, otherwise show flat list)
  const gamesByLeague = useMemo(() => {
    if (sortOrder === 'elapsed' || sortOrder === 'time') {
      // For elapsed/time sort, don't group - show flat list
      return [['', sortedGames] as [string, Game[]]];
    }
    
    // For league sort, group by league
    const groups = new Map<string, Game[]>();
    
    sortedGames.forEach((game) => {
      const league = game.league || 'Outros';
      if (!groups.has(league)) {
        groups.set(league, []);
      }
      groups.get(league)!.push(game);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [sortedGames, sortOrder]);

  if (games.length === 0) {
    return null;
  }

  return (
    <div className="divide-y divide-border/50">
      {gamesByLeague.map(([league, leagueGames]) => (
        <div key={league || 'flat'}>
          {/* League Header - only show when grouped by league */}
          {league && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 sticky top-0 z-10">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{league}</span>
              <span className="text-xs text-muted-foreground">({leagueGames.length})</span>
            </div>
          )}

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
