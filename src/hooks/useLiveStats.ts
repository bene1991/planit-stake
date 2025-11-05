import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LiveStats {
  homePossession?: number;
  awayPossession?: number;
  homeShots?: number;
  awayShots?: number;
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
  homeCorners?: number;
  awayCorners?: number;
  homeFouls?: number;
  awayFouls?: number;
  homeYellowCards?: number;
  awayYellowCards?: number;
  homeRedCards?: number;
  awayRedCards?: number;
}

export function useLiveStats(fixtureId?: string) {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fixtureId || fixtureId === 'mock-fixture-id') {
      setStats(null);
      return;
    }

    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: functionError } = await supabase.functions.invoke(
          'fetch-live-stats',
          {
            body: { fixtureId },
          }
        );

        if (functionError) throw functionError;

        if (data?.response) {
          const statsData = data.response;
          
          // Parse statistics from API-Football response
          const homeStats = statsData.find((s: any) => s.team.id === statsData[0]?.team?.id);
          const awayStats = statsData.find((s: any) => s.team.id === statsData[1]?.team?.id);

          const parseStatValue = (stats: any[], type: string): number => {
            const stat = stats?.find((s: any) => s.type === type);
            if (!stat?.value) return 0;
            if (typeof stat.value === 'string') {
              return parseInt(stat.value.replace('%', '')) || 0;
            }
            return stat.value || 0;
          };

          setStats({
            homePossession: parseStatValue(homeStats?.statistics, 'Ball Possession'),
            awayPossession: parseStatValue(awayStats?.statistics, 'Ball Possession'),
            homeShots: parseStatValue(homeStats?.statistics, 'Total Shots'),
            awayShots: parseStatValue(awayStats?.statistics, 'Total Shots'),
            homeShotsOnTarget: parseStatValue(homeStats?.statistics, 'Shots on Goal'),
            awayShotsOnTarget: parseStatValue(awayStats?.statistics, 'Shots on Goal'),
            homeCorners: parseStatValue(homeStats?.statistics, 'Corner Kicks'),
            awayCorners: parseStatValue(awayStats?.statistics, 'Corner Kicks'),
            homeFouls: parseStatValue(homeStats?.statistics, 'Fouls'),
            awayFouls: parseStatValue(awayStats?.statistics, 'Fouls'),
            homeYellowCards: parseStatValue(homeStats?.statistics, 'Yellow Cards'),
            awayYellowCards: parseStatValue(awayStats?.statistics, 'Yellow Cards'),
            homeRedCards: parseStatValue(homeStats?.statistics, 'Red Cards'),
            awayRedCards: parseStatValue(awayStats?.statistics, 'Red Cards'),
          });
        }
      } catch (err) {
        console.error('Error fetching live stats:', err);
        setError(err instanceof Error ? err.message : 'Erro ao buscar estatísticas');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Refresh stats every 30 seconds for live games
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fixtureId]);

  return { stats, loading, error };
}
