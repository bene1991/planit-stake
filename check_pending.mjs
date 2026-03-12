import { createClient } from "@supabase/supabase-js";
import fs from 'fs';
const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    console.log("--- BUSCANDO JOGOS PENDENTES NO BANCO ---");
    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('fixture_id, home_team, away_team, goal_ht_result, over15_result, created_at, final_score')
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro:", error);
        return;
    }

    const unique = {};
    alerts.forEach(a => {
        if (!unique[a.fixture_id]) unique[a.fixture_id] = a;
    });

    const list = Object.values(unique);
    console.table(list.map(a => ({
        id: a.fixture_id,
        match: `${a.home_team} v ${a.away_team}`,
        HT: a.goal_ht_result,
        O15: a.over15_result,
        score: a.final_score,
        date: new Date(a.created_at).toLocaleString()
    })));
}
run();
