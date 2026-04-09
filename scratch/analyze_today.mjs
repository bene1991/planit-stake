import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function analyze() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayISO = today.toISOString();
    
    console.log("Analyzing from:", todayISO);

    // 1. Total logs today
    const { count: logCount } = await supabase
        .from('robot_execution_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayISO);

    // 2. Cache entries today
    const { count: cacheCount } = await supabase
        .from('api_cache')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayISO);

    // 3. Any other trace?
    const { data: runs, error: rpcErr } = await supabase.from('robot_status').select('*');

    console.log(JSON.stringify({
        total_logs_today: logCount,
        cache_entries_today: cacheCount,
        status: runs
    }, null, 2));
}

analyze();
