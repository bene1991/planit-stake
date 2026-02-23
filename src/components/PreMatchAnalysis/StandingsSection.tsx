import { cn } from "@/lib/utils";

interface StandingEntry {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  form: string;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}

interface Props {
  standings: StandingEntry[] | null;
  homeTeamId: number;
  awayTeamId: number;
}

export function StandingsSection({ standings, homeTeamId, awayTeamId }: Props) {
  if (!standings?.length) return <p className="text-muted-foreground text-sm text-center py-4">Classificação indisponível</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border/30">
            <th className="text-left py-2 px-1 w-6">#</th>
            <th className="text-left py-2 px-1">Time</th>
            <th className="text-center py-2 px-1">J</th>
            <th className="text-center py-2 px-1">V</th>
            <th className="text-center py-2 px-1">E</th>
            <th className="text-center py-2 px-1">D</th>
            <th className="text-center py-2 px-1">GP</th>
            <th className="text-center py-2 px-1">GC</th>
            <th className="text-center py-2 px-1">SG</th>
            <th className="text-center py-2 px-1 font-bold">P</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => {
            const isHighlighted = s.team.id === homeTeamId || s.team.id === awayTeamId;
            return (
              <tr key={s.team.id} className={cn(
                "border-b border-border/10",
                isHighlighted && "bg-primary/10 font-semibold"
              )}>
                <td className="py-1.5 px-1 text-muted-foreground">{s.rank}</td>
                <td className="py-1.5 px-1">
                  <div className="flex items-center gap-1.5">
                    <img src={s.team.logo} alt="" className="h-4 w-4" />
                    <span className={cn("truncate max-w-[120px]", isHighlighted && "text-primary")}>{s.team.name}</span>
                  </div>
                </td>
                <td className="text-center py-1.5 px-1">{s.all.played}</td>
                <td className="text-center py-1.5 px-1 text-green-400">{s.all.win}</td>
                <td className="text-center py-1.5 px-1 text-yellow-400">{s.all.draw}</td>
                <td className="text-center py-1.5 px-1 text-red-400">{s.all.lose}</td>
                <td className="text-center py-1.5 px-1">{s.all.goals.for}</td>
                <td className="text-center py-1.5 px-1">{s.all.goals.against}</td>
                <td className="text-center py-1.5 px-1">{s.goalsDiff > 0 ? `+${s.goalsDiff}` : s.goalsDiff}</td>
                <td className="text-center py-1.5 px-1 font-bold text-foreground">{s.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
