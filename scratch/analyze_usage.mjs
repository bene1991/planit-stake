import { createClient } from "@supabase/supabase-js";
import fs from 'fs';

const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function analyze() {
    console.log("Analyzing API Cache...");
    
    // Total cached items
    const { count, error: countErr } = await supabase
        .from('api_cache')
        .select('*', { count: 'exact', head: true });
        
    if (countErr) {
        console.error(countErr);
        return;
    }
    console.log(`Total items in api_cache: ${count}`);

    // Last 100 entries to see frequency
    const { data: recent, error: recentErr } = await supabase
        .from('api_cache')
        .select('created_at, cache_key')
        .order('created_at', { ascending: false })
        .limit(200);

    if (recentErr) {
        console.error(recentErr);
        return;
    }

    console.log("\nRecent unique requests (last 200 cache entries):");
    const freq = {};
    recent.forEach(r => {
        const time = new Date(r.created_at).toISOString().substring(0, 16); // YYYY-MM-DDTHH:mm
        freq[time] = (freq[time] || 0) + 1;
    });

    console.log("Requests per minute (approximated by cache creation):");
    Object.entries(freq).sort().forEach(([time, c]) => {
        console.log(`${time}: ${c} new cached items`);
    });

    const endpoints = {};
    recent.forEach(r => {
        const ep = r.cache_key.split('?')[0];
        endpoints[ep] = (endpoints[ep] || 0) + 1;
    });
    console.log("\nEndpoints breakdown (last 200):");
    console.log(endpoints);
}

analyze();
