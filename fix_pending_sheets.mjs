import fs from 'fs';
const envConfig = fs.readFileSync('.env', 'utf-8')
    .split('\n')
    .filter(line => line.includes('='))
    .reduce((acc, line) => {
        const [key, val] = line.split('=');
        acc[key] = val.replace(/"/g, '').trim();
        return acc;
    }, {});

const PENDING_GAMES = ["1398607", "1398609"];

async function callApiFootball(endpoint) {
    const res = await fetch(`https://v3.football.api-sports.io/${endpoint}`, {
        headers: {
            'x-apisports-key': envConfig.API_FOOTBALL_KEY,
        }
    });
    return res.json();
}

async function main() {
    for (const fId of PENDING_GAMES) {
        console.log(`Buscando dados da partida ${fId}...`);
        const data = await callApiFootball(`fixtures?id=${fId}`);
        const fixtureObj = data?.response?.[0];

        if (!fixtureObj) {
            console.log(`Jogo ${fId} não encontrado.`);
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
        const finalScore = `${fixtureObj.goals.home || 0}x${fixtureObj.goals.away || 0}`;

        console.log(`[${fId}] Placar: ${finalScore} | Gols: ${goalsStr} | Status: ${sheetResult}`);

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
