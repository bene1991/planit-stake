import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    console.log("Inspecting live_alerts table...");
    const { data, error } = await supabase.from('live_alerts').select('*').limit(1);
    
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    if (data && data.length > 0) {
        console.log("Columns:", Object.keys(data[0]));
    } else {
        console.log("No data found to inspect.");
    }
}
run();
