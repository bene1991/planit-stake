const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkPending() {
    // Buscar alertas de ontem (19/03) até hoje (20/03) que ainda estão pending
    const yesterday = new Date('2026-03-19T00:00:00Z').toISOString();
    
    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('fixture_id, home_team, away_team, created_at')
        .eq('final_score', 'pending')
        .gte('created_at', yesterday);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!alerts || alerts.length === 0) {
        console.log('Nenhum jogo pendente encontrado desde ontem.');
        return;
    }

    const uniqueGames = [];
    const seen = new Set();

    for (const alert of alerts) {
        if (!seen.has(alert.fixture_id)) {
            uniqueGames.push({
                teams: `${alert.home_team} x ${alert.away_team}`,
                at: alert.created_at
            });
            seen.add(alert.fixture_id);
        }
    }

    console.log(`AINDA PENDENTES (${uniqueGames.length} jogos):`);
    uniqueGames.forEach(g => {
        console.log(`- ${g.teams} (Criado em: ${g.at})`);
    });
}

checkPending();
