import { createClient } from "@supabase/supabase-js";
import fs from 'fs';

const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    const ids = ['1429586', '1418897', '1410185', '1491953', '1491955', '1398607', '1398609'];
    console.log("--- BUSCANDO MINUTOS REAIS DOS ALERTAS ---");

    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('fixture_id, minute_at_alert, home_team, away_team')
        .in('fixture_id', ids);

    if (error) {
        console.error("Erro:", error);
        return;
    }

    console.table(alerts.map(a => ({
        id: a.fixture_id,
        match: `${a.home_team} v ${a.away_team}`,
        min: a.minute_at_alert
    })));
}
run();
