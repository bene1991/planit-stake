import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    console.log("Analyzing API usage from robot_execution_logs...");
    
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // 1. Total executions (distinct timestamps in logs)
    // Actually, each log entry is per fixture. 
    // Let's count total logs in the last 24h
    const { count: totalEntries, error: countErr } = await supabase
        .from('robot_execution_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', last24h.toISOString());
        
    if (countErr) {
        console.error("Error counting logs:", countErr);
        return;
    }
    
    console.log(`Total log entries in last 24h: ${totalEntries}`);
    
    // 2. Count by hour
    const { data: logs, error: logsErr } = await supabase
        .from('robot_execution_logs')
        .select('created_at, stage')
        .gte('created_at', last24h.toISOString())
        .order('created_at', { ascending: true });
        
    if (logsErr) {
        console.error("Error fetching logs:", logsErr);
        return;
    }
    
    const hourly = {};
    const stages = {};
    
    logs.forEach(l => {
        const hour = new Date(l.created_at).getHours();
        hourly[hour] = (hourly[hour] || 0) + 1;
        stages[l.stage] = (stages[l.stage] || 0) + 1;
    });
    
    console.log("\nEntries per hour (UTC):");
    Object.keys(hourly).sort((a,b) => a-b).forEach(h => {
        console.log(`Hour ${h.padStart(2, '0')}: ${hourly[h]} entries`);
    });
    
    console.log("\nStages distribution:");
    Object.keys(stages).forEach(s => {
        console.log(`${s}: ${stages[s]}`);
    });

    // 3. Peak Fixture count
    // Count distinct fixtures in a single run (group by created_at)
    const runs = {};
    logs.forEach(l => {
        const time = l.created_at;
        runs[time] = (runs[time] || 0) + 1;
    });
    
    const maxFixtures = Math.max(...Object.values(runs));
    console.log(`\nMax fixtures evaluated in a single run: ${maxFixtures}`);
    
    // 4. Theoretical API calls
    // Each run calls 'live=all' once.
    // Each fixture in 'VARIATION_EVALUATION' or 'ALERT_SENT' or similar calls statistics.
    // 'DISCARDED_PRE_FILTER' does NOT call statistics (it's for economy).
    
    const distinctRuns = Object.keys(runs).length;
    let statsCalls = 0;
    logs.forEach(l => {
        if (l.stage !== 'DISCARDED_PRE_FILTER') {
            statsCalls++;
        }
    });
    
    console.log(`\nTheoretical API Calls (approx):`);
    console.log(`- live=all calls: ${distinctRuns}`);
    console.log(`- statistics calls: ${statsCalls}`);
    console.log(`- Total: ${distinctRuns + statsCalls}`);
}

run();
