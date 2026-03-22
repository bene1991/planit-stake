import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxruR8yWA91z_vnHKGBgB5C6_M8yIXXdtMPz8I2EiV777QlA6iIDfEH2_QyVyMYp74E/exec';

async function fetchFromApi(fixtureId) {
    const url = `${supabaseUrl}/functions/v1/api-football`;
    console.log(`Fetching from: ${url} (POST fixtures id=${fixtureId})`);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'apikey': apiKey
        },
        body: JSON.stringify({
            endpoint: 'fixtures',
            params: { id: fixtureId, ignoreCache: true }
        })
    });
    if (!response.ok) {
        console.error(`HTTP Error: ${response.status}`);
        const text = await response.text();
        console.error(text);
        return null;
    }
    const data = await response.json();
    console.log("API Response sample:", JSON.stringify(data).substring(0, 200));
    return data.response?.[0];
}

function calculateResults(fixture) {
    const events = fixture.events || [];
    const goals = events.filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty');
    
    const realGoals = goals.filter(g => {
        const cancellation = events.find(e => 
            e.type === 'Var' && 
            (e.detail?.toLowerCase().includes('cancel') || e.detail?.toLowerCase().includes('disallow')) &&
            e.time.elapsed === g.time.elapsed &&
            e.team.id === g.team.id
        );
        return !cancellation;
    });

    const totalGoals = (fixture.goals?.home || 0) + (fixture.goals?.away || 0);
    const over15 = (realGoals.length >= 2 || totalGoals >= 2) ? 'green' : 'red';
    const validGoals = realGoals.filter(g => g.time.elapsed >= 30 && g.time.elapsed <= 70);
    const goalHt = validGoals.length > 0 ? 'green' : 'red';

    return {
        over15,
        goalHt,
        finalScore: `${fixture.goals.home}x${fixture.goals.away}`,
        goalEvents: realGoals.map(g => ({
            team: g.team.name,
            minute: g.time.elapsed,
            player: g.player.name,
            detail: g.detail
        }))
    };
}

async function repairRecent24h() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`Buscando fixtures pendentes desde ${since}...`);

    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('fixture_id, home_team, away_team')
        .or('final_score.is.null,final_score.eq.pending')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

    if (error) { console.error('Erro:', error); return; }

    const seen = new Set();
    const fixtures = [];
    for (const a of alerts) {
        if (!seen.has(a.fixture_id)) {
            seen.add(a.fixture_id);
            fixtures.push({ id: a.fixture_id, name: `${a.home_team} x ${a.away_team}` });
        }
    }

    console.log(`Encontrados ${fixtures.length} fixtures pendentes nas últimas 24h.\n`);

    for (let i = 0; i < fixtures.length; i++) {
        const f = fixtures[i];
        console.log(`[${i + 1}/${fixtures.length}] Reparando: ${f.name} (fixture ${f.id})...`);

        const fixture = await fetchFromApi(f.id);
        if (!fixture) { console.log('  -> Sem dados na API\n'); continue; }

        const status = fixture.fixture?.status?.short;
        if (status !== 'FT' && status !== 'AET' && status !== 'PEN') {
            console.log(`  -> Jogo não finalizado (status: ${status}), pulando\n`);
            continue;
        }

        const results = calculateResults(fixture);
        console.log(`  -> Placar: ${results.finalScore}, O15: ${results.over15}, HT: ${results.goalHt}`);

        // Buscar alertas desse fixture que ainda não têm placar
        const { data: fixtureAlerts } = await supabase
            .from('live_alerts')
            .select('id, alert_minute')
            .eq('fixture_id', f.id)
            .or('final_score.is.null,final_score.eq.pending');

        if (!fixtureAlerts || fixtureAlerts.length === 0) {
            console.log('  -> Já foi corrigido por outro processo\n');
            continue;
        }

        for (const alert of fixtureAlerts) {
            const { error: updateErr } = await supabase
                .from('live_alerts')
                .update({
                    final_score: results.finalScore,
                    over15_result: results.over15,
                    goal_ht_result: results.goalHt,
                    goal_events: results.goalEvents,
                    updated_at: new Date().toISOString()
                })
                .eq('id', alert.id);

            if (updateErr) {
                console.log(`  -> Erro ao atualizar ${alert.id}: ${updateErr.message}`);
            }

            // Sync com Sheets
            try {
                await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'UPDATE_ALERT',
                        fixtureId: String(f.id),
                        finalScore: results.finalScore,
                        goalsInterval: results.goalEvents.map(e => `${e.minute}'`).join(', ')
                    })
                });
            } catch (e) {}
        }

        console.log(`  -> OK: ${fixtureAlerts.length} alertas atualizados\n`);
        await new Promise(r => setTimeout(r, 300));
    }

    console.log('=== REPARAÇÃO DAS ÚLTIMAS 24H CONCLUÍDA ===');
}

repairRecent24h();
