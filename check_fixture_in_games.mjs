
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFixture() {
    const fixture_id = '1491985';
    console.log(`Buscando fixture ${fixture_id} em games...`);
    
    const { data, error } = await supabase
        .from('games')
        .select('id, home_team, away_team, status, final_score_home, final_score_away')
        .eq('api_fixture_id', fixture_id);
    
    if (data && data.length > 0) {
        console.log('Encontrado:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('Não enontrado em games.', error || '');
    }
}

checkFixture();
