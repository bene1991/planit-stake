import { useBttsEntries } from '@/hooks/useBttsEntries';
import { useBttsSettings } from '@/hooks/useBttsSettings';
import { useBttsMetrics, useLeagueStats } from '@/hooks/useBttsMetrics';
import { useBttsAlerts } from '@/hooks/useBttsAlerts';
import { useBttsQuarantine } from '@/hooks/useBttsQuarantine';
import { BttsEntryForm } from '@/components/BttsHealth/BttsEntryForm';
import { BttsStatsCards, BttsStreakCard } from '@/components/BttsHealth/BttsStatsCards';
import { BttsAlertCards } from '@/components/BttsHealth/BttsAlertCards';
import { BttsLeagueTable } from '@/components/BttsHealth/BttsLeagueTable';
import { BttsStakeLadder } from '@/components/BttsHealth/BttsStakeLadder';
import { BttsCharts } from '@/components/BttsHealth/BttsCharts';
import { BttsEntryList } from '@/components/BttsHealth/BttsEntryList';
import { Skeleton } from '@/components/ui/skeleton';
import { HeartPulse } from 'lucide-react';

export default function BttsHealth() {
  const { entries, loading: entriesLoading, addEntry, deleteEntry } = useBttsEntries();
  const { settings, loading: settingsLoading } = useBttsSettings();
  const { quarantineLeagues } = useBttsQuarantine();

  const metrics = useBttsMetrics(
    entries,
    settings?.bankroll_initial || 5000,
    settings?.bankroll_peak || 5000
  );
  const leagueStats = useLeagueStats(entries, quarantineLeagues);
  const alerts = useBttsAlerts(metrics, settings);

  const loading = entriesLoading || settingsLoading;

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <HeartPulse className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Saúde do Método (BTTS)</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento em tempo real • {metrics.totalEntries} entradas
          </p>
        </div>
      </div>

      {/* Entry Form */}
      <BttsEntryForm onSubmit={addEntry} />

      {/* Stats Cards */}
      <BttsStatsCards metrics={metrics} stakeValue={settings?.stake_percent || 3} />

      {/* Streak Card */}
      <BttsStreakCard metrics={metrics} />

      {/* Alerts */}
      <BttsAlertCards alerts={alerts} />

      {/* Charts */}
      <BttsCharts entries={entries} bankrollInitial={settings?.bankroll_initial || 5000} />

      {/* League Table */}
      <BttsLeagueTable leagueStats={leagueStats} />

      {/* Stake Ladder */}
      <BttsStakeLadder 
        metrics={metrics} 
        bankrollCurrent={metrics.bankrollCurrent} 
      />

      {/* Entry List */}
      <BttsEntryList entries={entries} onDelete={deleteEntry} />
    </div>
  );
}
