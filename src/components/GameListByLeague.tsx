import { Game, Method } from "@/types";
import { Trophy } from "lucide-react";
import { GameListItem } from "./GameListItem";
import { useMemo } from "react";
import { GameSortOrder } from "./GameStatusTabs";
import { OnRedCardDetected } from "@/hooks/useFixtureCache";
interface LiveScoreEvent {
  minute: number;
  team: 'home' | 'away';
  type: string;
  player?: string;
  detail?: string;
}

interface LiveScore {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  status: string;
  statusLong: string;
  homeTeamId?: number;
  awayTeamId?: number;
  events?: LiveScoreEvent[];
  goalDetectedAt?: number;
}

interface GameListByLeagueProps {
  games: Game[];
  methods: Method[];
  onUpdate: (gameId: string, updates: Partial<Game>) => void;
  onDelete: (gameId: string) => void;
  onEdit?: (game: Game) => void;
  getScoreForGame: (game: Game) => LiveScore | null;
  lastGlobalRefresh?: number;
  sortOrder?: GameSortOrder;
  highlightedGameId?: string | null;
  globalPaused?: boolean;
  onRedCardDetected?: OnRedCardDetected;
  onSelectGame?: (game: Game) => void;
  selectedGameId?: string | null;
  compact?: boolean;
}

export function GameListByLeague({
  games,
  methods,
  onUpdate,
  onDelete,
  onEdit,
  getScoreForGame,
  lastGlobalRefresh,
  sortOrder = 'time',
  highlightedGameId,
  globalPaused = false,
  onRedCardDetected,
  onSelectGame,
  selectedGameId,
  compact = false,
}: GameListByLeagueProps) {
  // Sort games based on sortOrder
  const sortedGames = useMemo(() => {
    const sorted = [...games];

    sorted.sort((a, b) => {
      if (sortOrder === 'elapsed') {
        // Sort by elapsed time (live games first, then by minute descending)
        const scoreA = getScoreForGame(a);
        const scoreB = getScoreForGame(b);

        const elapsedA = scoreA?.elapsed ?? 0;
        const elapsedB = scoreB?.elapsed ?? 0;

        const isLiveA = a.status === 'Live' || ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(scoreA?.status || '');
        const isLiveB = b.status === 'Live' || ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(scoreB?.status || '');

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
  }, [games, sortOrder, getScoreForGame]);

  // Group games by league (only for league sort, otherwise show flat list)
  const gamesByLeague = useMemo(() => {
    if (sortOrder === 'elapsed' || sortOrder === 'time') {
      // For elapsed/time sort, don't group - show flat list
      return [['', sortedGames] as [string, Game[]]];
    }

    // For league sort, group by league
    const groups = new Map<string, Game[]>();

    sortedGames.forEach((game) => {
      const leagueKey = game.country ? `${game.country} - ${game.league}` : (game.league || 'Outros');
      if (!groups.has(leagueKey)) {
        groups.set(leagueKey, []);
      }
      groups.get(leagueKey)!.push(game);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [sortedGames, sortOrder]);

  if (games.length === 0) {
    return null;
  }

  return (
    <div className="divide-y divide-border/50">
      {gamesByLeague.map(([leagueKey, leagueGames]) => (
        <div key={leagueKey || 'flat'}>
          {/* League Header - only show when grouped by league */}
          {leagueKey && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 sticky top-0 z-10">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{leagueKey}</span>
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
                liveScore={getScoreForGame(game)}
                lastGlobalRefresh={lastGlobalRefresh}
                isHighlighted={game.id === highlightedGameId}
                globalPaused={globalPaused}
                onRedCardDetected={onRedCardDetected}
                onSelect={onSelectGame ? () => onSelectGame(game) : undefined}
                isSelected={game.id === selectedGameId}
                compact={compact}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
