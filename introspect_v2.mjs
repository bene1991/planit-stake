import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    console.log("--- ROBOT VARIATIONS ---");
    const { data: v, error: vErr } = await supabase.from('robot_variations').select('*').limit(1);
    if (vErr) console.error(vErr);
    else console.log("Columns:", Object.keys(v[0] || {}));

    console.log("\n--- TELEGRAM GROUPS (Full) ---");
    const { data: g, error: gErr } = await supabase.from('telegram_groups').select('*').limit(5);
    if (gErr) console.error(gErr);
    else {
        console.log("Records:", g);
        if (g.length > 0) console.log("Columns:", Object.keys(g[0]));
    }
}
run();
