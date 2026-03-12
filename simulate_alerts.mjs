
import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxruR8yWA91z_vnHKGBgB5C6_M8yIXXdtMPz8I2EiV777QlA6iIDfEH2_QyVyMYp74E/exec';

async function send(payload) {
    console.log(`\n--- ENVIANDO AÇÃO: ${payload.action} ---`);
    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Resposta: ${text}`);
    } catch (err) {
        console.error('Erro no fetch:', err);
    }
}

// CONFIGURAÇÃO DOS TESTES
const TEST_FIXTURE_ID = "test_" + Math.floor(Math.random() * 1000000);
const HOJE = new Date().toLocaleDateString('pt-BR');

async function runTests() {
    // 1. SIMULAR NOVO ALERTA (idêntico ao live-robot-cron-v2)
    await send({
        action: 'NEW_ALERT',
        date: HOJE,
        match: 'Bahia vs Vitoria',
        league: 'Serie A',
        method: 'Pose 70% Free Fire (SIMULADO)',
        alertMinute: '15',
        fixtureId: TEST_FIXTURE_ID
    });

    console.log("\nEspere 5 segundos. Verifique se apareceu na planilha...");
    await new Promise(r => setTimeout(r, 5000));

    // 2. SIMULAR GREEN HT (idêntico ao live-alerts-resolver-v2)
    await send({
        action: 'UPDATE_ALERT',
        fixtureId: TEST_FIXTURE_ID,
        goalsInterval: "15'",
        finalScore: '1x0 (HT)',
        result: 'GREEN'
    });

    console.log("\nEspere 5 segundos. Verifique se o GREEN HT apareceu...");
    await new Promise(r => setTimeout(r, 5000));

    // 3. SIMULAR RED FT (idêntico ao live-alerts-resolver-v2)
    await send({
        action: 'UPDATE_ALERT',
        fixtureId: TEST_FIXTURE_ID,
        goalsInterval: "15'",
        finalScore: '1x0',
        result: 'RED'
    });

    console.log("\nEspere 5 segundos. Iniciando simulação de VOID...");
    await new Promise(r => setTimeout(r, 5000));

    // 4. SIMULAR VOID
    const VOID_ID = "void_" + Math.floor(Math.random() * 1000000);
    await send({
        action: 'NEW_ALERT',
        date: HOJE,
        match: 'Jogo Adiado FC vs Cancelado United',
        league: 'Liga Teste',
        method: 'Estratégia Void',
        alertMinute: '1',
        fixtureId: VOID_ID
    });

    await new Promise(r => setTimeout(r, 2000));

    await send({
        action: 'UPDATE_ALERT',
        fixtureId: VOID_ID,
        goalsInterval: "-",
        finalScore: "0x0",
        result: 'VOID'
    });

    console.log("\nSimulações Finalizadas.");
}

runTests();
