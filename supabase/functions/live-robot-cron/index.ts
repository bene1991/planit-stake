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
    console.log('Starting Live Robot Execution (v4 - Duplicate Fix)...');

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

    // Determine global min/max minute boundaries
    let globalMinMin = 100, globalMaxMin = 0;
    variations.forEach(v => {
      if (v.min_minute < globalMinMin) globalMinMin = v.min_minute;
      if (v.max_minute > globalMaxMin) globalMaxMin = v.max_minute;
    });

    // 3. Fetch Telegram Settings (batch)
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

    // 5. Processing Loop
    for (const f of fixtures) {
      const fixtureId = String(f.fixture.id);
      const leagueId = String(f.league.id);
      if (blockedSet.has(leagueId)) continue;

      const timeElapsed = f.fixture.status.elapsed;
      const statusLong = f.fixture.status.long;
      // (REMOVED) if (statusLong !== 'First Half') continue; - This restriction was redundant as robot variations already have min_minute/max_minute.

      if (timeElapsed < 0 || timeElapsed > 95) continue;

      // Fetch precise stats
      let statsData;
      try {
        statsData = await callApiFootball('fixtures/statistics', { fixture: fixtureId });
      } catch (e) { console.error(`Error fetching stats for ${fixtureId}:`, e); continue; }

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

      // Snapshot & Delta logic (Simplified: only require snapshot if variation needs it)
      await supabase.from('live_stats_snapshots').insert({ fixture_id: fixtureId, minute: timeElapsed, stats_json: currentStats });
      
      const targetMin = timeElapsed - 10;
      const { data: snapshotData } = await supabase
        .from('live_stats_snapshots')
        .select('stats_json')
        .eq('fixture_id', fixtureId)
        .lte('minute', targetMin + 2)
        .gte('minute', targetMin - 2)
        .order('minute', { ascending: false })
        .limit(1);

      const oldStats = snapshotData?.[0]?.stats_json;
      const hasSnapshot = !!oldStats;

      const diff = (a: number, b: number) => Math.max(0, a - b);
      const delta = hasSnapshot ? {
        h: { 
          shots: diff(currentStats.h.shots, oldStats.h.shots), 
          shotsOn: diff(currentStats.h.shotsOn, oldStats.h.shotsOn), 
          attacks: diff(currentStats.h.attacks, oldStats.h.attacks) 
        },
        a: { 
          shots: diff(currentStats.a.shots, oldStats.a.shots), 
          shotsOn: diff(currentStats.a.shotsOn, oldStats.a.shotsOn), 
          attacks: diff(currentStats.a.attacks, oldStats.a.attacks) 
        }
      } : {
        h: { shots: 0, shotsOn: 0, attacks: 0 },
        a: { shots: 0, shotsOn: 0, attacks: 0 }
      };

      // Variation Loop
      const triggeredVars = [];
      for (const v of variations) {
        if (timeElapsed < v.min_minute || timeElapsed > v.max_minute) continue;
        if (v.require_score_zero && (currentStats.h.goals > 0 || currentStats.a.goals > 0)) continue;
        
        if (v.max_goals !== null && v.max_goals !== undefined && (currentStats.h.goals + currentStats.a.goals) > v.max_goals) {
          continue;
        }

        // Determine which team is "dominant" based on attacks DELTA (if snapshot available) or total attacks
        const hDom = hasSnapshot 
          ? delta.h.attacks >= delta.a.attacks
          : currentStats.h.attacks >= currentStats.a.attacks;
          
        const dom = hDom ? delta.h : delta.a;
        const domPoss = hDom ? currentStats.h.possession : currentStats.a.possession;

        // CRITICAL: If variation requires a delta (min_dangerous_attacks > 0) but we have no snapshot, skip it.
        if (v.min_dangerous_attacks > 0 && !hasSnapshot) continue;

        const combinedShots = currentStats.h.shots + currentStats.a.shots;
        const combinedShotsOn = currentStats.h.shotsOn + currentStats.a.shotsOn;
        
        const ok = combinedShots >= v.min_shots && 
                   combinedShotsOn >= v.min_shots_on_target &&
                   dom.attacks >= v.min_dangerous_attacks && 
                   domPoss >= v.min_possession &&
                   combinedShots >= (v.min_combined_shots || 0);

        if (ok) triggeredVars.push(v);
      }

      if (triggeredVars.length > 0) {
        // --- DEDUPLICATION & COOLDOWN ---
        // (MODIFIED) Removed global check_duplicate_alert RPC which enforced a 15-min global lock per fixture.
        // We now rely on variation-level uniqueness and the filter below.

        // 1. Get existing variation IDs for this fixture to identify TRULY NEW variations
        const { data: existing, error: existErr } = await supabase
          .from('live_alerts')
          .select('variation_id')
          .eq('fixture_id', fixtureId);

        if (existErr) {
          console.error(`Error checking existing alerts for ${fixtureId}:`, existErr);
          continue;
        }

        const existingIds = new Set(existing?.map(e => e.variation_id).filter(id => id) || []);

        // 2. Identify NEW variations for this game
        const newVars = triggeredVars.filter(v => !existingIds.has(v.id));

        if (newVars.length === 0) continue;

        // --- INSERT NEW ALERTS & GROUP BY DESTINATION (Chat + Bot) ---
        const alertsByDest = new Map<string, { botToken: string, chatId: string, varNames: string[] }>();
        const firstSetting = settings?.[0]; // Fallback for systems without per-variation ownership

        for (const v of newVars) {
          // Enhanced Under 2.5 detection (regex to catch Under 2.5 or Under 2,5)
          const isUnder = v.result_type === 'UNDER_GOALS' || /under 2[.,]5/i.test(v.name || '');
          
          const insertData: any = {
            fixture_id: fixtureId,
            league_id: leagueId,
            league_name: f.league.name,
            home_team: f.teams.home.name,
            away_team: f.teams.away.name,
            minute_at_alert: timeElapsed,
            variation_id: v.id,
            variation_name: v.name,
            stats_snapshot: { fullMatch: currentStats, window10Min: delta }
          };

          // Database Resilience: only set these if the system is migrated.
          const { error: insErr } = await supabase.from('live_alerts').insert({
            ...insertData,
            over15_result: isUnder ? 'ignored' : 'pending',
            under25_result: isUnder ? 'pending' : 'ignored'
          });

          if (insErr) {
            console.error(`Error inserting alert (likely missing columns or duplicate): ${insErr.message}. Retrying simple insert.`);
            await supabase.from('live_alerts').insert(insertData);
          }

          // Priority Logic for Destination and Bot
          // Use cast to any because owner_id might be missing from TS types
          const vOwnerId = (v as any).owner_id;
          const ts = settingsMap.get(vOwnerId) || firstSetting;
          
          const group = Array.isArray(v.telegram_groups) ? v.telegram_groups[0] : v.telegram_groups;
          const destChatId = group?.chat_id || v.telegram_chat_id || ts?.telegram_chat_id;
          const botToken = group?.bot_token || ts?.telegram_bot_token;

          if (destChatId && botToken) {
            const destKey = `${botToken}_${destChatId}`;
            if (!alertsByDest.has(destKey)) {
              alertsByDest.set(destKey, { botToken, chatId: destChatId, varNames: [] });
            }
            alertsByDest.get(destKey)!.varNames.push(v.name);
          } else {
            console.warn(`Missing Telegram Config for variation ${v.name}: chatId=${destChatId}, hasBotToken=${!!botToken}`);
          }
        }

        // --- DISPATCH TELEGRAM PER DESTINATION ---
        for (const { botToken, chatId, varNames } of alertsByDest.values()) {
          const varList = varNames.join(', ');
          const league = f.league.name;
          const h = f.teams.home.name;
          const a = f.teams.away.name;
          const score = `${currentStats.h.goals}x${currentStats.a.goals}`;

          const msg = `🚨 <b>ROBÔ AO VIVO</b>\n\n` +
            `⚽ <b>${h} ${score} ${a}</b>\n` +
            `🏟 ${league} | ⏱ ${timeElapsed}'\n\n` +
            `📊 <b>STATS (ATUAL):</b>\n` +
            `• Posse: ${currentStats.h.possession}% - ${currentStats.a.possession}%\n` +
            `• Chutes: ${currentStats.h.shots} - ${currentStats.a.shots}\n` +
            `• Ataques Perigosos: ${currentStats.h.attacks} - ${currentStats.a.attacks}\n\n` +
            `🔥 <b>JANELA 10 MIN:</b>\n` +
            `• Chutes: ${delta.h.shots} - ${delta.a.shots}\n` +
            `• Ataques Perigosos: ${delta.h.attacks} - ${delta.a.attacks}\n\n` +
            `⭐ <b>VARIATIONS:</b> ${varList}`;

          await sendTelegram(botToken, chatId, msg);
          addLog({ 
            fixture_id: fixtureId, 
            league_id: leagueId, 
            stage: 'ALERT_SENT', 
            reason: 'Telegram sent', 
            details: { variations: varList, chat_id: chatId } 
          });
        }
      }
    }

    // Cleanup & Flush
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    await supabase.from('live_stats_snapshots').delete().lt('created_at', fourHoursAgo);

    return new Response(JSON.stringify({ status: 'ok', logs: logsBuffer.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Cron Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
