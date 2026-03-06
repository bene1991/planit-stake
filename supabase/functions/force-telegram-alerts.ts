import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Ultimos 60 minutos
        const timeAgo = new Date();
        timeAgo.setMinutes(timeAgo.getMinutes() - 60);

        const { data: alerts, error } = await supabaseAdmin
            .from('live_alerts')
            .select('*')
            .gte('created_at', timeAgo.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!alerts || alerts.length === 0) return new Response(JSON.stringify({msg: "Sem alertas no tempo delimitado"}));

        const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        const telegramChatId = "-1002334812301"; // Default chat ID, let's also fetch from profile.
        
        let targetChatId = Deno.env.get('TELEGRAM_CHAT_ID') || telegramChatId;
        
        const { data: profiles } = await supabaseAdmin.from('profiles').select('id, telegram_chat_id');
        if (profiles && profiles.length > 0 && profiles[0].telegram_chat_id) {
            targetChatId = profiles[0].telegram_chat_id;
        }

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
             for (const prof of profiles || [{telegram_chat_id: targetChatId}]) {
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
                     } catch(e) { console.error("error sending", e) }
                 }
             }
        }

        return new Response(JSON.stringify({ status: 'ok', sent: sentCount }), { headers: corsHeaders, status: 200 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
})
