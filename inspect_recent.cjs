const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectRecent() {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // Pegar TUDO das últimas 48h
    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('fixture_id, home_team, away_team, final_score, created_at, updated_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`TOTAL ALERTAS (48h): ${alerts.length}`);
    
    const countByScore = {};
    alerts.forEach(a => {
        const s = a.final_score || 'NULL';
        countByScore[s] = (countByScore[s] || 0) + 1;
    });
    console.log('DISTRIBUIÇÃO DE PLACARES:', countByScore);

    console.log('\nÚLTIMOS 20 ALERTAS:');
    alerts.slice(0, 20).forEach(a => {
        console.log(`- ${a.home_team} x ${a.away_team}: [${a.final_score}] (ID: ${a.fixture_id}, Criado: ${a.created_at})`);
    });
}

inspectRecent();
