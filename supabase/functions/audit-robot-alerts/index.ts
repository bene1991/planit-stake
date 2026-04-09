import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function callApiFootball(endpoint: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/api-football`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ endpoint, ...params }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function sendTelegram(botToken: string, chatId: string, message: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('Telegram Send Error:', e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting Audit Robot Alerts...');

    // 1. Fetch active variations
    const { data: variations, error: varErr } = await supabase
      .from('robot_variations')
      .select('*')
      .eq('active', true);
    if (varErr) throw varErr;

    // 2. Fetch live fixtures (same method as main robot)
    const data = await callApiFootball('fixtures?live=all');
    const fixtures = data?.response || [];
    console.log(`Auditing ${fixtures.length} live fixtures against ${variations.length} variations.`);

    const auditFindings = [];

    // 3. Main Audit Loop
    for (const f of fixtures) {
      const fixtureId = String(f.fixture.id);
      const timeElapsed = f.fixture.status.elapsed;
      
      if (timeElapsed < 5 || timeElapsed > 95) continue;

      // Check if this fixture SHOULD have triggered any variation
      // We need stats for this
      let statsData;
      try {
        statsData = await callApiFootball('fixtures/statistics', { fixture: fixtureId });
      } catch (e) { continue; }

      const rawStats = statsData?.response || [];
      if (rawStats.length < 2) continue;

      const extractStat = (teamStats: any[], type: string) => {
        const item = teamStats?.find(s => s.type === type);
        return item?.value ? parseInt(item.value.toString().replace('%', '')) : 0;
      };

      const hStats = rawStats[0]?.statistics;
      const aStats = rawStats[1]?.statistics;
      const currentStats = {
        h: { shots: extractStat(hStats, 'Shots on Goal') + extractStat(hStats, 'Shots off Goal'), shotsOn: extractStat(hStats, 'Shots on Goal'), attacks: extractStat(hStats, 'Dangerous Attacks'), possession: extractStat(hStats, 'Ball Possession'), goals: f.goals.home || 0 },
        a: { shots: extractStat(aStats, 'Shots on Goal') + extractStat(aStats, 'Shots off Goal'), shotsOn: extractStat(aStats, 'Shots on Goal'), attacks: extractStat(aStats, 'Dangerous Attacks'), possession: extractStat(aStats, 'Ball Possession'), goals: f.goals.away || 0 }
      };

      for (const v of variations) {
        if (timeElapsed < v.min_minute || timeElapsed > v.max_minute) continue;
        if (v.require_score_zero && (currentStats.h.goals > 0 || currentStats.a.goals > 0)) continue;
        if (v.max_goals !== null && (currentStats.h.goals + currentStats.a.goals) > v.max_goals) continue;

        const combinedShots = currentStats.h.shots + currentStats.a.shots;
        const combinedShotsOn = currentStats.h.shotsOn + currentStats.a.shotsOn;
        
        // Audit simpler logic (snapshot-less for now to avoid complexity in audit)
        // If it satisfies snap-less, it's a strong candidate for an alert that might have failed
        const shotsOk = combinedShots >= (v.min_shots || 0) && combinedShotsOn >= (v.min_shots_on_target || 0);
        const pressureOk = currentStats.h.possession >= (v.min_possession || 0) || currentStats.a.possession >= (v.min_possession || 0);
        
        if (shotsOk && pressureOk) {
          // Check if alert exists in live_alerts
          const { data: existingAlert } = await supabase
            .from('live_alerts')
            .select('id')
            .eq('fixture_id', fixtureId)
            .eq('variation_id', v.id)
            .maybeSingle();

          if (!existingAlert) {
            // Check if it was discarded in logs
            const { data: logEntry } = await supabase
              .from('robot_execution_logs')
              .select('*')
              .eq('fixture_id', fixtureId)
              .eq('variation_id', v.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            auditFindings.push({
              fixture: `${f.teams.home.name} vs ${f.teams.away.name}`,
              fixtureId,
              variation: v.name,
              reason: logEntry ? `Logged as ${logEntry.stage}: ${logEntry.reason}` : 'No log found',
              stats: currentStats
            });
          }
        }
      }
    }

    if (auditFindings.length > 0) {
      const { data: settings } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (settings?.telegram_bot_token && settings?.telegram_chat_id) {
        let report = `🔎 <b>RELATÓRIO DE AUDITORIA</b>\n\n`;
        auditFindings.slice(0, 5).forEach(f => {
          report += `❌ <b>ALERTA AUSENTE:</b> ${f.fixture}\n`;
          report += `⭐ Variação: ${f.variation}\n`;
          report += `📝 Motivo: ${f.reason}\n\n`;
        });
        if (auditFindings.length > 5) report += `<i>... e mais ${auditFindings.length - 5} discrepâncias.</i>`;
        
        await sendTelegram(settings.telegram_bot_token, settings.telegram_chat_id, report);
      }
    }

    return new Response(JSON.stringify({ status: 'ok', findings: auditFindings.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Audit Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
