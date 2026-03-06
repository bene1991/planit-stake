require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const supabase = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Get alerts from today
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    
    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('*')
        .gte('created_at', startOfDay.toISOString());
        
    if (error) {
        console.error("Supabase Error:", error);
        return;
    }
    
    console.log(`Foram encontrados ${alerts.length} alertas do dia de hoje. Iniciando reenvio de todo o fluxo (Sinais e Resultados)...`);
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = "-1003715464150"; // Fixado para o ID que vi testado com sucesso
    
    for (const alert of alerts) {
        const hTeam = alert.home_team;
        const aTeam = alert.away_team;
        const lName = alert.league_name;
        const tElapsed = alert.minute_at_alert;
        const stats = alert.stats_snapshot || { h: { xg: 0, corners: 0, shotsInBox: 0, shots: 0, shotsOn: 0, possession: 0 }, a: { xg: 0, corners: 0, shotsInBox: 0, shots: 0, shotsOn: 0, possession: 0 } };
        
        // 1. Sinal Inicial
        const matchUrl = `https://bolsadeaposta.bet.br/b/exchange?q=${encodeURIComponent(hTeam)}`;
        const textSinal = `🤖 <b>ROBÔ AO VIVO (REPLAY)</b>\n\n⚽ <b>${hTeam} vs ${aTeam}</b>\n🏆 ${lName}\n⏰ ${tElapsed}'\n🔥 Filtros: <b>${alert.variation_name}</b>\n\n📊 <b>STATS DO MINUTO ${tElapsed}'</b>\nxG: ${stats.h.xg || 0}-${stats.a.xg || 0}\nEscanteios: ${stats.h.corners || 0}-${stats.a.corners || 0}\nChutes na Área: ${stats.h.shotsInBox || 0}-${stats.a.shotsInBox || 0}\nTotal Chutes: ${stats.h.shots || 0}-${stats.a.shots || 0}\nNo Alvo: ${stats.h.shotsOn || 0}-${stats.a.shotsOn || 0}\nPosse: ${stats.h.possession || 0}%-${stats.a.possession || 0}%\n\n👉 <a href="${matchUrl}">Abrir na Bolsa de Aposta</a>`;
        
        try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: textSinal, parse_mode: 'HTML', disable_web_page_preview: true })
            });
            console.log(`[SINAL] ${hTeam} v ${aTeam} Enviado.`);
        } catch(e) { console.error(e) }
        await new Promise(r => setTimeout(r, 1000));
        
        // 2. Resultado HT
        if (alert.goal_ht_result === 'green' || alert.goal_ht_result === 'red') {
            const emoji = alert.goal_ht_result === 'green' ? '✅' : '❌';
            const label = alert.goal_ht_result === 'green' ? 'GREEN' : 'RED';
            const msgHT = `${emoji} <b>ROBÔ: ${label}!</b>\n\n⚽ <b>${hTeam} vs ${aTeam}</b>\n🏆 ${lName}\n📊 Mercado: <b>Gol no 1T</b>\n🎯 Filtro: ${alert.variation_name}\n🏁 Placar: <b>${alert.final_score || 'HT'}</b>\n\n<i>(Enviado via Replay)</i>`;
            
            try {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: msgHT, parse_mode: 'HTML' })
                });
                console.log(`[HT ${label}] ${hTeam} v ${aTeam} Enviado.`);
            } catch(e) { console.error(e) }
            await new Promise(r => setTimeout(r, 1000));
        }
        
        // 3. Resultado FT (Over 1.5)
        if (alert.over15_result === 'green' || alert.over15_result === 'red') {
            const emoji = alert.over15_result === 'green' ? '✅' : '❌';
            const label = alert.over15_result === 'green' ? 'GREEN' : 'RED';
            const msg15 = `${emoji} <b>ROBÔ: ${label}!</b>\n\n⚽ <b>${hTeam} vs ${aTeam}</b>\n🏆 ${lName}\n📊 Mercado: <b>Over 1.5</b>\n🎯 Filtro: ${alert.variation_name}\n🏁 Placar: <b>${alert.final_score || 'FT'}</b>\n\n<i>(Enviado via Replay)</i>`;
            
            try {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: msg15, parse_mode: 'HTML' })
                });
                console.log(`[FT ${label}] ${hTeam} v ${aTeam} Enviado.`);
            } catch(e) { console.error(e) }
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    console.log("Concluido! Todos os alertas de hoje foram despachados.");
}
main();
