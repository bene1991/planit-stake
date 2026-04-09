import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function analyze() {
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    
    // 1. Check API Cache entries created in last 10h
    const { count: cacheCount, error: cacheErr } = await supabase
        .from('api_cache')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', tenHoursAgo);

    // 2. Check Execution logs
    const { count: logCount, error: logErr } = await supabase
        .from('robot_execution_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', tenHoursAgo);

    // 3. Check for errors in robot_status
    const { data: status } = await supabase
        .from('robot_status')
        .select('*');

    // 4. Try to see if there are many entries in live_stats_snapshots
    const { count: snapCount } = await supabase
        .from('live_stats_snapshots')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', tenHoursAgo);

    console.log(JSON.stringify({
        api_cache_new_entries: cacheCount,
        execution_logs: logCount,
        stats_snapshots: snapCount,
        robot_status: status
    }, null, 2));
}

analyze();
