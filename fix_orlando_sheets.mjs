import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envConfig = fs.readFileSync('.env', 'utf-8')
    .split('\n')
    .filter(line => line.includes('='))
    .reduce((acc, line) => {
        const [key, ...rest] = line.split('=');
        acc[key.trim()] = rest.join('=').replace(/"/g, '').trim();
        return acc;
    }, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const supabaseKey = envConfig.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
    const d = new Date();
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbw9s_3Y5-qXTo_8p7S-F6lH-t1-h8p-q-P-s-s-R-r-T-E-L/exec';

    try {
        const req = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'NEW_ALERT',
                date: dateStr,
                match: 'Orlando Pirates vs Richards Bay',
                league: 'Premier Soccer League',
                method: '2 Ch Alvo + Posse 60% - Free Fire',
                alertMinute: '15',
                fixtureId: '1410166'
            })
        });
        console.log(`Webhook disparado, status: ${req.status}`);
        const txt = await req.text();
        console.log("Response txt:", txt);

        // Agora vamos remover e tentar recriar o alerta no banco para simular a chegada do alerta 2 (aos 16 minutos) e debugar o processo.
        console.log("Removendo todos os alertas deste fixture no banco para reteste de integridade...");
        const { error } = await supabase.from('live_alerts').delete().eq('fixture_id', '1410166');
        if (error) {
            console.error("error cleaning db", error);
        } else {
            console.log("Alerta limpo, os logs no cron agora tentarão processar.");
        }

    } catch (e) {
        console.error(`Erro ao disparar webhook:`, e);
    }
}
main();
