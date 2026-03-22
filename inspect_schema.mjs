import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    console.log("Inspecting columns for table 'telegram_groups'...");
    
    // Querying rpc if possible or direct select from a known table to see structure
    const { data, error } = await supabase
        .from('telegram_groups')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching telegram_groups:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columns found in telegram_groups:", Object.keys(data[0]));
    } else {
        console.log("No data found in telegram_groups to inspect columns.");
        // Try to get schema via information_schema
        const { data: cols, error: colError } = await supabase
            .rpc('get_table_columns', { table_name: 'telegram_groups' });
            
        if (colError) {
            console.log("RPC get_table_columns failed or not found. trying direct query to information_schema if allowed (usually not via client)");
        } else {
            console.log("Columns via RPC:", cols);
        }
    }
}
run();
