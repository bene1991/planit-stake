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
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
      <Tabs value={currentFilter} onValueChange={(v) => onFilterChange(v as GameStatusFilter)} className="flex-1">
        <TabsList className="w-full grid grid-cols-4 h-10">
          <TabsTrigger value="all" className="text-xs">
            Todos
            <span className="ml-1 text-muted-foreground">({counts.all})</span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">
            Pendentes
            <span className="ml-1 text-muted-foreground">({counts.pending})</span>
          </TabsTrigger>
          <TabsTrigger value="live" className="text-xs">
            Ao vivo
            {counts.live > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-bold animate-pulse">
                {counts.live}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finished" className="text-xs">
            Finalizados
            <span className="ml-1 text-muted-foreground">({counts.finished})</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Select value={currentSort} onValueChange={(v) => onSortChange(v as GameSortOrder)}>
        <SelectTrigger className="w-full sm:w-[140px] h-10">
          <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
          <SelectValue />
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
