import { Game } from "@/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo } from "react";
import { ArrowUpDown } from "lucide-react";

export type GameStatusFilter = 'all' | 'pending' | 'live' | 'finished';
export type GameSortOrder = 'time' | 'elapsed' | 'league';

interface GameStatusTabsProps {
  games: Game[];
  currentFilter: GameStatusFilter;
  onFilterChange: (filter: GameStatusFilter) => void;
  currentSort: GameSortOrder;
  onSortChange: (sort: GameSortOrder) => void;
  fixtureStatuses?: Map<string, string>;
}

export function GameStatusTabs({
  games,
  currentFilter,
  onFilterChange,
  currentSort,
  onSortChange,
  fixtureStatuses = new Map(),
}: GameStatusTabsProps) {
  const counts = useMemo(() => {
    let pending = 0;
    let live = 0;
    let finished = 0;

    games.forEach((game) => {
      const fixtureStatus = game.api_fixture_id ? fixtureStatuses.get(game.api_fixture_id) : null;

      const isLive = fixtureStatus
        ? ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(fixtureStatus)
        : game.status === 'Live';

      const isFinished = fixtureStatus
        ? ['FT', 'AET', 'PEN'].includes(fixtureStatus)
        : game.status === 'Finished';

      if (isLive) {
        live++;
      } else if (isFinished) {
        finished++;
      } else {
        pending++;
      }
    });

    return { all: games.length, pending, live, finished };
  }, [games, fixtureStatuses]);

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={currentFilter} onValueChange={(v) => onFilterChange(v as GameStatusFilter)} className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-9">
          <TabsTrigger value="all" className="text-[10px] sm:text-xs px-1">
            Todos
            <span className="ml-1 opacity-60">({counts.all})</span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-[10px] sm:text-xs px-1">
            Pend
            <span className="ml-1 opacity-60">({counts.pending})</span>
          </TabsTrigger>
          <TabsTrigger value="live" className="text-[10px] sm:text-xs px-1">
            Live
            {counts.live > 0 && (
              <span className="ml-1 px-1 py-0.5 rounded bg-primary text-primary-foreground text-[8px] font-bold animate-pulse">
                {counts.live}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finished" className="text-[10px] sm:text-xs px-1">
            Fim
            <span className="ml-1 opacity-60">({counts.finished})</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Select value={currentSort} onValueChange={(v) => onSortChange(v as GameSortOrder)}>
        <SelectTrigger className="w-full h-8 text-xs bg-muted/20 border-white/5">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="time">Horário</SelectItem>
          <SelectItem value="elapsed">Tempo de jogo</SelectItem>
          <SelectItem value="league">Liga</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
