import { createClient } from "@supabase/supabase-js";
import fs from 'fs';
import fetch from "node-fetch";

const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);
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
        const isFinished = ['FT', 'AET', 'PEN'].includes(fix.fixture.status.short);

        return {
            fixtureId,
            home: fix.teams.home.name,
            away: fix.teams.away.name,
            league: fix.league.name,
            finalScore: score,
            goalsInterval: goalsStr || '-',
            result: goalsInWindow.length > 0 ? 'GREEN' : (isFinished ? 'RED' : 'PENDENTE')
        };
    } catch (e) { return null; }
}

async function run() {
    console.log("--- INICIANDO AUDITORIA TOTAL DE HOJE ---");

    // 1. Pegar todos os alertas de hoje no DB
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('*')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: true });

    if (error) { console.error(error); return; }

    // 2. Agrupar por fixture (Regra: 1 jogo = 1 linha)
    const uniqueFixtures = {};
    for (const a of alerts) {
        if (!uniqueFixtures[a.fixture_id]) {
            uniqueFixtures[a.fixture_id] = a;
        } else {
            // Se já existe, acumula os nomes das variações (opcional, para debug)
            if (!uniqueFixtures[a.fixture_id].variation_name.includes(a.variation_name)) {
                uniqueFixtures[a.fixture_id].variation_name += `, ${a.variation_name}`;
            }
        }
    }

    const fixtures = Object.values(uniqueFixtures);
    console.log(`Encontrados ${fixtures.length} jogos únicos alertados hoje.`);

    for (const f of fixtures) {
        console.log(`Verificando/Sincronizando: ${f.home_team} v ${f.away_team} (${f.fixture_id})`);

        // Sempre enviar o NEW_ALERT primeiro (o Apps Script ignora se já existir o par ID+Minuto, mas garante que esteja lá)
        const newPayload = {
            action: 'NEW_ALERT',
            fixtureId: String(f.fixture_id),
            dateAt: new Date(f.created_at).toLocaleDateString('pt-BR'),
            homeTeam: f.home_team,
            awayTeam: f.away_team,
            league: f.league_name,
            alertName: f.variation_name,
            alertMinute: f.minute_at_alert
        };

        // Envia NEW_ALERT sem medo de duplicar (Apps Script cuida do de-dupe por ID+Min se bem configurado, 
        // mas aqui forçamos a entrada caso tenha faltado)
        await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPayload) });

        // Agora busca o resultado real e atualiza
        const data = await getMatchData(f.fixture_id);
        if (data && data.result !== 'PENDENTE') {
            console.log(`  -> Resultado: ${data.result} | Gols: ${data.goalsInterval}`);
            const updatePayload = {
                action: 'UPDATE_ALERT',
                fixtureId: String(f.fixture_id),
                alertMinute: f.minute_at_alert,
                finalScore: data.finalScore,
                goalsInterval: data.goalsInterval,
                result: data.result
            };
            await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatePayload) });
        }
    }

    console.log("--- VARREDURA COMPLETA FINALIZADA ---");
}

run();
