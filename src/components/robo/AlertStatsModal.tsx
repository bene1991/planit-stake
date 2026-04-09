import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MatchStatsOverview } from '@/components/MatchStatsOverview';
import { NormalizedStats } from '@/hooks/useFixtureCache';

interface AlertStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawStats: any | null;
  homeTeam: string;
  awayTeam: string;
}

function parseStatValue(val: string | number | null): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'string' && val.includes('%')) {
    return parseInt(val.replace('%', ''), 10);
  }
  return Number(val) || 0;
}

function normalizeRawStats(rawStats: any | null): NormalizedStats | null {
  if (!rawStats) return null;

  const defaultStats = () => ({
    possession: 50, shots_total: 0, shots_on: 0, shots_off: 0, shots_blocked: 0,
    corners: 0, fouls: 0, yellow: 0, red: 0, offsides: 0, attacks_total: 0, attacks_dangerous: 0
  });

  const result: NormalizedStats = {
    home: defaultStats(),
    away: defaultStats()
  };

  // Check if it's the new Supabase Edge Function format: { fullMatch: { h: {}, a: {} }, window10Min: {} }
  if (rawStats.fullMatch && rawStats.fullMatch.h && rawStats.fullMatch.a) {
    const { h, a } = rawStats.fullMatch;
    
    result.home.possession = h.possession || 50;
    result.home.shots_total = h.shots || 0;
    result.home.shots_on = h.shotsOn || 0;
    result.home.corners = h.corners || 0;
    result.home.attacks_dangerous = h.attacks || 0;
    // other stats might be missing in compact version, fallback to 0

    result.away.possession = a.possession || 50;
    result.away.shots_total = a.shots || 0;
    result.away.shots_on = a.shotsOn || 0;
    result.away.corners = a.corners || 0;
    result.away.attacks_dangerous = a.attacks || 0;

    return result;
  }

  // Fallback for raw API formatting (array)
  if (Array.isArray(rawStats) && rawStats.length >= 2) {
    const mapStats = (teamStatsArray: any[], target: any) => {
      teamStatsArray.forEach(stat => {
        const type = stat.type;
        const value = parseStatValue(stat.value);
        
        if (type === 'Ball Possession') target.possession = value;
        if (type === 'Total Shots') target.shots_total = value;
        if (type === 'Shots on Goal') target.shots_on = value;
        if (type === 'Shots off Goal') target.shots_off = value;
        if (type === 'Blocked Shots') target.shots_blocked = value;
        if (type === 'Corner Kicks') target.corners = value;
        if (type === 'Fouls') target.fouls = value;
        if (type === 'Offsides') target.offsides = value;
        if (type === 'Yellow Cards') target.yellow = value;
        if (type === 'Red Cards') target.red = value;
        if (type === 'Total attacks') target.attacks_total = value;
        if (type === 'Dangerous attacks') target.attacks_dangerous = value;
      });
    };

    mapStats(rawStats[0]?.statistics || [], result.home);
    mapStats(rawStats[1]?.statistics || [], result.away);
    return result;
  }

  return null;
}

export function AlertStatsModal({ isOpen, onClose, rawStats, homeTeam, awayTeam }: AlertStatsModalProps) {
  const normalizedStats = normalizeRawStats(rawStats);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-center font-bold text-lg">
            Estatísticas no Momento do Alerta
          </DialogTitle>
          <div className="text-sm text-center text-muted-foreground mt-1">
            {homeTeam} vs {awayTeam}
          </div>
        </DialogHeader>

        <div className="mt-4">
          {normalizedStats ? (
            <MatchStatsOverview stats={normalizedStats} loading={false} />
          ) : (
            <div className="text-center text-muted-foreground p-8 bg-muted/20 rounded-lg">
              Estatísticas não disponíveis para este alerta.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
