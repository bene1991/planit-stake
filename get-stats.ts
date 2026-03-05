import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('live_alerts')
        .select('fixture_id, home_team, away_team, minute_at_alert, stats_snapshot, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching rules:", error);
        return;
    }

    console.log("Recent live alerts and their stats:");
    data.forEach((alert: any) => {
        console.log(`\n--- ${alert.home_team} vs ${alert.away_team} ---`);
        console.log(`Minuto: ${alert.minute_at_alert}'`);
        if (alert.stats_snapshot) {
            console.log(`Casa - Ataques Perigosos: ${alert.stats_snapshot.h?.attacks}, Chutes: ${alert.stats_snapshot.h?.shots}, Posse: ${alert.stats_snapshot.h?.possession}%`);
            console.log(`Fora - Ataques Perigosos: ${alert.stats_snapshot.a?.attacks}, Chutes: ${alert.stats_snapshot.a?.shots}, Posse: ${alert.stats_snapshot.a?.possession}%`);
        } else {
            console.log('Sem snapshot stats no alerta.');
        }
    });

}

run();
