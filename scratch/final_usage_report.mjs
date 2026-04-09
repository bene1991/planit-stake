import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayISO = today.toISOString();

    console.log("--- RELATÓRIO DE CONSUMO DE HOJE ---");

    // 1. Cron Runs (from robot_status or logs)
    // We'll estimate based on robot_execution_logs entries grouped by minute
    const { data: runsByMinute } = await supabase.rpc('get_unique_minutes_logged', { start_time: todayISO });
    
    // If RPC doesn't exist, we'll use raw query
    let uniqueMinutes;
    if (!runsByMinute) {
        const { data: rawLogs } = await supabase
            .from('robot_execution_logs')
            .select('created_at')
            .gte('created_at', todayISO);
        
        const minutes = new Set(rawLogs?.map(l => l.created_at.substring(0, 16)));
        uniqueMinutes = Array.from(minutes);
    } else {
        uniqueMinutes = runsByMinute;
    }

    // 2. Statistics Calls (One per fixture_id per run)
    // Actually, each entry in robot_execution_logs is a game processed.
    const { count: gameProcessingCount } = await supabase
        .from('robot_execution_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayISO);

    // 3. Resolver Calls
    // Check live_alerts updates? Or resolver logs?
    // Resolver doesn't seem to have a log table like robot_execution_logs.
    
    // 4. Cache performance
    const { count: cacheCount } = await supabase
        .from('api_cache')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayISO);

    console.log(JSON.stringify({
        cron_minutes_active: uniqueMinutes.length,
        estimated_list_calls: uniqueMinutes.length,
        game_processing_logs: gameProcessingCount,
        new_cache_entries_today: cacheCount,
        estimated_total_api_calls: uniqueMinutes.length + gameProcessingCount 
    }, null, 2));

    // Sample the latest 5 logs to see types
    const { data: samples } = await supabase
        .from('robot_execution_logs')
        .select('stage, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
    
    console.log("\nÚltimos logs de execução:");
    samples?.forEach(s => console.log(`- [${new Date(s.created_at).toLocaleTimeString()}] ${s.stage}: ${s.reason}`));
}

run();
