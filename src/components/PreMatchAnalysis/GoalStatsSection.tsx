interface TeamStats {
  goals: {
    for: { total: { total: number; home: number; away: number }; average: { total: string; home: string; away: string } };
    against: { total: { total: number; home: number; away: number }; average: { total: string; home: string; away: string } };
  };
  clean_sheet: { total: number };
  failed_to_score: { total: number };
  games: { played: { total: number } };
}

interface Props {
  homeStats: TeamStats | null;
  awayStats: TeamStats | null;
  homeTeam: string;
  awayTeam: string;
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

export function GoalStatsSection({ homeStats, awayStats, homeTeam, awayTeam }: Props) {
  if (!homeStats || !awayStats) return <p className="text-muted-foreground text-sm text-center py-4">Estatísticas indisponíveis</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-2">
        <span className="text-primary">{homeTeam}</span>
        <span className="text-destructive">{awayTeam}</span>
      </div>

      <StatBar label="Gols Feitos (Total)" homeVal={homeStats.goals.for.total.total} awayVal={awayStats.goals.for.total.total} />
      <StatBar label="Gols Sofridos (Total)" homeVal={homeStats.goals.against.total.total} awayVal={awayStats.goals.against.total.total} />
      <StatBar label="Média Gols/Jogo" homeVal={parseFloat(homeStats.goals.for.average.total)} awayVal={parseFloat(awayStats.goals.for.average.total)} format={(v) => v.toFixed(2)} />
      <StatBar label="Média Sofridos/Jogo" homeVal={parseFloat(homeStats.goals.against.average.total)} awayVal={parseFloat(awayStats.goals.against.average.total)} format={(v) => v.toFixed(2)} />
      <StatBar label="Clean Sheets" homeVal={homeStats.clean_sheet.total} awayVal={awayStats.clean_sheet.total} />
      <StatBar label="Não Marcou" homeVal={homeStats.failed_to_score.total} awayVal={awayStats.failed_to_score.total} />
    </div>
  );
}
