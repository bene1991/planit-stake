import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function check() {
    const { data, error } = await supabase
        .from('live_alerts')
        .select('*')
        .eq('fixture_id', 1398599);
    
    if (error) {
        console.error("Erro:", error);
        return;
    }
    console.log(JSON.stringify(data, null, 2));
}

check();
