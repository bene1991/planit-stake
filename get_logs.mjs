import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    const { data: alerts, error } = await supabase.from('live_alerts').select('id, fixture_id, home_team, variation_name, webhook_status, created_at').order('created_at', { ascending: false }).limit(20);
    if (error) {
        console.error("Error fetching alerts:", error);
        return;
    }
    alerts.forEach(a => console.log(`${new Date(a.created_at).toLocaleTimeString()} | Fix: ${a.fixture_id} | ${a.home_team} | ${a.variation_name.substring(0, 15)} | WH: ${a.webhook_status}`));
}
run();
