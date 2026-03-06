const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function run() {
    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Ultimos 60 minutos
    const timeAgo = new Date();
    timeAgo.setMinutes(timeAgo.getMinutes() - 100);

    const { data: alerts, error } = await supabaseAdmin
        .from('live_alerts')
        .select('*')
        .gte('created_at', timeAgo.toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro banco:", error);
        return;
    }
    if (!alerts || alerts.length === 0) {
        console.log("Sem alertas no tempo delimitado");
        return;
    }

    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    let targetChatId = telegramChatId;
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, telegram_chat_id');

    let sentCount = 0;
    for (const alert of alerts) {
        const stats = alert.stats_snapshot;
        if (!stats) continue;
        const hTeam = alert.home_team;
        const aTeam = alert.away_team;
        const lName = alert.league_name;
        const tElapsed = alert.minute_at_alert;

        const matchUrl = `https://bolsadeaposta.bet.br/b/exchange?q=${encodeURIComponent(hTeam)}`;
        const text = `🤖 <b>ROBÔ AO VIVO (REPLAY)</b>\n\n⚽ <b>${hTeam} vs ${aTeam}</b>\n🏆 ${lName}\n⏰ ${tElapsed}'\n🔥 Filtros: <b>${alert.variation_name}</b>\n\n📊 <b>STATS DO MINUTO ${tElapsed}'</b>\nxG: ${stats.h.xg}-${stats.a.xg}\nEscanteios: ${stats.h.corners}-${stats.a.corners}\nChutes na Área: ${stats.h.shotsInBox}-${stats.a.shotsInBox}\nTotal Chutes: ${stats.h.shots}-${stats.a.shots}\nNo Alvo: ${stats.h.shotsOn}-${stats.a.shotsOn}\nPosse: ${stats.h.possession}%-${stats.a.possession}%\n\n👉 <a href="${matchUrl}">Abrir na Bolsa de Aposta</a>`;

        const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
        for (const prof of profiles || [{ telegram_chat_id: targetChatId }]) {
            if (prof.telegram_chat_id) {
                try {
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: prof.telegram_chat_id,
                            text: text,
                            parse_mode: 'HTML'
                        })
                    });
                    if (resp.ok) {
                        sentCount++;
                    } else {
                        const errTxt = await resp.text();
                        console.error("Telegram error:", errTxt);
                    }
                } catch (e) { console.error("error sending", e) }
            }
        }
    }
    console.log(`Sucesso. ${sentCount} msgs despachadas pro Telegram.`);
}

run();
