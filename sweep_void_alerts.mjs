import { createClient } from "@supabase/supabase-js";
import fs from 'fs';
import fetch from "node-fetch";

// Carregar .env manualmente
const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').filter(line => line.includes('=')).reduce((acc, line) => {
    const [key, ...rest] = line.split('='); acc[key.trim()] = rest.join('=').replace(/"/g, '').replace(/'/g, '').trim(); return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = envConfig.API_FOOTBALL_KEY;

if (!serviceRoleKey || !apiKey) {
    console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY ou API_FOOTBALL_KEY não encontrados no .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runSweep() {
    console.log("=== INICIANDO VARREDURA GLOBAL - REGRA VOID E PLACARES ===");

    // 1. Buscar todos os alertas que não são VOID e podem ter gol precoce
    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao buscar alertas:", error);
        return;
    }

    console.log(`Total de alertas encontrados: ${alerts.length}`);

    for (const alert of alerts) {
        let needsUpdate = false;
        let updateData = {};

        const goals = typeof alert.goal_events === 'string' ? JSON.parse(alert.goal_events) : (alert.goal_events || []);

        // Regra VOID: Se saiu gol antes do minuto 30
        const earlyGoal = goals.find(g => (g.minute + (g.extra || 0)) < 30);

        if (earlyGoal && alert.status !== 'VOID') {
            console.log(`[VOID] Jogo ${alert.fixture_id} (${alert.home_team} v ${alert.away_team}): Gol no minuto ${earlyGoal.minute}. Marcando como VOID.`);
            updateData.status = 'VOID';
            updateData.goal_ht_result = 'void';
            updateData.over15_result = 'void';
            needsUpdate = true;
        }

        // Corrigir placar se estiver pendente porem jogo acabou faz tempo (baseado em created_at > 4h)
        const isOld = new Date().getTime() - new Date(alert.created_at).getTime() > 4 * 60 * 60 * 1000;
        if (isOld && (!alert.final_score || alert.final_score === 'pending')) {
            console.log(`[SCORE] Jogo antigo ${alert.fixture_id} sem placar. Buscando na API...`);
            try {
                const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${alert.fixture_id}`, {
                    headers: { 'x-rapidapi-key': apiKey }
                });
                const json = await res.json();
                const f = json?.response?.[0];
                if (f && f.fixture.status.short === 'FT') {
                    const fs = `${f.goals.home}x${f.goals.away}`;
                    updateData.final_score = fs;

                    // Recalcular resultado baseado no placar final se necessário
                    if (updateData.status !== 'VOID') {
                        // Se não for void, verifica se houve gol na janela (30-70)
                        const windowGoals = (f.events || []).filter(e => e.type === 'Goal' && (e.time.elapsed >= 30 && e.time.elapsed <= 70));
                        updateData.status = windowGoals.length > 0 ? 'GREEN' : 'RED';
                    }
                    needsUpdate = true;
                }
            } catch (e) {
                console.error(`Falha ao buscar placar para ${alert.fixture_id}:`, e.message);
            }
        }

        if (needsUpdate) {
            await supabase.from('live_alerts').update(updateData).eq('id', alert.id);
            console.log(`Atualizado ID ${alert.id} com sucesso.`);
        }
    }

    console.log("=== VARREDURA CONCLUÍDA ===");
}

runSweep();
