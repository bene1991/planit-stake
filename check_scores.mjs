import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function check() {
    const { data, error } = await supabase
        .from('live_alerts')
        .select('final_score');
    
    if (error) {
        console.error(error);
        return;
    }
    const counts = {};
    data.forEach(row => {
        counts[row.final_score] = (counts[row.final_score] || 0) + 1;
    });
    console.log(counts);
}

check();
