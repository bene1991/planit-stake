import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const timeAgo = new Date();
    timeAgo.setHours(timeAgo.getHours() - 24);

    const { data: alerts, error } = await supabaseAdmin
        .from('live_alerts')
        .select('*')
        .gte('created_at', timeAgo.toISOString())
        .order('created_at', { ascending: false });

    if (!alerts || alerts.length === 0) return process.exit(0);

    const { data: profiles } = await supabaseAdmin.from('settings').select('telegram_chat_id').not('telegram_chat_id', 'is', null).limit(1);
    const targetChatId = (profiles && profiles.length > 0) ? profiles[0].telegram_chat_id : process.env.TELEGRAM_CHAT_ID;
    
    for (const alert of alerts) {
         try {
             // 1. Initial Signal
             if (alert.stats_snapshot) {
                 const matchUrl = `https://bolsadeaposta.bet.br/b/exchange?q=${encodeURIComponent(alert.home_team)}`;
                 const text = `🤖 <b>ROBÔ AO VIVO (REPLAY 24H)</b>\n\n⚽ <b>${alert.home_team} vs ${alert.away_team}</b>\n🏆 ${alert.league_name}\n⏰ ${alert.minute_at_alert}'\n🔥 Filtros: <b>${alert.variation_name}</b>\n\n👉 <a href="${matchUrl}">Abrir na Bolsa de Aposta</a>`;
                 await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                     method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: targetChatId, text: text, parse_mode: 'HTML' })
                 });
             }
             
             // 2. HTTP Call to resolve
             if (alert.goal_ht_result !== 'pending') {
                 const msgHT = `${alert.goal_ht_result==='green'?'✅':'❌'} <b>ROBÔ: ${alert.goal_ht_result.toUpperCase()} (REPLAY)!</b>\n\n⚽ <b>${alert.home_team} vs ${alert.away_team}</b>\n📊 Mercado: <b>Gol no 1T</b>\n🎯 Filtro: ${alert.variation_name}`;
                 await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                     method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: targetChatId, text: msgHT, parse_mode: 'HTML' })
                 });
             }
         } catch(e) {}
    }
}
run();
