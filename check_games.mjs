
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGames() {
    console.log('--- Verificando Tabela games ---');
    const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .order('last_sync_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error('Erro ao buscar games:', error);
    } else {
        console.log(`Encontrados ${games.length} games recentes sincronizados:`);
        games.forEach(g => {
            console.log(`- [${g.last_sync_at}] ID: ${g.api_fixture_id} | ${g.home_team} vs ${g.away_team} | Status: ${g.status} | Score: ${g.final_score_home}x${g.final_score_away}`);
        });
    }

    console.log('\n--- Verificando Games "Finished" sem final_score no live_alerts ---');
    // Verificando se existem jogos de hoje no live_alerts que estão nulos mas o jogo correspondente em 'games' está Finished
    const { data: pendingToday, error: pErr } = await supabase
        .from('live_alerts')
        .select('fixture_id, home_team, away_team, final_score')
        .is('final_score', null)
        .gte('created_at', '2026-03-22T00:00:00Z');
    
    if (pErr) {
        console.error('Erro ao buscar alertas pendentes:', pErr);
    } else if (pendingToday) {
        console.log(`Existem ${pendingToday.length} alertas de hoje sem final_score.`);
        for (const alert of pendingToday.slice(0, 5)) {
            const { data: gData } = await supabase
                .from('games')
                .select('*')
                .eq('api_fixture_id', parseInt(alert.fixture_id))
                .single();
            if (gData) {
                console.log(`- Alerta ${alert.fixture_id}: Jogo na tabela games está ${gData.status} (${gData.final_score_home}x${gData.final_score_away})`);
            }
        }
    }
}

checkGames();
