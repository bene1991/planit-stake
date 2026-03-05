import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MonitoredFixture {
    fixture_id: string;
    home_team: string;
    away_team: string;
    league_name: string;
    minute: number;
    score: string;
    current_stats: any;
    delta_10: any;
    last_execution: {
        stage: string;
        reason: string;
        details: any;
        time: string;
    } | null;
}

export function useRoboMonitor() {
    const [monitoredFixtures, setMonitoredFixtures] = useState<MonitoredFixture[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMonitorData = useCallback(async () => {
        try {
            // 1. Fetch latest snapshots (last 2 per fixture roughly)
            // We'll just fetch a bunch and group them in JS for simplicity as it's a small volume
            const { data: snapshots, error: snapErr } = await supabase
                .from('live_stats_snapshots')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (snapErr) throw snapErr;

            // 2. Fetch latest execution logs per fixture
            const { data: logs, error: logsErr } = await supabase
                .from('robot_execution_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (logsErr) throw logsErr;

            // 3. Process and group
            const fixtureMap = new Map<string, MonitoredFixture>();

            // Work with snapshots first to identify active fixtures
            snapshots?.forEach(snap => {
                if (!fixtureMap.has(snap.fixture_id)) {
                    fixtureMap.set(snap.fixture_id, {
                        fixture_id: snap.fixture_id,
                        home_team: '', // Will fill from logs or context later if needed
                        away_team: '',
                        league_name: '',
                        minute: snap.minute,
                        score: '0x0', // Default
                        current_stats: snap.stats_json,
                        delta_10: null,
                        last_execution: null
                    });
                } else {
                    // If we already have one, this is an older one, use it for delta if it's ~10 mins apart
                    const current = fixtureMap.get(snap.fixture_id)!;
                    if (!current.delta_10) {
                        const diff = (a: number, b: number) => Math.max(0, a - b);
                        const s1 = current.current_stats;
                        const s2 = snap.stats_json;
                        current.delta_10 = {
                            h: {
                                attacks: diff(s1.h.attacks, s2.h.attacks),
                                shots: diff(s1.h.shots, s2.h.shots)
                            },
                            a: {
                                attacks: diff(s1.a.attacks, s2.a.attacks),
                                shots: diff(s1.a.shots, s2.a.shots)
                            }
                        };
                    }
                }
            });

            // Overlay logs for names and status
            logs?.forEach(log => {
                const fixture = fixtureMap.get(log.fixture_id);
                if (fixture && !fixture.last_execution) {
                    fixture.last_execution = {
                        stage: log.stage,
                        reason: log.reason,
                        details: log.details,
                        time: log.created_at
                    };
                    // Try to infer names from details if present, or just leave as is
                    // If the robot-cron logged names, we'd use them here.
                }
            });

            setMonitoredFixtures(Array.from(fixtureMap.values()));
        } catch (error) {
            console.error('Error fetching robo monitor data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMonitorData();
        const interval = setInterval(fetchMonitorData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchMonitorData]);

    return { monitoredFixtures, loading, refetch: fetchMonitorData };
}
