import { cn } from "@/lib/utils";

interface MatchFixture {
  fixture: { id: number; date: string };
  league: { name: string; logo: string };
  teams: { home: { id: number; name: string; logo: string; winner: boolean | null }; away: { id: number; name: string; logo: string; winner: boolean | null } };
  goals: { home: number | null; away: number | null };
}

interface Props {
  homeMatches: MatchFixture[] | null;
  awayMatches: MatchFixture[] | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
}

function FormBadge({ result }: { result: 'W' | 'D' | 'L' }) {
  const colors = { W: 'bg-green-500/20 text-green-400', D: 'bg-yellow-500/20 text-yellow-400', L: 'bg-red-500/20 text-red-400' };
  const labels = { W: 'V', D: 'E', L: 'D' };
  return <span className={cn("text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center", colors[result])}>{labels[result]}</span>;
}

function getResult(match: MatchFixture, teamId: number): 'W' | 'D' | 'L' {
  const isHome = match.teams.home.id === teamId;
  const homeGoals = match.goals.home ?? 0;
  const awayGoals = match.goals.away ?? 0;
  if (homeGoals === awayGoals) return 'D';
  if (isHome) return homeGoals > awayGoals ? 'W' : 'L';
  return awayGoals > homeGoals ? 'W' : 'L';
}

function MatchList({ matches, teamId, teamName }: { matches: MatchFixture[]; teamId: number; teamName: string }) {
  return (
    <div className="space-y-1.5">
      {/* Form sequence */}
      <div className="flex gap-0.5 mb-2">
        {matches.slice(0, 10).map((m, i) => (
          <FormBadge key={i} result={getResult(m, teamId)} />
        ))}
      </div>
      {matches.slice(0, 10).map((m) => {
        const isHome = m.teams.home.id === teamId;
        const result = getResult(m, teamId);
        const date = new Date(m.fixture.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return (
          <div key={m.fixture.id} className={cn(
            "flex items-center gap-2 text-[11px] py-1 px-2 rounded",
            result === 'W' && "bg-green-500/5",
            result === 'L' && "bg-red-500/5",
          )}>
            <span className="text-muted-foreground w-10 flex-shrink-0">{date}</span>
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <img src={m.teams.home.logo} alt="" className="h-3.5 w-3.5 flex-shrink-0" />
              <span className={cn("truncate", m.teams.home.id === teamId && "font-semibold text-foreground")}>
                {m.teams.home.name}
              </span>
            </div>
            <span className="font-bold text-foreground flex-shrink-0">
              {m.goals.home ?? '-'} - {m.goals.away ?? '-'}
            </span>
            <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
              <span className={cn("truncate text-right", m.teams.away.id === teamId && "font-semibold text-foreground")}>
                {m.teams.away.name}
              </span>
              <img src={m.teams.away.logo} alt="" className="h-3.5 w-3.5 flex-shrink-0" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LastMatchesSection({ homeMatches, awayMatches, homeTeam, awayTeam, homeTeamId, awayTeamId }: Props) {
  if (!homeMatches?.length && !awayMatches?.length) return <p className="text-muted-foreground text-sm text-center py-4">Últimos jogos indisponíveis</p>;

  return (
    <div className="space-y-4">
      {homeMatches?.length ? (
        <div>
          <h4 className="text-xs font-semibold text-primary mb-2">{homeTeam}</h4>
          <MatchList matches={homeMatches} teamId={homeTeamId} teamName={homeTeam} />
        </div>
      ) : null}
      {awayMatches?.length ? (
        <div>
          <h4 className="text-xs font-semibold text-destructive mb-2">{awayTeam}</h4>
          <MatchList matches={awayMatches} teamId={awayTeamId} teamName={awayTeam} />
        </div>
      ) : null}
    </div>
  );
}
