import { createClient } from "@supabase/supabase-js";
import 'dotenv/config'; // will load .env automatically
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);
async function run() {
    const todayStr = '2026-03-11';
    const { data, error } = await supabase.from('games').select('id, home_team, away_team, time, date, status, final_score_home, final_score_away, api_fixture_id').eq('date', todayStr).order('time', {ascending: true});
    console.log("Error:", error);
    console.log("Data length:", data?.length);
    console.table(data);
}
run();
