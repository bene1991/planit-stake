const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkGremio() {
    // Buscar alertas do Grêmio nas últimas 48h
    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('fixture_id, home_team, away_team, final_score, goal_events, updated_at')
        .or('home_team.ilike.%Gremio%,away_team.ilike.%Gremio%')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`ENCONTRADOS ${alerts.length} ALERTAS DO GRÊMIO:`);
    alerts.forEach(a => {
        console.log(`- ${a.home_team} x ${a.away_team}: [${a.final_score}] (ID: ${a.fixture_id}, Gols: ${a.goal_events ? 'SIM' : 'NÃO'}, Updated: ${a.updated_at})`);
    });
}

checkGremio();
