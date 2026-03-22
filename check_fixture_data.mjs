import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkFixture(fixtureId) {
    console.log(`Buscando dados para fixture ${fixtureId}...`);
    const { data, error } = await supabase
        .from('live_alerts')
        .select('*')
        .eq('fixture_id', fixtureId);
    
    if (error) {
        console.error("Erro:", error);
        return;
    }
    console.log(`Encontrados ${data.length} registros.`);
    console.log(JSON.stringify(data, null, 2));
}

const fixtureId = process.argv[2] || '1394655';
checkFixture(fixtureId);
