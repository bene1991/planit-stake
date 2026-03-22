import fs from 'fs';
import { createClient } from "@supabase/supabase-js";

const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); 
    acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); 
    return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function check() {
    const fixtures = [1386419, 1386422];
    console.log("--- LIVE ALERTS ---");
    const { data: alerts } = await supabase.from('live_alerts').select('*').in('fixture_id', fixtures);
    console.log(JSON.stringify(alerts, null, 2));

    console.log("\n--- GAMES ---");
    const { data: games } = await supabase.from('games').select('*').in('api_fixture_id', fixtures);
    console.log(JSON.stringify(games, null, 2));
}

check();
