import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function find() {
    console.log("Buscando alertas com pendências...");
    const { data, error } = await supabase
        .from('live_alerts')
        .select('id, fixture_id, home_team, away_team, final_score, over15_result, goal_ht_result, created_at')
        .or('final_score.eq.pending,final_score.is.null,over15_result.eq.pending,goal_ht_result.eq.pending')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Erro:", error);
        return;
    }
    console.log(`Encontrados ${data.length} alertas com pendências.`);
    if (data.length > 0) {
        // Log all IDs found to a file for the repair script
        const ids = data.map(d => d.fixture_id);
        console.log("Fixture IDs:", JSON.stringify(ids));
        console.log("Primeiros 10 detalhes:");
        console.log(JSON.stringify(data.slice(0, 10), null, 2));
    }
}

find();
