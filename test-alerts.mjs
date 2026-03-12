import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: alerts } = await supabase.from('live_alerts').select('*').order('created_at', { ascending: false }).limit(10);
    console.table(alerts.map(a => ({
        id: a.id,
        fixture: a.fixture_id,
        home: a.home_team,
        away: a.away_team,
        minute: a.minute_at_alert,
        final_score: a.final_score,
        status: a.status,
        date: a.created_at
    })));
}
run();
