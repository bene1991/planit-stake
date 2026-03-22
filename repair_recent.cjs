const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function repairRecent() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Buscar alertas das últimas 24h que ainda não têm placar
    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('fixture_id, home_team, away_team')
        .or('final_score.is.null,final_score.eq.pending')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

    if (error) { console.error('Erro:', error); return; }

    // Deduplicar por fixture_id
    const seen = new Set();
    const fixtures = [];
    for (const a of alerts) {
        if (!seen.has(a.fixture_id)) {
            seen.add(a.fixture_id);
            fixtures.push({ id: a.fixture_id, name: `${a.home_team} x ${a.away_team}` });
        }
    }

    console.log(`Encontrados ${fixtures.length} fixtures pendentes nas últimas 24h.`);
    if (fixtures.length === 0) return;

    for (let i = 0; i < fixtures.length; i++) {
        const f = fixtures[i];
        console.log(`\n[${i + 1}/${fixtures.length}] Reparando: ${f.name} (fixture ${f.id})...`);

        try {
            // Buscar resultado na API
            const resp = await fetch(`${supabaseUrl}/functions/v1/api-football`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({ endpoint: 'fixtures', params: { id: String(f.id) } }),
            });

            const json = await resp.json();
            const match = json.response?.[0];
            if (!match) { console.log('  -> Sem dados na API'); continue; }

            const status = match.fixture?.status?.short;
            if (status !== 'FT' && status !== 'AET' && status !== 'PEN') {
                console.log(`  -> Jogo não finalizado (status: ${status}), pulando`);
                continue;
            }

            const homeGoals = match.goals?.home ?? 0;
            const awayGoals = match.goals?.away ?? 0;
            const finalScore = `${homeGoals}x${awayGoals}`;
            const totalGoals = homeGoals + awayGoals;

            // Extrair eventos de gol
            const goalEvents = (match.events || [])
                .filter(e => e.type === 'Goal')
                .map(e => ({
                    time: e.time?.elapsed,
                    team: e.team?.name,
                    player: e.player?.name,
                    detail: e.detail,
                }));

            // Buscar TODOS os alertas desse fixture
            const { data: fixtureAlerts } = await supabase
                .from('live_alerts')
                .select('id, alert_minute')
                .eq('fixture_id', f.id)
                .or('final_score.is.null,final_score.eq.pending');

            if (!fixtureAlerts || fixtureAlerts.length === 0) {
                console.log('  -> Já foi corrigido por outro processo');
                continue;
            }

            // Atualizar cada alerta
            for (const alert of fixtureAlerts) {
                const alertMin = alert.alert_minute || 0;
                const goalsAfter = goalEvents.filter(g => g.time > alertMin).length;
                const o15 = totalGoals > 1.5 ? 'green' : 'red';
                const ht = goalsAfter > 0 ? 'green' : 'red';

                const { error: updateErr } = await supabase
                    .from('live_alerts')
                    .update({
                        final_score: finalScore,
                        goal_events: goalEvents,
                        o15_result: o15,
                        ht_result: ht,
                    })
                    .eq('id', alert.id);

                if (updateErr) {
                    console.log(`  -> Erro ao atualizar ${alert.id}: ${updateErr.message}`);
                } else {
                    console.log(`  -> Atualizado ${alert.id}: ${finalScore}`);
                }
            }

            console.log(`  -> OK: ${finalScore} (${fixtureAlerts.length} alertas atualizados)`);
        } catch (err) {
            console.log(`  -> Erro: ${err.message}`);
        }

        // Aguardar 500ms entre fixtures para não sobrecarregar a API
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n=== REPARAÇÃO DAS ÚLTIMAS 24H CONCLUÍDA ===');
}

repairRecent();
