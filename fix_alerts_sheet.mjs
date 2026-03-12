import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    const { data: alerts, error } = await supabase.from('live_alerts').select('*').order('created_at', { ascending: false }).limit(20);
    if (error) {
        console.error("Error fetching alerts:", error);
        return;
    }
    
    console.table(alerts.map(a => ({
        id: a.id,
        fixture: a.fixture_id,
        home: a.home_team,
        away: a.away_team,
        minute: a.minute_at_alert,
        final_score: a.final_score,
        status: a.status,
        date: new Date(a.created_at).toLocaleString()
    })));
}
run();
