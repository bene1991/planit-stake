import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    console.log("Inspecting columns for table 'robot_variations'...");
    
    const { data, error } = await supabase
        .from('robot_variations')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching robot_variations:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columns found in robot_variations:", Object.keys(data[0]));
    } else {
        console.log("No data found in robot_variations.");
    }
}
run();
