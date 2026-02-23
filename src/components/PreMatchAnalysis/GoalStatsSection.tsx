import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TeamStats {
  goals: {
    for: { total: { total: number; home: number; away: number }; average: { total: string; home: string; away: string } };
    against: { total: { total: number; home: number; away: number }; average: { total: string; home: string; away: string } };
  };
  clean_sheet: { total: number };
  failed_to_score: { total: number };
  games: { played: { total: number; home: number; away: number } };
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

function computeAllStats(fixtures: Fixture[], teamId: number, count: number) {
  const sliced = fixtures.slice(0, count);
  let goalsFor = 0, goalsAgainst = 0, cleanSheets = 0, failedToScore = 0;
  let over15 = 0, over25 = 0, btts = 0;
  let homeGoalsFor = 0, homeGoalsAgainst = 0, homeGames = 0;
  let awayGoalsFor = 0, awayGoalsAgainst = 0, awayGames = 0;
  const n = sliced.length;

  for (const f of sliced) {
    const isHome = f.teams.home.id === teamId;
    const scored = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
    const conceded = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
    const totalGoals = scored + conceded;

    goalsFor += scored;
    goalsAgainst += conceded;
    if (conceded === 0) cleanSheets++;
    if (scored === 0) failedToScore++;
    if (totalGoals > 1.5) over15++;
    if (totalGoals > 2.5) over25++;
    if (scored > 0 && conceded > 0) btts++;

    if (isHome) {
      homeGoalsFor += scored;
      homeGoalsAgainst += conceded;
      homeGames++;
    } else {
      awayGoalsFor += scored;
      awayGoalsAgainst += conceded;
      awayGames++;
    }
  }

  return {
    goalsFor, goalsAgainst,
    avgFor: n > 0 ? goalsFor / n : 0,
    avgAgainst: n > 0 ? goalsAgainst / n : 0,
    cleanSheets, failedToScore, gamesUsed: n,
    over15Pct: n > 0 ? (over15 / n) * 100 : 0,
    over25Pct: n > 0 ? (over25 / n) * 100 : 0,
    bttsPct: n > 0 ? (btts / n) * 100 : 0,
    homeAvgFor: homeGames > 0 ? homeGoalsFor / homeGames : 0,
    homeAvgAgainst: homeGames > 0 ? homeGoalsAgainst / homeGames : 0,
    awayAvgFor: awayGames > 0 ? awayGoalsFor / awayGames : 0,
    awayAvgAgainst: awayGames > 0 ? awayGoalsAgainst / awayGames : 0,
    homeGames, awayGames,
  };
}

function StatBar({ label, homeVal, awayVal, format }: { label: string; homeVal: number; awayVal: number; format?: (v: number) => string }) {
  const max = Math.max(homeVal, awayVal, 0.01);
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-1 mt-4 first:mt-0">
      {children}
    </h4>
  );
}

const fmtDec = (v: number) => v.toFixed(2);
const fmtPct = (v: number) => `${v.toFixed(0)}%`;

export function GoalStatsSection({ homeStats, awayStats, homeTeam, awayTeam, homeLastMatches, awayLastMatches, homeTeamId, awayTeamId }: Props) {
  const [gameCount, setGameCount] = useState("season");

  const hasFixtures = homeLastMatches && awayLastMatches && homeTeamId && awayTeamId;

  const computed = useMemo(() => {
    if (gameCount === "season" || !hasFixtures) return null;
    const count = parseInt(gameCount);
    const home = computeAllStats(homeLastMatches!, homeTeamId!, count);
    const away = computeAllStats(awayLastMatches!, awayTeamId!, count);
    return { home, away };
  }, [gameCount, homeLastMatches, awayLastMatches, homeTeamId, awayTeamId, hasFixtures]);

  // Season-mode Over/BTTS from fixtures (always computed if fixtures available)
  const seasonOverBtts = useMemo(() => {
    if (!hasFixtures) return null;
    const homeAll = computeAllStats(homeLastMatches!, homeTeamId!, homeLastMatches!.length);
    const awayAll = computeAllStats(awayLastMatches!, awayTeamId!, awayLastMatches!.length);
    return { home: homeAll, away: awayAll };
  }, [homeLastMatches, awayLastMatches, homeTeamId, awayTeamId, hasFixtures]);

  const isSeasonMode = gameCount === "season" || !computed;

  if (isSeasonMode && (!homeStats || !awayStats)) {
    return <p className="text-muted-foreground text-sm text-center py-4">Estatísticas indisponíveis</p>;
  }

  const gamesLabel = isSeasonMode
    ? `Temporada completa${homeStats?.games?.played?.total ? ` (${homeStats.games.played.total} jogos)` : ''}`
    : `Baseado nos últimos ${computed!.home.gamesUsed} jogos`;

  return (
    <div className="space-y-3">
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

      <div className="flex justify-between text-xs font-semibold text-muted-foreground">
        <span className="text-primary">{homeTeam}</span>
        <span className="text-destructive">{awayTeam}</span>
      </div>

      {/* ====== GOLS GLOBAL ====== */}
      <SectionTitle>⚽ Gols Global</SectionTitle>

      {isSeasonMode ? (
        <>
          <StatBar label="Gols Feitos (Total)" homeVal={homeStats!.goals.for.total.total} awayVal={awayStats!.goals.for.total.total} />
          <StatBar label="Gols Sofridos (Total)" homeVal={homeStats!.goals.against.total.total} awayVal={awayStats!.goals.against.total.total} />
          <StatBar label="Média Gols/Jogo" homeVal={parseFloat(homeStats!.goals.for.average.total)} awayVal={parseFloat(awayStats!.goals.for.average.total)} format={fmtDec} />
          <StatBar label="Média Sofridos/Jogo" homeVal={parseFloat(homeStats!.goals.against.average.total)} awayVal={parseFloat(awayStats!.goals.against.average.total)} format={fmtDec} />
          <StatBar label="Clean Sheets" homeVal={homeStats!.clean_sheet.total} awayVal={awayStats!.clean_sheet.total} />
          <StatBar label="Não Marcou" homeVal={homeStats!.failed_to_score.total} awayVal={awayStats!.failed_to_score.total} />
          {seasonOverBtts && (
            <>
              <StatBar label="% Over 1.5" homeVal={seasonOverBtts.home.over15Pct} awayVal={seasonOverBtts.away.over15Pct} format={fmtPct} />
              <StatBar label="% Over 2.5" homeVal={seasonOverBtts.home.over25Pct} awayVal={seasonOverBtts.away.over25Pct} format={fmtPct} />
              <StatBar label="BTTS %" homeVal={seasonOverBtts.home.bttsPct} awayVal={seasonOverBtts.away.bttsPct} format={fmtPct} />
            </>
          )}
        </>
      ) : (
        <>
          <StatBar label="Gols Feitos (Total)" homeVal={computed!.home.goalsFor} awayVal={computed!.away.goalsFor} />
          <StatBar label="Gols Sofridos (Total)" homeVal={computed!.home.goalsAgainst} awayVal={computed!.away.goalsAgainst} />
          <StatBar label="Média Gols/Jogo" homeVal={computed!.home.avgFor} awayVal={computed!.away.avgFor} format={fmtDec} />
          <StatBar label="Média Sofridos/Jogo" homeVal={computed!.home.avgAgainst} awayVal={computed!.away.avgAgainst} format={fmtDec} />
          <StatBar label="Clean Sheets" homeVal={computed!.home.cleanSheets} awayVal={computed!.away.cleanSheets} />
          <StatBar label="Não Marcou" homeVal={computed!.home.failedToScore} awayVal={computed!.away.failedToScore} />
          <StatBar label="% Over 1.5" homeVal={computed!.home.over15Pct} awayVal={computed!.away.over15Pct} format={fmtPct} />
          <StatBar label="% Over 2.5" homeVal={computed!.home.over25Pct} awayVal={computed!.away.over25Pct} format={fmtPct} />
          <StatBar label="BTTS %" homeVal={computed!.home.bttsPct} awayVal={computed!.away.bttsPct} format={fmtPct} />
        </>
      )}

      {/* ====== GOLS CASA/FORA ====== */}
      <SectionTitle>🏠 Gols Casa / Fora</SectionTitle>

      {isSeasonMode ? (
        <>
          <StatBar
            label="Média Marcados (Casa × Fora)"
            homeVal={parseFloat(homeStats!.goals.for.average.home)}
            awayVal={parseFloat(awayStats!.goals.for.average.away)}
            format={fmtDec}
          />
          <StatBar
            label="Média Sofridos (Casa × Fora)"
            homeVal={parseFloat(homeStats!.goals.against.average.home)}
            awayVal={parseFloat(awayStats!.goals.against.average.away)}
            format={fmtDec}
          />
        </>
      ) : (
        <>
          <StatBar
            label="Média Marcados (Casa × Fora)"
            homeVal={computed!.home.homeAvgFor}
            awayVal={computed!.away.awayAvgFor}
            format={fmtDec}
          />
          <StatBar
            label="Média Sofridos (Casa × Fora)"
            homeVal={computed!.home.homeAvgAgainst}
            awayVal={computed!.away.awayAvgAgainst}
            format={fmtDec}
          />
        </>
      )}

      <div className="text-[9px] text-muted-foreground text-center mt-1">
        {isSeasonMode
          ? `${homeTeam} em casa (${homeStats?.games?.played?.home ?? '?'} jogos) × ${awayTeam} fora (${awayStats?.games?.played?.away ?? '?'} jogos)`
          : `${homeTeam} em casa (${computed!.home.homeGames} jogos) × ${awayTeam} fora (${computed!.away.awayGames} jogos)`
        }
      </div>
    </div>
  );
}
