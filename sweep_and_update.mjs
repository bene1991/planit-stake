import fs from 'fs';
const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_PUBLISHABLE_KEY;
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(supabaseUrl, serviceRoleKey);
const apiKey = envConfig.API_FOOTBALL_KEY || 'ab7a8f3b2591ddbfd1a711deeb880df9';
const webhookUrl = 'https://script.google.com/macros/s/AKfycbw9s_3Y5-qXTo_8p7S-F6lH-t1-h8p-q-P-s-s-R-r-T-E-L/exec';

async function sendToSheet(payload) {
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        const text = await response.text();
        console.log(`[SHEETS] ${payload.action} | FIX_ID: ${payload.fixtureId} -> OK!`);
    } catch (err) {
        console.error(`[SHEETS ERROR] ${err.message}`);
    }
}

async function run() {
    console.log("=== INICIANDO VARREDURA E SINCRONIZACAO GERAL (APENAS ATUALIZACAO FINAL DE PLACARES) ===");

    // Pegando apenas os últimos 100 alertas da Database
    const { data: alerts, error } = await supabase.from('live_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error("DB Error:", error);
        return;
    }

    // Agrupar os alertas por fixture_id
    const fixtures = {};
    for (const a of alerts) {
        if (!fixtures[a.fixture_id]) {
            fixtures[a.fixture_id] = {
                items: [],
                league: a.league_name,
                home: a.home_team,
                away: a.away_team,
                created_at: a.created_at,
                minute: a.minute_at_alert,
                current_status: a.status
            };
        }
        fixtures[a.fixture_id].items.push(a.variation_name);
    }

    console.log(`Verificando os pendentes...`);

    for (const [fId, fObj] of Object.entries(fixtures)) {
        // Se já tiver GREEN ou RED no DB, pula
        if (fObj.current_status === 'GREEN' || fObj.current_status === 'RED') {
            continue;
        }

        console.log(`\n> Analisando: ${fId} (${fObj.home} v ${fObj.away}) -> Status atual bd: ${fObj.current_status}`);

        // Buscar resultado na API-SPORTS
        const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fId}`, {
            headers: { 'x-rapidapi-key': apiKey }
        });
        const json = await res.json();
        const f = json?.response?.[0];

        if (!f) {
            console.log(`- Partida não encontrada na API!`);
            continue;
        }

        const statusShort = f.fixture.status.short;
        const isFinished = ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(statusShort);

        if (isFinished) {
            let finalScoreHome = f.goals.home || 0;
            let finalScoreAway = f.goals.away || 0;
            let finalScoreStr = `${finalScoreHome}x${finalScoreAway}`;

            let validGoals = [];
            let allGoals = [];

            if (f.events) {
                const targetGoals = f.events.filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty');
                targetGoals.forEach(g => {
                    const el = g.time.elapsed;
                    allGoals.push(el);
                    // Regra: gol entre 30 e 70 minutos
                    if (el >= 30 && el <= 70) validGoals.push(el);
                });
            }

            let isGreen = validGoals.length > 0;
            let resultToSheet = isGreen ? 'GREEN' : 'RED';
            let goalsStr = allGoals.map(g => `${g}'`).join(', ');
            if (goalsStr === '') goalsStr = '-';

            console.log(`- Processando finalização! Placar: ${finalScoreStr}, Gols [${goalsStr}]. Decisão Sheet: ${resultToSheet}.`);

            // Enviar APENAS o UPDATE para preencher RED/GREEN
            await sendToSheet({
                action: 'UPDATE_ALERT',
                fixtureId: Number(fId),
                alertMinute: fObj.minute,
                finalScore: finalScoreStr,
                goalMinutes: goalsStr,
                result: resultToSheet
            });

            // Atualizar Banco de Dados Supabase para não passar nesse loop na próxima varredura
            await supabase.from('live_alerts')
                .update({ status: resultToSheet, final_score: finalScoreStr })
                .eq('fixture_id', fId);

        } else {
            console.log(`- Ainda em andamento (Status: ${statusShort})`);
        }
    }

    console.log("\n=== ROTINA DE PENDENTES CONCLUÍDA! ===");
}

run();
