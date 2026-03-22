import { createClient } from "@supabase/supabase-js";
import fs from 'fs';

const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); 
    acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); 
    return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkColumns() {
    const { data, error } = await supabase.from('live_alerts').select('*').limit(1);
    if (error) {
        console.error("Erro:", error);
    } else {
        console.log("Colunas encontradas em live_alerts:");
        if (data && data.length > 0) {
            console.log(Object.keys(data[0]));
        } else {
            console.log("Nenhum dado encontrado para inferir colunas.");
        }
    }
}

checkColumns();
