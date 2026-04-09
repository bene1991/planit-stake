import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    const { count } = await supabase.from('live_stats_snapshots').select('*', { count: 'exact', head: true });
    console.log("Current Snapshots in DB:", count);
}
run();
