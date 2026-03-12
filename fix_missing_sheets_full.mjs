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
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || ''; // needs to be retrieved if it's there
const supabase = createClient(supabaseUrl, supabaseKey);

const PENDING_GAMES = ["1398607", "1398609"];

async function main() {
    for (const fId of PENDING_GAMES) {
        console.log(`Buscando dados FULL da partida ${fId} do DB e API Football...`);

        // Get Service Role Key
        let token = supabaseKey;
        if (envConfig.SUPABASE_SERVICE_ROLE_KEY) {
            token = envConfig.SUPABASE_SERVICE_ROLE_KEY;
        } else {
            // Fallback to local .env
            console.log('No service role key found directly, testing with anon');
        }

        const apiRes = await fetch(`${supabaseUrl}/functions/v1/api-football`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ endpoint: `fixtures?id=${fId}` })
        });

        const data = await apiRes.json();
        const fixtureObj = data?.response?.[0];

        if (!fixtureObj) {
            console.log(`Jogo ${fId} não encontrado na API! (${JSON.stringify(data)})`);
            continue;
        }

        const apiGoalEvents = fixtureObj.events
            ?.filter((e) => e.type === 'Goal' && e.detail !== 'Missed Penalty')
            ?.map((e) => ({
                minute: e.time.elapsed,
                extra: e.time.extra
            })) || [];

        const goalsStr = apiGoalEvents.map((e) => `${e.minute}${e.extra ? '+' + e.extra : ''}'`).join(', ');

        const hasGoalInWindow = apiGoalEvents.some((e) => e.minute >= 30 && e.minute <= 70);
        const sheetResult = hasGoalInWindow ? 'GREEN' : 'RED';
        const finalScore = `${fixtureObj.score.fulltime.home || fixtureObj.goals.home}x${fixtureObj.score.fulltime.away || fixtureObj.goals.away}`;

        console.log(`\n[${fId}] Placar: ${finalScore} | Gols Totais: ${goalsStr} | Status: ${sheetResult}\n`);

        try {
            const webhookUrl = 'https://script.google.com/macros/s/AKfycbw9s_3Y5-qXTo_8p7S-F6lH-t1-h8p-q-P-s-s-R-r-T-E-L/exec';
            const req = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'UPDATE_ALERT',
                    fixtureId: fId,
                    goalsInterval: goalsStr,
                    finalScore: finalScore,
                    result: sheetResult
                })
            });
            console.log(`Webhook disparado, status: ${req.status}`);
        } catch (e) {
            console.error(`Erro ao disparar webhook:`, e);
        }
    }
}
main();
