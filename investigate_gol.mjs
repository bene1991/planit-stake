
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
    console.log('--- Verificando Colunas de live_alerts ---');
    const { data: oneRecord, error: colError } = await supabase
        .from('live_alerts')
        .select('*')
        .limit(1);
    
    if (colError) {
        console.error('Erro ao buscar record:', colError);
    } else if (oneRecord && oneRecord.length > 0) {
        console.log('Colunas em live_alerts:', Object.keys(oneRecord[0]));
    }

    console.log('\n--- Ultimos 10 Alertas ---');
    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error('Erro ao buscar alertas:', error);
    } else {
        alerts.forEach(a => {
            console.log(`- [${a.created_at}] ID: ${a.fixture_id} | ${a.home_team} vs ${a.away_team} | Status: ${a.status} | Placar Final: ${a.final_score}`);
        });
    }

    console.log('\n--- Alertas de 19/03 ---');
    const { data: day19, error: d19Error } = await supabase
        .from('live_alerts')
        .select('*')
        .gte('created_at', '2026-03-19T00:00:00Z')
        .lt('created_at', '2026-03-20T00:00:00Z')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (d19Error) {
        console.error('Erro ao buscar alertas do dia 19:', d19Error);
    } else {
        console.log(`Encontrados ${day19.length} alertas em 19/03:`);
        day19.forEach(a => {
            console.log(`- [${a.created_at}] ID: ${a.fixture_id} | ${a.home_team} vs ${a.away_team} | Status: ${a.status} | Placar Final: ${a.final_score}`);
        });
    }
}

investigate();
