import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TeamStats {
  goals: {
    for: { total: { total: number; home: number; away: number }; average: { total: string; home: string; away: string } };
    against: { total: { total: number; home: number; away: number }; average: { total: string; home: string; away: string } };
  };
  clean_sheet: { total: number };
  failed_to_score: { total: number };
  games: { played: { total: number } };
}

interface Fixture {
  teams: { home: { id: number }; away: { id: number } };
  goals: { home: number | null; away: number | null };
}

interface Props {
  homeStats: TeamStats | null;
  awayStats: TeamStats | null;
  homeTeam: string;
  awayTeam: string;
  homeLastMatches?: Fixture[] | null;
  awayLastMatches?: Fixture[] | null;
  homeTeamId?: number;
  awayTeamId?: number;
}

function computeStatsFromFixtures(fixtures: Fixture[], teamId: number, count: number) {
  const sliced = fixtures.slice(0, count);
  let goalsFor = 0, goalsAgainst = 0, cleanSheets = 0, failedToScore = 0;
  const n = sliced.length;

  for (const f of sliced) {
    const isHome = f.teams.home.id === teamId;
    const scored = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
    const conceded = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
    goalsFor += scored;
    goalsAgainst += conceded;
    if (conceded === 0) cleanSheets++;
    if (scored === 0) failedToScore++;
  }

  return {
    goalsFor,
    goalsAgainst,
    avgFor: n > 0 ? goalsFor / n : 0,
    avgAgainst: n > 0 ? goalsAgainst / n : 0,
    cleanSheets,
    failedToScore,
    gamesUsed: n,
  };
}

function StatBar({ label, homeVal, awayVal, format }: { label: string; homeVal: number; awayVal: number; format?: (v: number) => string }) {
  const max = Math.max(homeVal, awayVal, 1);
  const fmt = format || ((v: number) => String(v));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{fmt(homeVal)}</span>
        <span>{label}</span>
        <span className="font-medium text-foreground">{fmt(awayVal)}</span>
      </div>
      <div className="flex gap-1 h-2">
        <div className="flex-1 bg-muted rounded-full overflow-hidden flex justify-end">
          <div className="bg-primary/70 rounded-full" style={{ width: `${(homeVal / max) * 100}%` }} />
        </div>
        <div className="flex-1 bg-muted rounded-full overflow-hidden">
          <div className="bg-destructive/70 rounded-full" style={{ width: `${(awayVal / max) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

export function GoalStatsSection({ homeStats, awayStats, homeTeam, awayTeam, homeLastMatches, awayLastMatches, homeTeamId, awayTeamId }: Props) {
  const [gameCount, setGameCount] = useState("season");

  const hasFixtures = homeLastMatches && awayLastMatches && homeTeamId && awayTeamId;

  const computed = useMemo(() => {
    if (gameCount === "season" || !hasFixtures) return null;
    const count = parseInt(gameCount);
    const home = computeStatsFromFixtures(homeLastMatches!, homeTeamId!, count);
    const away = computeStatsFromFixtures(awayLastMatches!, awayTeamId!, count);
    return { home, away };
  }, [gameCount, homeLastMatches, awayLastMatches, homeTeamId, awayTeamId, hasFixtures]);

  const isSeasonMode = gameCount === "season" || !computed;

  if (isSeasonMode && (!homeStats || !awayStats)) {
    return <p className="text-muted-foreground text-sm text-center py-4">Estatísticas indisponíveis</p>;
  }

  const gamesLabel = isSeasonMode
    ? `Temporada completa${homeStats?.games?.played?.total ? ` (${homeStats.games.played.total} jogos)` : ''}`
    : `Baseado nos últimos ${computed!.home.gamesUsed} jogos`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={gameCount} onValueChange={setGameCount}>
          <SelectTrigger className="h-7 text-xs w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="season">Temporada</SelectItem>
            {hasFixtures && (
              <>
                <SelectItem value="5">Últimos 5</SelectItem>
                <SelectItem value="10">Últimos 10</SelectItem>
                <SelectItem value="15">Últimos 15</SelectItem>
                <SelectItem value="20">Últimos 20</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground">{gamesLabel}</span>
      </div>

      <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-2">
        <span className="text-primary">{homeTeam}</span>
        <span className="text-destructive">{awayTeam}</span>
      </div>

      {isSeasonMode ? (
        <>
          <StatBar label="Gols Feitos (Total)" homeVal={homeStats!.goals.for.total.total} awayVal={awayStats!.goals.for.total.total} />
          <StatBar label="Gols Sofridos (Total)" homeVal={homeStats!.goals.against.total.total} awayVal={awayStats!.goals.against.total.total} />
          <StatBar label="Média Gols/Jogo" homeVal={parseFloat(homeStats!.goals.for.average.total)} awayVal={parseFloat(awayStats!.goals.for.average.total)} format={(v) => v.toFixed(2)} />
          <StatBar label="Média Sofridos/Jogo" homeVal={parseFloat(homeStats!.goals.against.average.total)} awayVal={parseFloat(awayStats!.goals.against.average.total)} format={(v) => v.toFixed(2)} />
          <StatBar label="Clean Sheets" homeVal={homeStats!.clean_sheet.total} awayVal={awayStats!.clean_sheet.total} />
          <StatBar label="Não Marcou" homeVal={homeStats!.failed_to_score.total} awayVal={awayStats!.failed_to_score.total} />
        </>
      ) : (
        <>
          <StatBar label="Gols Feitos (Total)" homeVal={computed!.home.goalsFor} awayVal={computed!.away.goalsFor} />
          <StatBar label="Gols Sofridos (Total)" homeVal={computed!.home.goalsAgainst} awayVal={computed!.away.goalsAgainst} />
          <StatBar label="Média Gols/Jogo" homeVal={computed!.home.avgFor} awayVal={computed!.away.avgFor} format={(v) => v.toFixed(2)} />
          <StatBar label="Média Sofridos/Jogo" homeVal={computed!.home.avgAgainst} awayVal={computed!.away.avgAgainst} format={(v) => v.toFixed(2)} />
          <StatBar label="Clean Sheets" homeVal={computed!.home.cleanSheets} awayVal={computed!.away.cleanSheets} />
          <StatBar label="Não Marcou" homeVal={computed!.home.failedToScore} awayVal={computed!.away.failedToScore} />
        </>
      )}
    </div>
  );
}
