import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const apiKey = process.env.API_FOOTBALL_KEY;

async function debugGame(fixtureId) {
    console.log(`=== DEBUGANDO JOGO ${fixtureId} ===`);

    // 1. Buscar no Supabase
    console.log("\n--- Buscando no Supabase ---");
    const { data: alerts, error: alertError } = await supabase
        .from('live_alerts')
        .select('*')
        .eq('fixture_id', parseInt(fixtureId));

    if (alertError) console.error("Erro live_alerts:", alertError);
    else console.log("Alertas encontrados:", JSON.stringify(alerts, null, 2));

    const { data: games, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('fixture_id', parseInt(fixtureId));

    if (gameError) console.error("Erro games:", gameError);
    else console.log("Games encontrados:", JSON.stringify(games, null, 2));

    // 2. Buscar na API-Football
    console.log("\n--- Buscando na API-Football ---");
    try {
        const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
            headers: { 'x-apisports-key': apiKey }
        });
        const result = await response.json();
        
        if (result.response && result.response.length > 0) {
            const fixture = result.response[0];
            console.log("Resultado Real API:");
            console.log(`Time: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
            console.log(`Placar Final: ${fixture.goals.home}x${fixture.goals.away}`);
            console.log(`Status: ${fixture.fixture.status.long} (${fixture.fixture.status.short})`);
        } else {
            console.log("Nenhum dado encontrado na API para este ID.");
        }
    } catch (e) {
        console.error("Erro API-Football:", e);
    }
}

debugGame('1398599');
