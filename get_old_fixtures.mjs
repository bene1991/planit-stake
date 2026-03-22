import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    console.log("Checking fixtures from the last 7 days with missing win_30_70...");
    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('id, fixture_id, home_team, away_team, created_at, win_30_70, final_score, ht_score')
        .is('win_30_70', null)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error("Error fetching alerts:", error);
        return;
    }

    console.log(`Found ${alerts.length} pending alerts.`);
    alerts.forEach(a => {
        console.log(`${a.created_at} | ID: ${a.fixture_id} | ${a.home_team} vs ${a.away_team} | Score: ${a.final_score} | HT: ${a.ht_score}`);
    });
}
run();
