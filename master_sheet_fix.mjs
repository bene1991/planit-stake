import fetch from "node-fetch";
import fs from 'fs';

const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_PUBLISHABLE_KEY;
const webhookUrl = 'https://script.google.com/macros/s/AKfycbw9s_3Y5-qXTo_8p7S-F6lH-t1-h8p-q-P-s-s-R-r-T-E-L/exec';

async function getMatchData(fixtureId) {
    try {
        const res = await fetch(`${supabaseUrl}/functions/v1/api-football`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            },
            body: JSON.stringify({ endpoint: 'fixtures', id: fixtureId })
        });
        const data = await res.json();
        const fix = data.response?.[0];
        if (!fix) return null;

        const goals = fix.events?.filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty') || [];
        const goalsInWindow = goals.filter(e => e.time.elapsed >= 30 && e.time.elapsed <= 70);
        const goalsStr = goals.map(e => `${e.time.elapsed}${e.time.extra ? '+' + e.time.extra : ''}'`).join(', ');
        const score = `${fix.goals.home}x${fix.goals.away}`;

        return {
            fixtureId,
            finalScore: score,
            goalsInterval: goalsStr || '-',
            result: goalsInWindow.length > 0 ? 'GREEN' : 'RED'
        };
    } catch (e) {
        return null;
    }
}

async function run() {
    // Sincronizando com os minutos que estão na planilha do usuário (conforme print)
    const targets = [
        { id: 1429586, min: 15 }, // Orlando (Linha 136)
        { id: 1418897, min: 25 }, // Masr (Linha 150)
        { id: 1386992, min: 15 }, // Middlesbrough (Linha 139)
        { id: 1398609, min: 15 }, // Istanbulspor (Linha 135)
        { id: 1398607, min: 15 }, // Hatayspor (Linha 134)
        { id: 1491953, min: 30 }, // Argentinos (Linha 152)
        { id: 1491955, min: 19 }  // Banfield (Linha 153)
    ];

    console.log("--- ATUALIZANDO COM CHAVES CORRETAS (goalsInterval) ---");

    for (const t of targets) {
        const data = await getMatchData(t.id);
        if (data) {
            console.log(`Enviando ${t.id} (@${t.min}): ${data.result} | Goals: ${data.goalsInterval}`);
            const payload = {
                action: 'UPDATE_ALERT',
                fixtureId: String(t.id),
                alertMinute: t.min,
                finalScore: data.finalScore,
                goalsInterval: data.goalsInterval, // CHAVE CORRIGIDA!
                result: data.result
            };

            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
    }
    console.log("--- FINALIZADO MASTER UPDATE ---");
}

run();
