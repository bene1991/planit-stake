import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let configStrStr = '';
try { configStrStr = fs.readFileSync('/Users/vinicius/TRADE/planit-stake/.env.local', 'utf-8'); } catch (e) { }
if (!configStrStr) {
    try { configStrStr = fs.readFileSync('/Users/vinicius/TRADE/planit-stake/.env', 'utf-8'); } catch (e) { }
}

const env = Object.fromEntries(configStrStr.split('\n').filter(line => line.includes('=')).map(line => {
    const [k, ...v] = line.split('=');
    return [k.trim(), v.join('=').trim().replace(/"/g, '')];
}));

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, serviceKey);

async function run() {
    try {
        // Fetch one row to see what columns come back
        const { data, error } = await supabase.from('lay0x1_analyses').select('*').limit(1);
        if (error) {
            console.error("Query err:", error);
        } else {
            console.log("Columns:", data.length > 0 ? Object.keys(data[0]) : "No rows");
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}
run();
