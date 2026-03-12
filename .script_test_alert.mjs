import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import fs from 'fs';
const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); acc[key.trim()] = rest.join('=').replace(/"/g, '').trim(); return acc;
}, {});
const supabase = createClient(envConfig.VITE_SUPABASE_URL || '', envConfig.SUPABASE_SERVICE_ROLE_KEY || '');
const fId = "8888888";
async function test() {
    await supabase.rpc('check_duplicate_alert', { p_fixture_id: fId, p_minute: 15 });
    const { data: previousAlerts } = await supabase.from('live_alerts').select('id').eq('fixture_id', fId).limit(1);
    console.log("Qtd de record antes de inserir:", previousAlerts.length);
}
test();
