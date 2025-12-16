import { ApiFootballEvent } from "@/hooks/useApiFootball";
import { Loader2 } from "lucide-react";

interface LiveStatsInlineProps {
  fixture: any;
  statistics: {
    homePossession: number;
    awayPossession: number;
    homeShots: number;
    awayShots: number;
    homeShotsOnTarget: number;
    awayShotsOnTarget: number;
    homeCorners: number;
    awayCorners: number;
    homeFouls: number;
    awayFouls: number;
    homeYellowCards: number;
    awayYellowCards: number;
    homeRedCards: number;
    awayRedCards: number;
  } | null;
  events: ApiFootballEvent[];
  loading: boolean;
}

export function LiveStatsInline({ fixture, statistics, events, loading }: LiveStatsInlineProps) {
  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!fixture) {
    return null;
  }

  const homePossession = statistics?.homePossession || 50;
  const awayPossession = statistics?.awayPossession || 50;

  // Filter important events (goals, cards)
  const importantEvents = events
    .filter(e => ['Goal', 'Card', 'subst'].includes(e.type))
    .slice(-5)
    .reverse();

  return (
    <div className="p-3 space-y-3 bg-secondary/30">
      {/* Pressure Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Posse</span>
          <span>{homePossession}% - {awayPossession}%</span>
        </div>
        <div className="h-2 flex rounded-full overflow-hidden bg-muted">
          <div 
            className="bg-primary transition-all duration-500"
            style={{ width: `${homePossession}%` }}
          />
          <div 
            className="bg-destructive/60 transition-all duration-500"
            style={{ width: `${awayPossession}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      {statistics && (
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <StatRow 
            label="Chutes" 
            home={statistics.homeShots} 
            away={statistics.awayShots} 
          />
          <StatRow 
            label="No Alvo" 
            home={statistics.homeShotsOnTarget} 
            away={statistics.awayShotsOnTarget} 
          />
          <StatRow 
            label="Escanteios" 
            home={statistics.homeCorners} 
            away={statistics.awayCorners} 
          />
          <StatRow 
            label="Faltas" 
            home={statistics.homeFouls} 
            away={statistics.awayFouls} 
          />
          <StatRow 
            label="Amarelos" 
            home={statistics.homeYellowCards} 
            away={statistics.awayYellowCards} 
          />
          <StatRow 
            label="Vermelhos" 
            home={statistics.homeRedCards} 
            away={statistics.awayRedCards} 
          />
        </div>
      )}

      {/* Events Timeline */}
      {importantEvents.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground font-medium mb-1">Eventos</p>
          {importantEvents.map((event, idx) => (
            <div 
              key={idx}
              className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-muted/50"
            >
              <span className="font-bold text-primary">{event.time.elapsed}'</span>
              <span className="flex-1 truncate">
                {getEventIcon(event.type)} {event.player.name}
                {event.type === 'Goal' && event.assist.name && (
                  <span className="text-muted-foreground"> (ass. {event.assist.name})</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away;
  const homePercent = total > 0 ? (home / total) * 100 : 50;

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-muted-foreground">
        <span>{home}</span>
        <span className="font-medium text-foreground">{label}</span>
        <span>{away}</span>
      </div>
      <div className="h-1 flex rounded-full overflow-hidden bg-muted">
        <div 
          className="bg-primary/60 transition-all"
          style={{ width: `${homePercent}%` }}
        />
        <div 
          className="bg-destructive/40 transition-all"
          style={{ width: `${100 - homePercent}%` }}
        />
      </div>
    </div>
  );
}

function getEventIcon(type: string): string {
  switch (type) {
    case 'Goal': return '⚽';
    case 'Card': return '🟨';
    case 'subst': return '🔄';
    default: return '•';
  }
}
