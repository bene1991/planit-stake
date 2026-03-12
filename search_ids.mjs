import fetch from "node-fetch";
import fs from 'fs';

const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_PUBLISHABLE_KEY; // fallback

console.log("Supabase URL:", supabaseUrl);
console.log("Service Key Length:", serviceRoleKey?.length);
if (!serviceRoleKey) console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY NÃO ENCONTRADA!");

async function run() {
    console.log("--- BUSCANDO ORLANDO POR NOME ---");
    const res = await fetch(`${supabaseUrl}/functions/v1/api-football`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
        },
        body: JSON.stringify({ endpoint: 'fixtures', live: 'all' })
    });
    const data = await res.json();
    console.log("RES RAW LIVE:", JSON.stringify(data).substring(0, 500));
    console.log(`Encontrados ${data?.results} jogos ao vivo.`);

    // Filter by name
    const orlando = data.response?.filter(f => f.teams.home.name.includes("Orlando") || f.teams.away.name.includes("Orlando"));
    console.log("Orlando Matches:", JSON.stringify(orlando, null, 2));

    console.log("--- BUSCANDO JOGOS DE HOJE ---");
    const today = new Date().toISOString().split('T')[0];
    const res2 = await fetch(`${supabaseUrl}/functions/v1/api-football`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
        },
        body: JSON.stringify({ endpoint: 'fixtures', date: today })
    });
    const data2 = await res2.json();
    console.log(`Jogos de hoje (${today}): ${data2.results}`);
    const matches = data2.response?.map(f => `${f.fixture.id}: ${f.teams.home.name} v ${f.teams.away.name}`).slice(0, 10);
    console.log("Amostra:", matches);
}
run();
