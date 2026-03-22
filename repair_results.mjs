
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function repairResults() {
    console.log('--- Iniciando Reparo de Resultados (Data de Hoje: 2026-03-22) ---');
    
    const { data: pendingAlerts, error: fetchErr } = await supabase
        .from('live_alerts')
        .select('id, fixture_id, home_team, away_team, created_at')
        .is('final_score', null)
        .gte('created_at', '2026-03-19T00:00:00Z')
        .order('created_at', { ascending: false });

    if (fetchErr) {
        console.error('Erro ao buscar alertas pendentes:', fetchErr);
        return;
    }

    console.log(`Encontrados ${pendingAlerts.length} alertas pendentes desde 19/03.`);

    let updatedCount = 0;
    for (const alert of pendingAlerts) {
        const fixtureId = String(alert.fixture_id).trim();
        
        // 2. Buscar o jogo correspondente na tabela 'games'
        const { data: game, error: gameErr } = await supabase
            .from('games')
            .select('status, final_score_home, final_score_away')
            .eq('api_fixture_id', fixtureId)
            .maybeSingle();

        if (gameErr) {
            console.error(`Erro ao buscar jogo ${fixtureId}:`, gameErr.message);
            continue;
        }

        if (game) {
            if (game.status === 'Finished') {
                const finalScoreStr = `${game.final_score_home}x${game.final_score_away}`;
                
                // 3. Atualizar o alerta
                const { error: updateErr } = await supabase
                    .from('live_alerts')
                    .update({ 
                        final_score: finalScoreStr,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', alert.id);

                if (updateErr) {
                    console.error(`Erro ao atualizar alerta ${alert.id}:`, updateErr.message);
                } else {
                    console.log(`✅ [${alert.created_at}] ${alert.home_team} vs ${alert.away_team}: ${finalScoreStr}`);
                    updatedCount++;
                }
            } else {
                // console.log(`ℹ️ Fixture ${fixtureId} ainda está ${game.status}`);
            }
        } else {
            // console.log(`❌ Fixture ${fixtureId} não encontrado na tabela games`);
        }
    }

    console.log(`\n--- Reparo Concluído: ${updatedCount} alertas atualizados ---`);
}

repairResults();
