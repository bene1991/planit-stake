import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    console.log("Searching for variation 'Under 2,5 - Posse 65%'...");
    
    const { data: variations, error } = await supabase
        .from('robot_variations')
        .select('*, telegram_groups(chat_id, bot_token)')
        .ilike('name', '%Under 2,5 - Posse 65%%');

    if (error) {
        console.error("Error fetching variations:", error);
        return;
    }

    if (!variations || variations.length === 0) {
        console.log("No variations found with that name.");
        return;
    }

    variations.forEach(v => {
        console.log(`Variation: ${v.name}`);
        console.log(`ID: ${v.id}`);
        console.log(`Telegram Chat ID (direct): ${v.telegram_chat_id}`);
        console.log(`Telegram Group ID (link): ${v.telegram_group_id}`);
        console.log(`Attached Group Info:`, JSON.stringify(v.telegram_groups, null, 2));
        console.log(`Active: ${v.active}`);
        console.log('---');
    });
}
run();
