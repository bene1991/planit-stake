import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";

interface H2HFixture {
  fixture: { id: number; date: string };
  league: { name: string; logo: string };
  teams: { home: { id: number; name: string; logo: string; winner: boolean | null }; away: { id: number; name: string; logo: string; winner: boolean | null } };
  goals: { home: number | null; away: number | null };
  score?: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
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

  // Analytics for Overs/BTTS
  const totalMatches = h2h.length;
  let over05HT = 0, over15HT = 0;
  let over05FT = 0, over15FT = 0, over25FT = 0, over35FT = 0, over45FT = 0;
  let btts = 0;

  h2h.forEach(m => {
    // Halftime Goals (Fallback to 0 if not available)
    const htHome = m.score?.halftime?.home ?? 0;
    const htAway = m.score?.halftime?.away ?? 0;
    const htTotal = htHome + htAway;

    if (htTotal > 0) over05HT++;
    if (htTotal > 1) over15HT++;

    // Fulltime Goals
    const ftHome = m.goals.home ?? 0;
    const ftAway = m.goals.away ?? 0;
    const ftTotal = ftHome + ftAway;

    if (ftTotal > 0) over05FT++;
    if (ftTotal > 1) over15FT++;
    if (ftTotal > 2) over25FT++;
    if (ftTotal > 3) over35FT++;
    if (ftTotal > 4) over45FT++;

    // BTTS
    if (ftHome > 0 && ftAway > 0) btts++;
  });

  const generateStatCard = (title: string, count: number, total: number) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    let colorClass = "text-destructive"; // < 50%
    if (pct >= 75) colorClass = "text-primary";
    else if (pct >= 50) colorClass = "text-yellow-400";

    return (
      <Card className="p-3 bg-muted/20 border-border/50 flex flex-col justify-between hover:bg-muted/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className={cn("text-lg font-bold", colorClass)}>{pct}%</span>
          <div className="flex items-center gap-1 text-foreground font-semibold text-xs">
            {title}
            <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {count}/{total} confrontos
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
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

      {/* Overs/BTTS Stats Grid */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-3">Overs do confronto</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {generateStatCard("Over 0.5FT", over05FT, totalMatches)}
          {generateStatCard("Over 1.5FT", over15FT, totalMatches)}
          {generateStatCard("Over 2.5FT", over25FT, totalMatches)}
          {generateStatCard("Over 3.5FT", over35FT, totalMatches)}
          {generateStatCard("Over 4.5FT", over45FT, totalMatches)}
          {generateStatCard("BTTS Sim", btts, totalMatches)}
          {generateStatCard("Over 0.5HT", over05HT, totalMatches)}
          {generateStatCard("Over 1.5HT", over15HT, totalMatches)}
        </div>
      </div>

      {/* Match list */}
      <div className="space-y-1.5 pt-2 border-t border-border/20">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">Histórico</h4>
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
