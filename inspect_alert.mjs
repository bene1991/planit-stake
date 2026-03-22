
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectAlert() {
    const { data, error } = await supabase
        .from('live_alerts')
        .select('*')
        .is('final_score', null)
        .limit(1);
    
    if (data && data.length > 0) {
        console.log('Record:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('No pending alerts found (or error):', error);
    }
}

inspectAlert();
