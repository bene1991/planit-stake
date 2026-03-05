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
  const valid = fixtures.filter(f => f.goals.home !== null && f.goals.away !== null);
  const sliced = valid.slice(0, count);
  let goalsFor = 0, goalsAgainst = 0, cleanSheets = 0, failedToScore = 0;
  let over15 = 0, over25 = 0, btts = 0;
  let homeGoalsFor = 0, homeGoalsAgainst = 0, homeGames = 0;
  let awayGoalsFor = 0, awayGoalsAgainst = 0, awayGames = 0;
  const n = sliced.length;

  for (const f of sliced) {
    const isHome = f.teams.home.id === teamId;
    const scored = isHome ? f.goals.home! : f.goals.away!;
    const conceded = isHome ? f.goals.away! : f.goals.home!;
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
    cleanSheetsPct: n > 0 ? (cleanSheets / n) * 100 : 0,
    failedToScorePct: n > 0 ? (failedToScore / n) * 100 : 0,
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

function CountPctBar({ label, homeCount, homeTotal, awayCount, awayTotal }: { label: string; homeCount: number; homeTotal: number; awayCount: number; awayTotal: number }) {
  const homePct = homeTotal > 0 ? (homeCount / homeTotal) * 100 : 0;
  const awayPct = awayTotal > 0 ? (awayCount / awayTotal) * 100 : 0;
  const max = Math.max(homePct, awayPct, 0.01);
  const fmt = (count: number, total: number) => `${count} (${total > 0 ? Math.round((count / total) * 100) : 0}%)`;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{fmt(homeCount, homeTotal)}</span>
        <span>{label}</span>
        <span className="font-medium text-foreground">{fmt(awayCount, awayTotal)}</span>
      </div>
      <div className="flex gap-1 h-2">
        <div className="flex-1 bg-muted rounded-full overflow-hidden flex justify-end">
          <div className="bg-primary/70 rounded-full" style={{ width: `${(homePct / max) * 100}%` }} />
        </div>
        <div className="flex-1 bg-muted rounded-full overflow-hidden">
          <div className="bg-destructive/70 rounded-full" style={{ width: `${(awayPct / max) * 100}%` }} />
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

  // Season-mode: compute from ALL available fixtures
  const seasonComputed = useMemo(() => {
    if (!hasFixtures) return null;
    const home = computeAllStats(homeLastMatches!, homeTeamId!, homeLastMatches!.length);
    const away = computeAllStats(awayLastMatches!, awayTeamId!, awayLastMatches!.length);
    return { home, away };
  }, [homeLastMatches, awayLastMatches, homeTeamId, awayTeamId, hasFixtures]);

  const isSeasonMode = gameCount === "season" || !computed;

  if (isSeasonMode && !homeStats?.goals && !seasonComputed) {
    return <p className="text-muted-foreground text-sm text-center py-4">Estatísticas indisponíveis</p>;
  }

  const seasonGamesTotal = homeStats?.games?.played?.total;
  const fixturesAvailable = seasonComputed?.home.gamesUsed;

  const gamesLabel = isSeasonMode
    ? (fixturesAvailable && seasonGamesTotal && fixturesAvailable < seasonGamesTotal
      ? `Temporada (baseado em ${fixturesAvailable} de ${seasonGamesTotal} jogos)`
      : `Temporada completa${seasonGamesTotal ? ` (${seasonGamesTotal} jogos)` : ''}`)
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
          <StatBar
            label="Média Gols Marcados"
            homeVal={homeStats?.goals ? parseFloat(homeStats.goals.for.average.total) : (seasonComputed?.home.avgFor || 0)}
            awayVal={awayStats?.goals ? parseFloat(awayStats.goals.for.average.total) : (seasonComputed?.away.avgFor || 0)}
            format={fmtDec}
          />
          <StatBar
            label="Média Gols Sofridos"
            homeVal={homeStats?.goals ? parseFloat(homeStats.goals.against.average.total) : (seasonComputed?.home.avgAgainst || 0)}
            awayVal={awayStats?.goals ? parseFloat(awayStats.goals.against.average.total) : (seasonComputed?.away.avgAgainst || 0)}
            format={fmtDec}
          />
          <CountPctBar
            label="Clean Sheets"
            homeCount={homeStats?.clean_sheet ? homeStats.clean_sheet.total : (seasonComputed?.home.cleanSheets || 0)}
            homeTotal={homeStats?.games?.played?.total ?? (seasonComputed?.home.gamesUsed || 0)}
            awayCount={awayStats?.clean_sheet ? awayStats.clean_sheet.total : (seasonComputed?.away.cleanSheets || 0)}
            awayTotal={awayStats?.games?.played?.total ?? (seasonComputed?.away.gamesUsed || 0)}
          />
          <CountPctBar
            label="Não Marcou"
            homeCount={homeStats?.failed_to_score ? homeStats.failed_to_score.total : (seasonComputed?.home.failedToScore || 0)}
            homeTotal={homeStats?.games?.played?.total ?? (seasonComputed?.home.gamesUsed || 0)}
            awayCount={awayStats?.failed_to_score ? awayStats.failed_to_score.total : (seasonComputed?.away.failedToScore || 0)}
            awayTotal={awayStats?.games?.played?.total ?? (seasonComputed?.away.gamesUsed || 0)}
          />
          {seasonComputed && (
            <>
              <StatBar label="% Over 1.5" homeVal={seasonComputed.home.over15Pct} awayVal={seasonComputed.away.over15Pct} format={fmtPct} />
              <StatBar label="% Over 2.5" homeVal={seasonComputed.home.over25Pct} awayVal={seasonComputed.away.over25Pct} format={fmtPct} />
              <StatBar label="BTTS %" homeVal={seasonComputed.home.bttsPct} awayVal={seasonComputed.away.bttsPct} format={fmtPct} />
            </>
          )}
        </>
      ) : (
        <>
          <StatBar label="Média Gols Marcados" homeVal={computed!.home.avgFor} awayVal={computed!.away.avgFor} format={fmtDec} />
          <StatBar label="Média Gols Sofridos" homeVal={computed!.home.avgAgainst} awayVal={computed!.away.avgAgainst} format={fmtDec} />
          <CountPctBar label="Clean Sheets" homeCount={computed!.home.cleanSheets} homeTotal={computed!.home.gamesUsed} awayCount={computed!.away.cleanSheets} awayTotal={computed!.away.gamesUsed} />
          <CountPctBar label="Não Marcou" homeCount={computed!.home.failedToScore} homeTotal={computed!.home.gamesUsed} awayCount={computed!.away.failedToScore} awayTotal={computed!.away.gamesUsed} />
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
            homeVal={homeStats?.goals ? parseFloat(homeStats.goals.for.average.home) : (seasonComputed?.home.homeAvgFor || 0)}
            awayVal={awayStats?.goals ? parseFloat(awayStats.goals.for.average.away) : (seasonComputed?.away.awayAvgFor || 0)}
            format={fmtDec}
          />
          <StatBar
            label="Média Sofridos (Casa × Fora)"
            homeVal={homeStats?.goals ? parseFloat(homeStats.goals.against.average.home) : (seasonComputed?.home.homeAvgAgainst || 0)}
            awayVal={awayStats?.goals ? parseFloat(awayStats.goals.against.average.away) : (seasonComputed?.away.awayAvgAgainst || 0)}
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
