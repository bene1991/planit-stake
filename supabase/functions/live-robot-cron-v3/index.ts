import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

async function callApiFootball(endpoint: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/api-football`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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

interface LogEntry {
  fixture_id: string;
  league_id: string;
  variation_id?: string;
  stage: 'DISCARDED_PRE_FILTER' | 'FROZEN_API' | 'VARIATION_EVALUATION' | 'ALERT_COOLDOWN' | 'ALERT_SENT';
  reason: string;
  details: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const logsBuffer: LogEntry[] = [];
  const addLog = (entry: LogEntry) => logsBuffer.push(entry);

  try {
    console.log('Starting Live Robot Execution (v4 - Parallel Optimized)...');

    // 1. Fetch blocked leagues
    const { data: blockedLeagues, error: blockErr } = await supabase
      .from('robot_blocked_leagues')
      .select('league_id')
      .eq('active', true);
    if (blockErr) throw blockErr;
    const blockedSet = new Set(blockedLeagues?.map(l => String(l.league_id)) || []);

    // 2. Fetch active variations (with joined groups)
    const { data: variations, error: varErr } = await supabase
      .from('robot_variations')
      .select('*, telegram_groups(*)')
      .eq('active', true);
    if (varErr) throw varErr;
    if (!variations || variations.length === 0) {
      console.log('No active variations. Exiting.');
      return new Response(JSON.stringify({ status: 'No active variations' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Fetch Telegram Settings
    const { data: settings } = await supabase
      .from('settings')
      .select('owner_id, telegram_bot_token, telegram_chat_id');
    const settingsMap = new Map();
    settings?.forEach(s => {
      if (s.telegram_bot_token && s.telegram_chat_id) {
        settingsMap.set(s.owner_id, s);
      }
    });

    // 4. Fetch Live Fixtures
    let fixtures = [];
    try {
      const data = await callApiFootball('fixtures?live=all');
      fixtures = data?.response || [];
    } catch (e) {
      console.error('Failed to fetch live fixtures:', e);
    }
    console.log(`Fetched ${fixtures.length} live fixtures.`);

    // 5. Processing Loop (Parallelized)
    const BATCH_SIZE = 5;
    for (let i = 0; i < fixtures.length; i += BATCH_SIZE) {
      const batch = fixtures.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (f: any) => {
        const fixtureId = String(f.fixture.id);
        const leagueId = String(f.league.id);
        if (blockedSet.has(leagueId)) return;

        const timeElapsed = f.fixture.status.elapsed;
        if (timeElapsed < 0 || timeElapsed > 95) return;

        // Fetch precise stats
        let statsData;
        try {
          statsData = await callApiFootball('fixtures/statistics', { fixture: fixtureId });
        } catch (e) { 
          console.error(`Error fetching stats for ${fixtureId}:`, e); 
          return; 
        }

        const rawStats = statsData?.response || [];
        if (rawStats.length < 2) return;

        const extractStat = (teamStats: any[], type: string) => {
          const item = teamStats?.find(s => s.type === type);
          return item?.value ? parseFloat(item.value.toString().replace('%', '')) : 0;
        };

        const hStats = rawStats[0]?.statistics;
        const aStats = rawStats[1]?.statistics;
        const getShots = (stats: any[]) => {
          const totalReported = extractStat(stats, 'Total Shots');
          if (totalReported > 0) return totalReported;
          return extractStat(stats, 'Shots on Goal') + extractStat(stats, 'Shots off Goal') + extractStat(stats, 'Blocked Shots');
        };

        const currentStats = {
          h: { 
            shots: getShots(hStats), 
            shotsOn: extractStat(hStats, 'Shots on Goal'), 
            xg: extractStat(hStats, 'Expected Goals'),
            corners: extractStat(hStats, 'Corner Kicks'),
            shotsInBox: extractStat(hStats, 'Shots insidebox'),
            attacks: extractStat(hStats, 'Dangerous Attacks'), 
            possession: extractStat(hStats, 'Ball Possession'), 
            goals: f.goals.home || 0 
          },
          a: { 
            shots: getShots(aStats), 
            shotsOn: extractStat(aStats, 'Shots on Goal'), 
            xg: extractStat(aStats, 'Expected Goals'),
            corners: extractStat(aStats, 'Corner Kicks'),
            shotsInBox: extractStat(aStats, 'Shots insidebox'),
            attacks: extractStat(aStats, 'Dangerous Attacks'), 
            possession: extractStat(aStats, 'Ball Possession'), 
            goals: f.goals.away || 0 
          }
        };

        // Snapshot & Delta logic
        await supabase.from('live_stats_snapshots').insert({ fixture_id: fixtureId, minute: timeElapsed, stats_json: currentStats });
        const targetMin = timeElapsed - 10;
        const { data: oldSnap } = await supabase.from('live_stats_snapshots').select('stats_json').eq('fixture_id', fixtureId).lte('minute', targetMin + 2).gte('minute', targetMin - 2).order('minute', { ascending: false }).limit(1);

        const oldStats = oldSnap?.[0]?.stats_json;
        const diff = (a: number, b: number) => Math.max(0, a - b);
        const delta = oldStats 
          ? { h: { shots: diff(currentStats.h.shots, oldStats.h.shots), shotsOn: diff(currentStats.h.shotsOn, oldStats.h.shotsOn), attacks: diff(currentStats.h.attacks, oldStats.h.attacks) }, a: { shots: diff(currentStats.a.shots, oldStats.a.shots), shotsOn: diff(currentStats.a.shotsOn, oldStats.a.shotsOn), attacks: diff(currentStats.a.attacks, oldStats.a.attacks) } }
          : { h: { shots: 0, shotsOn: 0, attacks: 0 }, a: { shots: 0, shotsOn: 0, attacks: 0 } };

        // Variation Loop
        const triggeredVars = [];
        const combinedShots = currentStats.h.shots + currentStats.a.shots;
        const combinedShotsOn = currentStats.h.shotsOn + currentStats.a.shotsOn;

        for (const v of variations) {
          if (timeElapsed < v.min_minute || timeElapsed > v.max_minute) continue;
          if (v.require_score_zero && (currentStats.h.goals > 0 || currentStats.a.goals > 0)) continue;
          if (!oldStats && (v.min_dangerous_attacks > 0 || v.pressure_1 > 0 || v.pressure_2 > 0)) continue;
          if (v.max_goals !== null && v.max_goals !== undefined && (currentStats.h.goals + currentStats.a.goals) > v.max_goals) continue;

          if (v.pressure_1 > 0 && delta.h.attacks < v.pressure_1) continue;
          if (v.pressure_2 > 0 && delta.a.attacks < v.pressure_2) continue;

          const hDom = delta.h.attacks >= delta.a.attacks;
          const dom = hDom ? delta.h : delta.a;
          const domPoss = hDom ? currentStats.h.possession : currentStats.a.possession;

          const minShots = v.min_shots || 0;
          const minShotsOn = v.min_shots_on_target || 0;
          const minCorners = v.min_corners || 0;
          const minShotsInBox = v.min_shots_insidebox || 0;

          const minDangerous = v.min_dangerous_attacks || 0;
          const minPoss = v.min_possession || 0;
          const minCombined = v.min_combined_shots || 0;

          const hMatch = currentStats.h.shots >= minShots && 
                         currentStats.h.corners >= minCorners &&
                         currentStats.h.shotsInBox >= minShotsInBox;

          const aMatch = currentStats.a.shots >= minShots && 
                         currentStats.a.shotsOn >= minShotsOn && // Still optional if he wants strictly shots as individual
                         currentStats.a.corners >= minCorners &&
                         currentStats.a.shotsInBox >= minShotsInBox;

          const ok = (hMatch || aMatch) &&
                     combinedShotsOn >= minShotsOn &&
                     dom.attacks >= minDangerous && 
                     domPoss >= minPoss &&
                     combinedShots >= minCombined;

          if (ok) {
            triggeredVars.push(v);
          } else {
            let failReason = `Filtro ${v.name} não atingido (Híbrido Individual/Soma): `;
            const fails = [];
            
            const hFails = [];
            if (currentStats.h.shots < minShots) hFails.push(`S(${currentStats.h.shots}/${minShots})`);
            if (currentStats.h.corners < (v.min_corners || 0)) hFails.push(`C(${currentStats.h.corners}/${v.min_corners})`);
            if (currentStats.h.shotsInBox < (v.min_shots_insidebox || 0)) hFails.push(`IB(${currentStats.h.shotsInBox}/${v.min_shots_insidebox})`);

            const aFails = [];
            if (currentStats.a.shots < minShots) aFails.push(`S(${currentStats.a.shots}/${minShots})`);
            if (currentStats.a.corners < (v.min_corners || 0)) aFails.push(`C(${currentStats.a.corners}/${v.min_corners})`);
            if (currentStats.a.shotsInBox < (v.min_shots_insidebox || 0)) aFails.push(`IB(${currentStats.a.shotsInBox}/${v.min_shots_insidebox})`);

            if (hFails.length > 0 && aFails.length > 0) {
                fails.push(`Pressão Individual (F)`);
            }
            
            if (combinedShotsOn < minShotsOn) fails.push(`No Alvo Somado (${combinedShotsOn}/${minShotsOn})`);
            if (dom.attacks < minDangerous) fails.push(`Ataques Perigosos (${dom.attacks}/${minDangerous})`);
            if (domPoss < minPoss) fails.push(`Posse (${domPoss}%/${minPoss}%)`);
            if (combinedShots < minCombined) fails.push(`Volume Total (${combinedShots}/${minCombined})`);

            addLog({
              fixture_id: fixtureId,
              league_id: leagueId,
              variation_id: v.id,
              stage: 'VARIATION_EVALUATION',
              reason: failReason + fails.join(' | '),
              details: { stats: currentStats, minute: timeElapsed }
            });
          }
        }

        if (triggeredVars.length > 0 || true) { // Always check for delayed alerts even if no new triggers
          const { data: existing } = await supabase.from('live_alerts').select('*').eq('fixture_id', fixtureId);
          const existingMap = new Map(existing?.map(e => [e.variation_id, e]) || []);
          
          const alertsByDest = new Map();
          
          for (const v of variations) {
            const matchesFilter = triggeredVars.some(tv => tv.id === v.id);
            const isNewTrigger = matchesFilter && !existingMap.has(v.id);
            const isDelayedPending = existingMap.has(v.id) && 
                                    !(existingMap.get(v.id) as any).telegram_sent && 
                                    v.telegram_alert_minute && 
                                    timeElapsed >= v.telegram_alert_minute;

            if (isNewTrigger || isDelayedPending) {
              const shouldSendTelegram = v.send_telegram && (!v.telegram_alert_minute || timeElapsed >= v.telegram_alert_minute);
              
              if (isNewTrigger) {
                const insertData = {
                  fixture_id: fixtureId, league_id: leagueId, league_name: f.league.name,
                  home_team: f.teams.home.name, away_team: f.teams.away.name,
                  minute_at_alert: timeElapsed, variation_id: v.id, variation_name: v.name,
                  stats_snapshot: { fullMatch: currentStats, window10Min: delta },
                  telegram_sent: shouldSendTelegram,
                  telegram_alert_minute: v.telegram_alert_minute
                };
                await supabase.from('live_alerts').insert(insertData);
              } else if (isDelayedPending) {
                await supabase.from('live_alerts').update({ telegram_sent: true }).eq('fixture_id', fixtureId).eq('variation_id', v.id);
              }

              if (shouldSendTelegram) {
                const ts = settingsMap.get(v.owner_id) || settings?.[0];
                const group = Array.isArray(v.telegram_groups) ? v.telegram_groups[0] : v.telegram_groups;
                const destChatId = group?.chat_id || v.telegram_chat_id || ts?.telegram_chat_id;
                const botToken = group?.bot_token || ts?.telegram_bot_token;

                if (destChatId && botToken) {
                  const key = `${botToken}_${destChatId}`;
                  if (!alertsByDest.has(key)) alertsByDest.set(key, { botToken, chatId: destChatId, varNames: [] });
                  
                  const alertLabel = v.telegram_alert_minute ? `${v.name} (@${v.telegram_alert_minute}')` : v.name;
                  alertsByDest.get(key).varNames.push(alertLabel);
                }
              }
            }
          }

          if (alertsByDest.size > 0) {
            for (const { botToken, chatId, varNames } of alertsByDest.values()) {
              const score = `${f.goals.home ?? 0} x ${f.goals.away ?? 0}`;
              const msg = `✅ <b>ROBÔ OFICIAL (COM NOVO MINUTO)</b>\n` +
                          `________________________________\n\n` +
                          `⚽ <b>${f.teams.home.name} ${score} ${f.teams.away.name}</b>\n` +
                          `🏆 ${f.league.name}\n` +
                          `⏰ Minuto: ${timeElapsed}'\n` +
                          `🎯 Filtro: ${varNames.join(', ')}\n\n` +
                          `📊 <b>ESTATÍSTICAS EM TEMPO REAL</b>\n` +
                          `________________________________\n\n` +
                          `📉 xG: ${currentStats.h.xg} - ${currentStats.a.xg}\n` +
                          `⛳ Cantos: ${currentStats.h.corners} - ${currentStats.a.corners}\n` +
                          `🥊 Na Área: ${currentStats.h.shotsInBox} - ${currentStats.a.shotsInBox}\n` +
                          `🚀 Chutes: ${currentStats.h.shots} - ${currentStats.a.shots}\n` +
                          `🎯 No Alvo: ${currentStats.h.shotsOn} - ${currentStats.a.shotsOn}\n` +
                          `⌛ Posse: ${currentStats.h.possession}% - ${currentStats.a.possession}%\n\n` +
                          `💰 <a href="https://www.bolsadeaposta.com/">ABRIR NA EXCHANGE</a>`;
              
              await sendTelegram(botToken, chatId, msg);
              addLog({ 
                fixture_id: fixtureId, 
                league_id: leagueId, 
                stage: 'ALERT_SENT', 
                reason: 'Telegram sent', 
                details: { variations: varNames.join(', ') } 
              });
            }
          }
        }
      }));
    }

    // Cleanup snapshots older than 4 hours
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    await supabase.from('live_stats_snapshots').delete().lt('created_at', fourHoursAgo);

    // 6. Flush Logs to DB
    if (logsBuffer.length > 0) {
      console.log(`Flushing ${logsBuffer.length} logs to database...`);
      const { error: logErr } = await supabase.from('robot_execution_logs').insert(logsBuffer);
      if (logErr) console.error('Error flushing logs:', logErr);
    }

    // Ping de sucesso do robô
    await supabase.from('robot_status').update({
      status: 'online',
      last_ping: new Date().toISOString()
    }).eq('id', '00000000-0000-0000-0000-000000000000');

    return new Response(JSON.stringify({ status: 'ok', logs: logsBuffer.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Cron Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      // 1. Gravar o status de erro
      await supabase.from('robot_status').update({
        status: 'error',
        last_error_message: errorMessage,
        last_error_at: new Date().toISOString()
      }).eq('id', '00000000-0000-0000-0000-000000000000');
      
      // 2. Avisar no Telegram (pegando o primeiro grupo ou a config de admin)
      const { data: settings } = await supabase.from('settings').select('telegram_bot_token, telegram_chat_id').limit(1);
      if (settings && settings.length > 0 && settings[0].telegram_bot_token && settings[0].telegram_chat_id) {
         const alertMsg = `🚨 <b>MONITORAMENTO: ERRO NO ROBÔ</b>\n\nO robô de sinais encontrou um problema e parou de funcionar:\n\n<code>${errorMessage.substring(0, 300)}</code>\n\nAbra o painel online para verificar.`;
         await sendTelegram(settings[0].telegram_bot_token, settings[0].telegram_chat_id, alertMsg);
      }
    } catch (metricError) {
      console.error('Failed to register error state:', metricError);
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
