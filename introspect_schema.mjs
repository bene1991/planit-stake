import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    console.log("Fetching table columns for 'telegram_groups'...");
    
    const { data: columns, error } = await supabase
        .rpc('get_table_columns', { table_name: 'telegram_groups' });

    if (error) {
        // If RPC fails, try a direct SQL query via a generic proxy if available or just list one record
        console.log("RPC failed, trying to fetch one record to see keys...");
        const { data: records, error: fetchError } = await supabase
            .from('telegram_groups')
            .select('*')
            .limit(1);

        if (fetchError) {
            console.error("Error fetching records:", fetchError);
            return;
        }

        if (records && records.length > 0) {
            console.log("Columns found in record:", Object.keys(records[0]));
        } else {
            console.log("No records found in telegram_groups.");
        }
    }

    console.log("---");
    console.log("Fetching table columns for 'settings'...");
    const { data: setRecords, error: setError } = await supabase
        .from('settings')
        .select('*')
        .limit(1);

    if (setError) {
        console.error("Error fetching settings:", setError);
    } else if (setRecords && setRecords.length > 0) {
        console.log("Columns found in settings:", Object.keys(setRecords[0]));
    }

    console.log("---");
    console.log("Fetching table columns for 'robot_variations'...");
    const { data: varRecords, error: varError } = await supabase
        .from('robot_variations')
        .select('*')
        .limit(1);

    if (varError) {
        console.error("Error fetching robot_variations:", varError);
    }

    console.log("---");
    console.log("Listing all tables...");
    const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

    if (tablesError) {
        // information_schema might not be accessible via PostgREST, try a simple query to a common meta table
        console.log("PostgREST listing of information_schema failed, trying common tables...");
        const commonTables = ['telegram_groups', 'robot_variations', 'fixtures', 'alerts', 'robots'];
        console.log("Common tables checked so far or expected:", commonTables);
    } else {
        console.log("Tables in public schema:", tables.map(t => t.table_name));
    }
}
run();
