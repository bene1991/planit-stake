import fetch from "node-fetch";

const apiKey = '3506c76beeebb838f684b248b9cc55fabd286e6826b6d4dbf22c39d39d246be9';
const webhookUrl = 'https://script.google.com/macros/s/AKfycbw9s_3Y5-qXTo_8p7S-F6lH-t1-h8p-q-P-s-s-R-r-T-E-L/exec';

async function getResult(fixtureId) {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
        headers: { 'x-apisports-key': apiKey }
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
        goalMinutes: goalsStr || '-'
    };
}

async function run() {
    const ids = [1429586, 1418897, 1386992, 1491953, 1491955, 1528318, 1528322, 1528325];
    console.log("--- ATUALIZANDO PLANILHA COM DADOS REAIS ---");

    for (const id of ids) {
        console.log(`Buscando ${id}...`);
        const res = await getResult(id);
        if (res) {
            console.log(`Enviando ${id}: ${res.result} (${res.finalScore}) - Gols: ${res.goalMinutes}`);
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'UPDATE_ALERT',
                    ...res
                })
            });
        } else {
            console.log(`ID ${id} não encontrado.`);
        }
    }
    console.log("--- FINALIZADO ---");
}
run();
