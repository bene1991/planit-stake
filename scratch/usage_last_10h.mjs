import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function analyze() {
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    
    // Count individual game processing logs
    const { count, error } = await supabase
        .from('robot_execution_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', tenHoursAgo);

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }

    // Estimate total runs (list calls)
    // We can assume 1 run per minute = 600 runs per 10 hours
    const cronRuns = 60 * 10; 
    
    console.log(JSON.stringify({
        game_stats_calls: count,
        estimated_list_calls: cronRuns,
        total_estimated: count + cronRuns,
        time_period: "Last 10 hours"
    }, null, 2));
}

analyze();
