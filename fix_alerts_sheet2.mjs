import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    const { data: alerts, error } = await supabase.from('live_alerts').select('id, fixture_id, home_team, away_team, status, variation_name, minute_at_alert, webhook_status, created_at').order('created_at', { ascending: false }).limit(20);
    if (error) {
        console.error("Error fetching alerts:", error);
        return;
    }
    
    console.table(alerts.map(a => ({
        id: a.id,
        fix: a.fixture_id,
        game: `${a.home_team.substring(0, 10)}...`,
        var: a.variation_name.substring(0, 15),
        status: a.status,
        webhook: a.webhook_status,
        c: new Date(a.created_at).toLocaleTimeString()
    })));
}
run();
