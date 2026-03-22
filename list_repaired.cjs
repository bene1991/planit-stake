const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function listRepaired() {
    console.log("=== LISTANDO ALERTAS REPARADOS (ESTRATÉGIA 30-70) ===\n");

    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('id, fixture_id, home_team, away_team, goal_ht_result, final_score, goal_events, created_at')
        .not('goal_ht_result', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error("Erro ao buscar alertas:", error);
        return;
    }

    if (!alerts || alerts.length === 0) {
        console.log("Nenhum alerta encontrado.");
        return;
    }

    console.log("ID | Fixture | Jogo | Resultado | Gols (30'-70') | Placar Final");
    console.log("-".repeat(80));

    alerts.forEach(a => {
        let goals = a.goal_events;
        if (typeof goals === 'string') {
            try { goals = JSON.parse(goals); } catch (e) { goals = []; }
        }
        if (!Array.isArray(goals)) goals = [];

        const allGoals = goals
            .map(g => {
                const m = g.minute !== undefined ? g.minute : g.time;
                const inWindow = m >= 30 && m <= 70;
                return inWindow ? `[${m}']` : `${m}'`;
            })
            .join(', ');

        const resDisplay = a.goal_ht_result === 'green' ? '✅ GREEN' : '❌ RED';
        
        console.log(`${a.id.substring(0,8)} | ${String(a.fixture_id).padEnd(8)} | ${(a.home_team + ' x ' + a.away_team).padEnd(35)} | ${resDisplay.padEnd(8)} | ${allGoals.padEnd(20)} | ${a.final_score}`);
    });

    console.log("\nTotal listagem: " + alerts.length);
}

listRepaired();
