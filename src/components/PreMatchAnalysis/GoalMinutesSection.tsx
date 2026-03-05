interface MinuteData {
  total: number | null;
  percentage: string | null;
}

interface TeamStats {
  goals: {
    for: { minute: Record<string, MinuteData> };
    against: { minute: Record<string, MinuteData> };
  };
}

interface Props {
  homeStats: TeamStats | null;
  awayStats: TeamStats | null;
  homeTeam: string;
  awayTeam: string;
}

const PERIODS = ['0-15', '16-30', '31-45', '46-60', '61-75', '76-90', '91-105', '106-120'];

export function GoalMinutesSection({ homeStats, awayStats, homeTeam, awayTeam }: Props) {
  // Safe helper to extract minutes object, returning empty mapping fallback
  const getMinutes = (stats: TeamStats | null) => {
    return stats?.goals?.for?.minute || {};
  };

  const homeMinutes = getMinutes(homeStats);
  const awayMinutes = getMinutes(awayStats);

  const maxGoals = PERIODS.reduce((max, p) => {
    const h = homeMinutes[p]?.total || 0;
    const a = awayMinutes[p]?.total || 0;
    return Math.max(max, h, a);
  }, 1);

  // Instead of filtering active periods, force them ALL to show (or at least those > 0). If all 0, still render the grid.
  const hasAnyData = PERIODS.some(p => (homeMinutes[p]?.total || 0) > 0 || (awayMinutes[p]?.total || 0) > 0);

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs font-semibold text-muted-foreground">
        <span className="text-primary">{homeTeam}</span>
        <span>Gols por Período</span>
        <span className="text-destructive">{awayTeam}</span>
      </div>

      {!hasAnyData && (
        <p className="text-[10px] text-muted-foreground text-center py-2">
          Dados insuficientes (nenhum gol registrado na competição atual)
        </p>
      )}

      {PERIODS.map(period => {
        const hGoals = homeMinutes[period]?.total || 0;
        const aGoals = awayMinutes[period]?.total || 0;
        return (
          <div key={period} className="flex items-center gap-2">
            <div className="flex-1 flex justify-end">
              <div className="flex items-center gap-1 w-full justify-end">
                <span className="text-[10px] text-foreground font-medium w-4 text-right">{hGoals}</span>
                <div className="flex-1 max-w-[100px] bg-muted rounded-full h-3 overflow-hidden flex justify-end">
                  <div className="bg-primary/70 rounded-full h-full" style={{ width: `${maxGoals > 0 ? (hGoals / maxGoals) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono w-12 text-center flex-shrink-0">{period}'</span>
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <div className="flex-1 max-w-[100px] bg-muted rounded-full h-3 overflow-hidden">
                  <div className="bg-destructive/70 rounded-full h-full" style={{ width: `${(aGoals / maxGoals) * 100}%` }} />
                </div>
                <span className="text-[10px] text-foreground font-medium w-4">{aGoals}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
