import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Game } from '@/types';

/**
 * Hook dedicado ao AI Trader para buscar a lista de todos os jogos do dia (ou ao vivo).
 * Evita carregar o peso completo do useFixtureCache que é focado em 1 único jogo por vez.
 */
export function useGlobalFixtures() {
    const [fixtures, setFixtures] = useState<Game[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchDailyFixtures = async () => {
            setLoading(true);
            try {
                // 1. Buscar jogos do banco de dados (já salvos/planejados)
                const { data: dbGames, error: dbError } = await supabase
                    .from('games')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50); // Pega os últimos 50 jogos criados para compor o escopo ativo

                let allGames: Game[] = [];

                if (!dbError && dbGames) {
                    allGames = dbGames.map(g => ({
                        id: g.id,
                        api_fixture_id: g.api_fixture_id,
                        homeTeam: g.home_team,
                        awayTeam: g.away_team,
                        league: g.league,
                        date: new Date(g.date).toLocaleDateString(),
                        time: new Date(g.date).toLocaleTimeString(),
                        methodOperations: []
                    }));
                }

                // 2. Tentar buscar do dia atual via API-Football (como complemento)
                try {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const { data, error } = await supabase.functions.invoke('api-football', {
                        body: { endpoint: 'fixtures', params: { date: todayStr } }
                    });

                    if (!error && data?.response) {
                        const apiGames: Game[] = data.response.map((f: any) => ({
                            id: f.fixture.id.toString(),
                            api_fixture_id: f.fixture.id.toString(),
                            homeTeam: f.teams.home.name,
                            awayTeam: f.teams.away.name,
                            league: f.league.name,
                            date: new Date(f.fixture.date).toLocaleDateString(),
                            time: new Date(f.fixture.date).toLocaleTimeString(),
                            homeScore: f.goals.home || 0,
                            awayScore: f.goals.away || 0,
                            minute: f.fixture.status.elapsed,
                            methodOperations: []
                        }));

                        // Merge evitando duplicatas pelo api_fixture_id
                        const existingIds = new Set(allGames.map(g => g.api_fixture_id));
                        for (const g of apiGames) {
                            if (!existingIds.has(g.api_fixture_id)) {
                                allGames.push(g);
                            }
                        }
                    }
                } catch (apiErr) {
                    console.warn("API football fetch failed, using only DB games:", apiErr);
                }

                if (isMounted) {
                    setFixtures(allGames);
                }
            } catch (err) {
                console.error("Failed to fetch global fixtures for AI Trader Search:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchDailyFixtures();

        // Re-fetch a cada 5 minutos silenciosamente só para ter os jogos atualizados
        const interval = setInterval(fetchDailyFixtures, 300000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    return { fixtures, loading };
}
