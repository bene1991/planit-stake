import fs from 'fs';
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); 
    acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); 
    return acc;
}, {});

const apiKey = envConfig.API_FOOTBALL_KEY || 'ab7a8f3b2591ddbfd1a711deeb880df9';

async function fetchFixtureFromAPI(fixtureId) {
    try {
        const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
            headers: { 'x-rapidapi-key': apiKey }
        });
        const data = await response.json();
        return data.response && data.response[0] ? data.response[0] : null;
    } catch (error) {
        console.error(`Erro ao buscar fixture ${fixtureId}:`, error);
        return null;
    }
}

async function debug() {
    const fixtures = [1386419, 1386422];
    for (const id of fixtures) {
        console.log(`\n=== DEBUG FIXTURE ${id} ===`);
        const f = await fetchFixtureFromAPI(id);
        if (f) {
            console.log(`Time Local: ${f.teams.home.name} vs ${f.teams.away.name}`);
            console.log(`Status: ${f.fixture.status.short} (${f.fixture.status.long})`);
            console.log(`Gols: ${f.goals.home} - ${f.goals.away}`);
            console.log(`Placar Final: ${f.score.fulltime.home}x${f.score.fulltime.away}`);
            console.log("Eventos de gol:");
            const goals = f.events?.filter(e => e.type === 'Goal') || [];
            goals.forEach(e => console.log(`  - ${e.time.elapsed}' ${e.player.name} (${e.detail})`));
        } else {
            console.log("Nenhum dado retornado para esta fixture.");
        }
    }
}

debug();
