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
        const hasGoalInWindow = goals.some(e => e.time.elapsed >= 30 && e.time.elapsed <= 70);
        const goalsStr = goals.map(e => `${e.time.elapsed}${e.time.extra ? '+' + e.time.extra : ''}'`).join(', ');
        const score = `${fix.goals.home}x${fix.goals.away}`;

        return {
            fixtureId,
            finalScore: score,
            goalMinutes: goalsStr || '-',
            result: hasGoalInWindow ? 'GREEN' : 'RED'
        };
    } catch (e) {
        console.error(`Erro ao buscar ${fixtureId}:`, e.message);
        return null;
    }
}

async function run() {
    // Focando nos que o usuário mostrou na print como pendentes ou errados
    const targets = [
        { id: 1429586, alertMin: 15 }, // Orlando Pirates (Linha 36)
        { id: 1418897, alertMin: 25 }, // Masr (Linha 50)
        { id: 1410185, alertMin: 15 }, // Middlesbrough (Linha 39)
        { id: 1491953, alertMin: 30 }, // Argentinos JRS (Linha 52)
        { id: 1491955, alertMin: 19 }, // Banfield (Linha 53)
        { id: 1398607, alertMin: 26 }, // Hatayspor (Linha 46)
        { id: 1398609, alertMin: 26 }  // Istanbulspor (Linha 47)
    ];

    console.log("--- INICIANDO ATUALIZAÇÃO SEGURA COM MINUTOS ---");

    for (const target of targets) {
        console.log(`Processando ${target.id}...`);
        const data = await getMatchData(target.id);
        if (data) {
            console.log(`Bingo! ${target.id} -> ${data.result} | Score: ${data.finalScore} | Gols: ${data.goalMinutes}`);
            const payload = {
                action: 'UPDATE_ALERT',
                fixtureId: String(target.id),
                alertMinute: target.alertMin,
                finalScore: data.finalScore,
                goalMinutes: data.goalMinutes,
                result: data.result
            };

            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log(`Webhook Res: ${res.status}`);
        } else {
            console.log(`Partida ${target.id} não encontrada para eventos.`);
        }
    }
    console.log("--- CONCLUÍDO ---");
}

run();
