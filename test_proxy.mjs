import fetch from "node-fetch";
import fs from 'fs';

const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

async function getResultViaProxy(fixtureId) {
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
    if (!fix) {
        console.log(`ID ${fixtureId} não encontrado no Proxy. Erros:`, data.errors);
        return null;
    }

    const goals = fix.events?.filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty') || [];
    const hasGoalInWindow = goals.some(e => e.time.elapsed >= 30 && e.time.elapsed <= 70);
    const goalsStr = goals.map(e => `${e.time.elapsed}${e.time.extra ? '+' + e.time.extra : ''}'`).join(', ');
    const score = `${fix.goals.home}x${fix.goals.away}`;

    return {
        fixtureId,
        finalScore: score,
        goalMinutes: goalsStr || '-',
        result: hasGoalInWindow ? 'GREEN' : 'RED'
    };
}

async function run() {
    const ids = [1429586, 1418897, 1386992, 1491953];
    console.log("--- TESTANDO VIA PROXY SUPABASE ---");
    for (const id of ids) {
        const res = await getResultViaProxy(id);
        if (res) console.log("OK:", res);
    }
}
run();
