import { cn } from "@/lib/utils";

interface H2HFixture {
  fixture: { id: number; date: string };
  league: { name: string; logo: string };
  teams: { home: { id: number; name: string; logo: string; winner: boolean | null }; away: { id: number; name: string; logo: string; winner: boolean | null } };
  goals: { home: number | null; away: number | null };
}

interface Props {
  h2h: H2HFixture[] | null;
  homeTeamId: number;
  awayTeamId: number;
}

export function HeadToHeadSection({ h2h, homeTeamId, awayTeamId }: Props) {
  if (!h2h?.length) return <p className="text-muted-foreground text-sm text-center py-4">Sem confrontos diretos</p>;

  // Compute summary
  let homeWins = 0, awayWins = 0, draws = 0;
  h2h.forEach(m => {
    const hg = m.goals.home ?? 0;
    const ag = m.goals.away ?? 0;
    const homeIsFirst = m.teams.home.id === homeTeamId;
    if (hg === ag) draws++;
    else if (homeIsFirst ? hg > ag : ag > hg) homeWins++;
    else awayWins++;
  });

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-around text-center py-2 bg-muted/30 rounded-lg">
        <div>
          <div className="text-lg font-bold text-primary">{homeWins}</div>
          <div className="text-[10px] text-muted-foreground">Vitórias</div>
        </div>
        <div>
          <div className="text-lg font-bold text-yellow-400">{draws}</div>
          <div className="text-[10px] text-muted-foreground">Empates</div>
        </div>
        <div>
          <div className="text-lg font-bold text-destructive">{awayWins}</div>
          <div className="text-[10px] text-muted-foreground">Vitórias</div>
        </div>
      </div>

      {/* Match list */}
      <div className="space-y-1.5">
        {h2h.map(m => {
          const date = new Date(m.fixture.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
          return (
            <div key={m.fixture.id} className="flex items-center gap-2 text-[11px] py-1.5 px-2 rounded bg-muted/20">
              <span className="text-muted-foreground w-14 flex-shrink-0">{date}</span>
              <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                <span className={cn("truncate text-right", m.teams.home.id === homeTeamId ? "text-primary font-semibold" : "")}>
                  {m.teams.home.name}
                </span>
                <img src={m.teams.home.logo} alt="" className="h-3.5 w-3.5 flex-shrink-0" />
              </div>
              <span className="font-bold text-foreground flex-shrink-0 px-1">
                {m.goals.home ?? '-'} - {m.goals.away ?? '-'}
              </span>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <img src={m.teams.away.logo} alt="" className="h-3.5 w-3.5 flex-shrink-0" />
                <span className={cn("truncate", m.teams.away.id === awayTeamId ? "text-destructive font-semibold" : "")}>
                  {m.teams.away.name}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <img src={m.league.logo} alt="" className="h-3 w-3" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
