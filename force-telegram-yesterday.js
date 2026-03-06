import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("Iniciando varredura das ultimas 24h...");
    const timeAgo = new Date();
    timeAgo.setHours(timeAgo.getHours() - 24);

    const { data: alerts, error } = await supabaseAdmin
        .from('live_alerts')
        .select('*')
        .gte('created_at', timeAgo.toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro no banco:", error);
        return;
    }
    if (!alerts || alerts.length === 0) {
        console.log("Nenhum alerta nas últimas 24h.");
        return;
    }
    
    console.log(`Encontrados ${alerts.length} alertas. Preparando disparos...`);

    const { data: profiles } = await supabaseAdmin.from('settings').select('telegram_chat_id').not('telegram_chat_id', 'is', null).limit(1);
    const targetChatId = (profiles && profiles.length > 0) ? profiles[0].telegram_chat_id : TELEGRAM_CHAT_ID;
    
    console.log("Chat de destino:", targetChatId);

    let sentSignals = 0;
    
    // Dispara alertas iniciais
    for (const alert of alerts) {
         const stats = alert.stats_snapshot;
         if (!stats) continue;
         const hTeam = alert.home_team;
         const aTeam = alert.away_team;
         const lName = alert.league_name;
         const tElapsed = alert.minute_at_alert;

         const matchUrl = `https://bolsadeaposta.bet.br/b/exchange?q=${encodeURIComponent(hTeam)}`;
         const text = `🤖 <b>ROBÔ AO VIVO (REPLAY 24H)</b>\n\n⚽ <b>${hTeam} vs ${aTeam}</b>\n🏆 ${lName}\n⏰ ${tElapsed}'\n🔥 Filtros: <b>${alert.variation_name}</b>\n\n📊 <b>STATS DO MINUTO ${tElapsed}'</b>\nxG: ${stats.h.xg}-${stats.a.xg}\nEscanteios: ${stats.h.corners}-${stats.a.corners}\nChutes na Área: ${stats.h.shotsInBox}-${stats.a.shotsInBox}\nTotal Chutes: ${stats.h.shots}-${stats.a.shots}\nNo Alvo: ${stats.h.shotsOn}-${stats.a.shotsOn}\nPosse: ${stats.h.possession}%-${stats.a.possession}%\n\n👉 <a href="${matchUrl}">Abrir na Bolsa de Aposta</a>`;

         const url = `https://api.telegram.org/bot8715635573:AAFTwdEYLnfp5Ncbme73QaKzjlFvY28LWuM/sendMessage`;
         try {
             const resp = await fetch(url, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ chat_id: targetChatId, text: text, parse_mode: 'HTML' })
             });
             if (resp.ok) sentSignals++;
         } catch(e) {}
         // Aguarda meio segundo pra não tomar rate limit
         await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`Sucesso. ${sentSignals} Alertas de Robô (Iniciais) recriados pro Telegram.`);
    
    // Envia RESOLVERS (Greens e Reds) de hoje
    let sentResolvers = 0;
    for (const alert of alerts) {
        const isHTFinished = alert.goal_ht_result !== 'pending';
        const is15Finished = alert.over15_result !== 'pending';
        
        if (isHTFinished) {
            const emoji = alert.goal_ht_result === 'green' ? '✅' : '❌';
            const label = alert.goal_ht_result === 'green' ? 'GREEN' : 'RED';
            const msgHT = `${emoji} <b>ROBÔ: ${label} (REPLAY)!</b>\n\n⚽ <b>${alert.home_team} vs ${alert.away_team}</b>\n🏆 ${alert.league_name}\n📊 Mercado: <b>Gol no 1T</b>\n🎯 Filtro: ${alert.variation_name}\n🏁 Placar: <b>${alert.final_score || 'HT Completo'}</b>`;
            
            try {
                await fetch(`https://api.telegram.org/bot8715635573:AAFTwdEYLnfp5Ncbme73QaKzjlFvY28LWuM/sendMessage`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ chat_id: targetChatId, text: msgHT, parse_mode: 'HTML' })
                });
                sentResolvers++;
                await new Promise(r => setTimeout(r, 500));
            } catch(e) {}
        }
        
        if (is15Finished) {
            const emoji = alert.over15_result === 'green' ? '✅' : '❌';
            const label = alert.over15_result === 'green' ? 'GREEN' : 'RED';
            const msg15 = `${emoji} <b>ROBÔ: ${label} (REPLAY)!</b>\n\n⚽ <b>${alert.home_team} vs ${alert.away_team}</b>\n🏆 ${alert.league_name}\n📊 Mercado: <b>Over 1.5</b>\n🎯 Filtro: ${alert.variation_name}\n🏁 Placar: <b>${alert.final_score || 'FT'}</b>`;
            
            try {
                await fetch(`https://api.telegram.org/bot8715635573:AAFTwdEYLnfp5Ncbme73QaKzjlFvY28LWuM/sendMessage`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ chat_id: targetChatId, text: msg15, parse_mode: 'HTML' })
                });
                sentResolvers++;
                await new Promise(r => setTimeout(r, 500));
            } catch(e) {}
        }
    }
    
    console.log(`Sucesso. ${sentResolvers} Avisos de Green/Red recriados pro Telegram.`);
}

run();
