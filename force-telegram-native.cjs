const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) acc[match[1].trim()] = match[2].trim().replace(/['"]/g, '');
    return acc;
}, {});

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_TOKEN = env.TELEGRAM_BOT_TOKEN;
const DEST_CHAT_ID = env.TELEGRAM_CHAT_ID || "-1003715464150";

async function main() {
    console.log("Extraindo Alertas Direto do Supabase via API HTTP...");
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/live_alerts?created_at=gte.${startOfDay.toISOString()}`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    const data = await res.json();
    console.log(`Foi encontrado o total de ${data.length} eventos do dia hoje no banco de dados. Processando o ping...`);

    let sent = 0;
    for (const alert of data) {
         const hTeam = alert.home_team;
         const aTeam = alert.away_team;
         const lName = alert.league_name;
         const tElapsed = alert.minute_at_alert;
         const stats = alert.stats_snapshot || { h: { xg: 0, corners: 0, shotsInBox: 0, shots: 0, shotsOn: 0, possession: 0 }, a: { xg: 0, corners: 0, shotsInBox: 0, shots: 0, shotsOn: 0, possession: 0 } };
         
         const matchUrl = `https://bolsadeaposta.bet.br/b/exchange?q=${encodeURIComponent(hTeam)}`;
         const textSinal = `🤖 <b>ROBÔ AO VIVO (REPLAY DE HOJE)</b>\n\n⚽ <b>${hTeam} vs ${aTeam}</b>\n🏆 ${lName}\n⏰ ${tElapsed}'\n🔥 Filtros: <b>${alert.variation_name}</b>\n\n📊 <b>STATS DO MINUTO ${tElapsed}'</b>\nxG: ${stats.h.xg || 0}-${stats.a.xg || 0}\nEscanteios: ${stats.h.corners || 0}-${stats.a.corners || 0}\nChutes na Área: ${stats.h.shotsInBox || 0}-${stats.a.shotsInBox || 0}\nTotal Chutes: ${stats.h.shots || 0}-${stats.a.shots || 0}\nNo Alvo: ${stats.h.shotsOn || 0}-${stats.a.shotsOn || 0}\nPosse: ${stats.h.possession || 0}%-${stats.a.possession || 0}%\n\n👉 <a href="${matchUrl}">Abrir na Bolsa de Aposta</a>`;
         
         try {
             await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                 method: 'POST', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ chat_id: DEST_CHAT_ID, text: textSinal, parse_mode: 'HTML', disable_web_page_preview: true })
             });
             sent++;
             console.log(`[+] Envio Sinal: ${hTeam} v ${aTeam} Emitido!`);
         } catch(e) {}
         await new Promise(r => setTimeout(r, 600)); // Rate limit margin
         
         // HT Result
         if (alert.goal_ht_result === 'green' || alert.goal_ht_result === 'red') {
            const emoji = alert.goal_ht_result === 'green' ? '✅' : '❌';
            const label = alert.goal_ht_result === 'green' ? 'GREEN' : 'RED';
            const msgHT = `${emoji} <b>ROBÔ: ${label} (REPLAY)!</b>\n\n⚽ <b>${hTeam} vs ${aTeam}</b>\n🏆 ${lName}\n📊 Mercado: <b>Gol no 1T</b>\n🎯 Filtro: ${alert.variation_name}\n🏁 Placar: <b>${alert.final_score || 'HT'}</b>`;
            try {
                await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: DEST_CHAT_ID, text: msgHT, parse_mode: 'HTML' })
                });
                sent++;
                console.log(`[+] Resultado HT ${label}: ${hTeam} v ${aTeam} Emitido!`);
            } catch(e){}
            await new Promise(r => setTimeout(r, 600));
         }
         
         // 1.5 Result
         if (alert.over15_result === 'green' || alert.over15_result === 'red') {
            const emoji = alert.over15_result === 'green' ? '✅' : '❌';
            const label = alert.over15_result === 'green' ? 'GREEN' : 'RED';
            const msg15 = `${emoji} <b>ROBÔ: ${label} (REPLAY)!</b>\n\n⚽ <b>${hTeam} vs ${aTeam}</b>\n🏆 ${lName}\n📊 Mercado: <b>Over 1.5</b>\n🎯 Filtro: ${alert.variation_name}\n🏁 Placar: <b>${alert.final_score || 'FT'}</b>`;
            try {
                await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: DEST_CHAT_ID, text: msg15, parse_mode: 'HTML' })
                });
                sent++;
                console.log(`[+] Resultado FT ${label}: ${hTeam} v ${aTeam} Emitido!`);
            } catch(e){}
            await new Promise(r => setTimeout(r, 600));
         }
    }
    console.log(`==== TODOS OS ENVIOS FORAM CONCLUÍDOS. TOTAL DE PACOTES ENTREGUES: ${sent} ====`);
}

main().catch(console.error);
