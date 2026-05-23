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

const LEGACY_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E';

async function callApiFootball(endpoint: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/api-football`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LEGACY_ANON_KEY}`,
      'apikey': LEGACY_ANON_KEY
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

    // 2b. Build per-variation quarantined leagues map from methods (strategy_simulations)
    // RULE: Telegram só pula a liga se TODOS os métodos que usam aquela variação a quarentenaram
    // (interseção das quarentenas). Assim, se pelo menos um método ainda quer essa liga, o
    // Telegram sai. Se a variação não pertence a nenhum método, nada é quarentenado.
    const { data: methods } = await supabase
      .from('strategy_simulations')
      .select('filters_snapshot');
    const quarantineSetsByVariation = new Map<string, Set<string>[]>();
    for (const m of methods || []) {
      const fs: any = m.filters_snapshot || {};
      const vIds: string[] = fs.variation_ids || [];
      const qLeagues: string[] = fs.quarantine_leagues || [];
      if (!vIds.length) continue;
      const set = new Set<string>(qLeagues.map(String));
      for (const vid of vIds) {
        if (!quarantineSetsByVariation.has(vid)) quarantineSetsByVariation.set(vid, []);
        quarantineSetsByVariation.get(vid)!.push(set);
      }
    }
    const quarantineByVariation = new Map<string, Set<string>>();
    for (const [vid, sets] of quarantineSetsByVariation.entries()) {
      if (sets.length === 0) continue;
      const intersection = new Set<string>(sets[0]);
      for (let i = 1; i < sets.length; i++) {
        for (const l of intersection) if (!sets[i].has(l)) intersection.delete(l);
      }
      if (intersection.size > 0) quarantineByVariation.set(vid, intersection);
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
    // 4. Fetch Live Fixtures first so we can filter pending alerts
    let fixtures = [];
    try {
      const data = await callApiFootball('fixtures?live=all');
      fixtures = data?.response || [];
    } catch (e) {
      console.error('Failed to fetch live fixtures:', e);
      addLog({
        fixture_id: '999999',
        league_id: '999999',
        stage: 'DISCARDED_PRE_FILTER',
        reason: `ERRO AO BUSCAR FIXTURES: ${e}`,
        details: { error: String(e) }
      });
    }
    console.log(`Fetched ${fixtures.length} live fixtures.`);
    const fixtureIds = fixtures.map((f: any) => String(f.fixture.id));

    // 3.5 Fetch Pending Telegram Alerts (Specifically for current live games)
    const { data: pendingAlerts } = await supabase
      .from('live_alerts')
      .select('fixture_id')
      .eq('telegram_sent', false)
      .in('fixture_id', fixtureIds); // BLINDAGEM: Only fetch relevant live alerts
    const pendingSet = new Set(pendingAlerts?.map(a => String(a.fixture_id)) || []);



    // 5. Processing Loop (Parallelized)
    const BATCH_SIZE = 5;
    for (let i = 0; i < fixtures.length; i += BATCH_SIZE) {
      const batch = fixtures.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (f: any) => {
        const fixtureId = String(f.fixture.id);
        const leagueId = String(f.league.id);
        const timeElapsed = f.fixture.status.elapsed;

        if (blockedSet.has(leagueId)) {
          addLog({
            fixture_id: fixtureId,
            league_id: leagueId,
            stage: 'DISCARDED_PRE_FILTER',
            reason: 'Liga bloqueada',
            details: { league: f.league?.name, teams: `${f.teams.home.name} vs ${f.teams.away.name}`, minute: timeElapsed }
          });
          return;
        }
        if (timeElapsed === null || timeElapsed === undefined) {
          addLog({
            fixture_id: fixtureId,
            league_id: leagueId,
            stage: 'DISCARDED_PRE_FILTER',
            reason: `Status: ${f.fixture.status.short || 'Break Time'}`,
            details: { league: f.league?.name, teams: `${f.teams.home.name} vs ${f.teams.away.name}`, minute: null }
          });
          return;
        }
        if (timeElapsed < 0 || timeElapsed > 95) {
          addLog({
            fixture_id: fixtureId,
            league_id: leagueId,
            stage: 'DISCARDED_PRE_FILTER',
            reason: `Fora da faixa de minutos`,
            details: { league: f.league?.name, teams: `${f.teams.home.name} vs ${f.teams.away.name}`, minute: timeElapsed }
          });
          return;
        }

        const totalGoals = (f.goals.home || 0) + (f.goals.away || 0);

        // Pre-filter: Check if any active variation could potentially match this game's minute and score
        const potentialVars = variations.filter(v => {
          if (timeElapsed < v.min_minute || timeElapsed > v.max_minute) return false;
          if (v.require_score_zero && totalGoals > 0) return false;
          // Note: max_goals null/undefined means no limit
          if (v.max_goals !== null && v.max_goals !== undefined && totalGoals > v.max_goals) return false;
          return true;
        });

        if (potentialVars.length === 0 && !pendingSet.has(fixtureId)) {
          // Economy: Skip API call if no variation matches current state AND no pending alerts
          addLog({
            fixture_id: fixtureId,
            league_id: leagueId,
            stage: 'DISCARDED_PRE_FILTER',
            reason: `Ignorado (Economia): Minuto ${timeElapsed}' ou Placar ${f.goals.home}x${f.goals.away} fora das janelas ativas`,
            details: { league: f.league.name, teams: `${f.teams.home.name} vs ${f.teams.away.name}` }
          });
          return;
        }

        // Fetch precise stats
        let statsData;
        try {
          statsData = await callApiFootball('fixtures/statistics', { fixture: fixtureId });
        } catch (e) { 
          console.error(`Error fetching stats for ${fixtureId}:`, e);
          addLog({
            fixture_id: fixtureId,
            league_id: leagueId,
            stage: 'DISCARDED_PRE_FILTER',
            reason: `Erro API: Falha ao buscar estatísticas`,
            details: { league: f.league?.name, teams: `${f.teams?.home?.name} vs ${f.teams?.away?.name}`, minute: timeElapsed }
          });
          return; 
        }

        const rawStats = statsData?.response || [];
        if (rawStats.length < 2) {
          // SAFEGUARD: Only discard if game is past 15 minutes.
          // In early minutes, stats may be temporarily empty for major leagues.
          if (timeElapsed >= 15) {
            addLog({
              fixture_id: fixtureId,
              league_id: leagueId,
              stage: 'DISCARDED_PRE_FILTER',
              reason: `Stats indisponíveis: Sem cobertura ao vivo pela API (${timeElapsed}')`,
              details: { league: f.league?.name, teams: `${f.teams?.home?.name} vs ${f.teams?.away?.name}`, minute: timeElapsed }
            });
          } else {
            addLog({
              fixture_id: fixtureId,
              league_id: leagueId,
              stage: 'DISCARDED_PRE_FILTER',
              reason: `Stats ainda não disponíveis (${timeElapsed}' < 15') — aguardando próximo ciclo`,
              details: { league: f.league?.name, teams: `${f.teams?.home?.name} vs ${f.teams?.away?.name}`, minute: timeElapsed }
            });
          }
          return;
        }

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
              details: { 
                league: f.league.name,
                teams: `${f.teams.home.name} vs ${f.teams.away.name}`,
                stats: currentStats, 
                minute: timeElapsed 
              }
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

              // Quarentena por método: pula Telegram se essa variação tem essa liga em quarentena (compara por league_id)
              const qSet = quarantineByVariation.get(v.id);
              const isQuarantined = qSet?.has(String(f.league.id)) || qSet?.has(f.league.name);
              if (isQuarantined) {
                addLog({
                  fixture_id: fixtureId,
                  league_id: leagueId,
                  variation_id: v.id,
                  stage: 'ALERT_SENT',
                  reason: 'Telegram SKIPPED (liga em quarentena)',
                  details: { league: f.league.name, variation: v.name }
                });
              }

              if (shouldSendTelegram && !isQuarantined) {
                const ts = settingsMap.get(v.owner_id) || settings?.[0];
                const group = Array.isArray(v.telegram_groups) ? v.telegram_groups[0] : v.telegram_groups;
                const destChatId = group?.chat_id || v.telegram_chat_id || ts?.telegram_chat_id;
                const botToken = group?.bot_token || ts?.telegram_bot_token;

                if (destChatId && botToken) {
                  const key = `${botToken}_${destChatId}`;
                  if (!alertsByDest.has(key)) alertsByDest.set(key, { botToken, chatId: destChatId, varNames: [], variationIds: [] });

                  const alertLabel = v.telegram_alert_minute ? `${v.name} (@${v.telegram_alert_minute}')` : v.name;
                  alertsByDest.get(key).varNames.push(alertLabel);
                  alertsByDest.get(key).variationIds.push(v.id);
                }
              }
            }
          }

          if (alertsByDest.size > 0) {
            for (const { botToken, chatId, varNames, variationIds } of alertsByDest.values()) {
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

              const sent = await sendTelegram(botToken, chatId, msg);
              if (sent) {
                addLog({
                  fixture_id: fixtureId,
                  league_id: leagueId,
                  stage: 'ALERT_SENT',
                  reason: 'Telegram sent',
                  details: { variations: varNames.join(', ') }
                });
              } else {
                await supabase.from('live_alerts')
                  .update({ telegram_sent: false })
                  .eq('fixture_id', fixtureId)
                  .in('variation_id', variationIds);
                addLog({
                  fixture_id: fixtureId,
                  league_id: leagueId,
                  stage: 'ALERT_SENT',
                  reason: 'Telegram send FAILED (will retry in Pass 2)',
                  details: { variations: varNames.join(', '), chat_id: chatId }
                });
              }
            }
          }
        }
      }));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PASS 2: Resilient Recovery — Process ALL pending delayed Telegram alerts
    // This catches any alerts that were missed due to API errors (429, etc.)
    // during the fixture processing loop above.
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[RESILIENT] Checking for pending delayed Telegram alerts...');
    const { data: allPending } = await supabase
      .from('live_alerts')
      .select('*')
      .eq('telegram_sent', false)
      .not('telegram_alert_minute', 'is', null)
      .in('fixture_id', fixtureIds); // BLINDAGEM: Only check live games

    if (allPending && allPending.length > 0) {
      console.log(`[RESILIENT] Found ${allPending.length} pending delayed alerts to check.`);

      for (const alert of allPending) {
        // Find the matching live fixture to check current minute
        const liveFixture = fixtures.find((fx: any) => String(fx.fixture.id) === alert.fixture_id);
        if (!liveFixture) continue; // Game not live (already finished or not started)

        const currentMinute = liveFixture.fixture?.status?.elapsed;
        if (!currentMinute || currentMinute < alert.telegram_alert_minute) continue; // Not yet time

        // Find the variation config for this alert
        const variation = variations.find((v: any) => v.id === alert.variation_id);
        if (!variation || !variation.send_telegram) continue;

        // Quarentena: pula se essa variação tem essa liga em quarentena em algum método (compara por league_id)
        const qSet2 = quarantineByVariation.get(variation.id);
        if (qSet2?.has(String(liveFixture.league.id)) || qSet2?.has(liveFixture.league.name)) {
          // marca como enviado pra parar de reprocessar; loga skip
          await supabase.from('live_alerts').update({ telegram_sent: true }).eq('id', alert.id);
          addLog({
            fixture_id: alert.fixture_id,
            league_id: alert.league_id,
            variation_id: variation.id,
            stage: 'ALERT_SENT',
            reason: 'Telegram SKIPPED (liga em quarentena - Pass 2)',
            details: { league: liveFixture.league.name, variation: variation.name }
          });
          continue;
        }

        // Get Telegram destination
        const ts = settingsMap.get(variation.owner_id) || settings?.[0];
        const group = Array.isArray(variation.telegram_groups) ? variation.telegram_groups[0] : variation.telegram_groups;
        const destChatId = group?.chat_id || variation.telegram_chat_id || ts?.telegram_chat_id;
        const botToken = group?.bot_token || ts?.telegram_bot_token;

        if (!destChatId || !botToken) continue;

        // Use saved snapshot from when the alert was first triggered
        const stats = alert.stats_snapshot?.fullMatch;
        const score = `${liveFixture.goals.home ?? 0} x ${liveFixture.goals.away ?? 0}`;

        const msg = `✅ <b>ROBÔ OFICIAL (RECUPERADO @${alert.telegram_alert_minute}')</b>\n` +
                    `________________________________\n\n` +
                    `⚽ <b>${alert.home_team} ${score} ${alert.away_team}</b>\n` +
                    `🏆 ${alert.league_name}\n` +
                    `⏰ Minuto Atual: ${currentMinute}' (Sinal: ${alert.minute_at_alert}')\n` +
                    `🎯 Filtro: ${alert.variation_name}\n\n` +
                    (stats
                      ? `📊 <b>ESTATÍSTICAS (Snapshot ${alert.minute_at_alert}')</b>\n` +
                        `________________________________\n\n` +
                        `📉 xG: ${stats.h?.xg || 0} - ${stats.a?.xg || 0}\n` +
                        `⛳ Cantos: ${stats.h?.corners || 0} - ${stats.a?.corners || 0}\n` +
                        `🥊 Na Área: ${stats.h?.shotsInBox || 0} - ${stats.a?.shotsInBox || 0}\n` +
                        `🚀 Chutes: ${stats.h?.shots || 0} - ${stats.a?.shots || 0}\n` +
                        `🎯 No Alvo: ${stats.h?.shotsOn || 0} - ${stats.a?.shotsOn || 0}\n` +
                        `⌛ Posse: ${stats.h?.possession || 0}% - ${stats.a?.possession || 0}%\n\n`
                      : '') +
                    `💰 <a href="https://www.bolsadeaposta.com/">ABRIR NA EXCHANGE</a>`;

        const sent = await sendTelegram(botToken, destChatId, msg);
        if (sent) {
          await supabase.from('live_alerts')
            .update({ telegram_sent: true })
            .eq('fixture_id', alert.fixture_id)
            .eq('variation_id', alert.variation_id);

          addLog({
            fixture_id: alert.fixture_id,
            league_id: alert.league_id,
            stage: 'ALERT_SENT',
            reason: `Telegram sent (resilient recovery @${alert.telegram_alert_minute}')`,
            details: { variation: alert.variation_name, minute: currentMinute }
          });
          console.log(`[RESILIENT] ✅ Sent delayed alert: ${alert.home_team} vs ${alert.away_team} (@${alert.telegram_alert_minute}')`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SAFETY NET PASS — envia delayed alerts mesmo se o jogo sumiu do live feed
    // (cobre: jogo em halftime estendido, buraco da API, jogo encerrado precoce)
    // Estima o horário ideal de envio: created_at + (alert_minute - minute_at_alert) min
    // + 20 min de margem (halftime + ruído). Se passou, manda com snapshot salvo.
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[SAFETY] Checking stuck delayed alerts (independent of live feed)...');
    const stuckCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: stuckAlerts } = await supabase
      .from('live_alerts')
      .select('*')
      .eq('telegram_sent', false)
      .not('telegram_alert_minute', 'is', null)
      .gte('created_at', stuckCutoff);

    if (stuckAlerts && stuckAlerts.length > 0) {
      console.log(`[SAFETY] ${stuckAlerts.length} pending delayed alerts to evaluate.`);
      const SAFETY_MARGIN_MIN = 20;
      for (const alert of stuckAlerts) {
        const createdMs = new Date(alert.created_at).getTime();
        const minutesElapsed = (Date.now() - createdMs) / 60000;
        const minutesNeeded = (alert.telegram_alert_minute - (alert.minute_at_alert || 0)) + SAFETY_MARGIN_MIN;
        if (minutesElapsed < minutesNeeded) continue;

        // Skip if quarantine intersection applies
        const qSet3 = quarantineByVariation.get(alert.variation_id);
        if (qSet3?.has(String(alert.league_id))) {
          await supabase.from('live_alerts').update({ telegram_sent: true }).eq('id', alert.id);
          addLog({
            fixture_id: alert.fixture_id,
            league_id: alert.league_id,
            variation_id: alert.variation_id,
            stage: 'ALERT_SENT',
            reason: 'Telegram SKIPPED (quarentena - Safety Net)',
            details: { league: alert.league_name, variation: alert.variation_name }
          });
          continue;
        }

        const variation = variations.find((v: any) => v.id === alert.variation_id);
        if (!variation || !variation.send_telegram) {
          await supabase.from('live_alerts').update({ telegram_sent: true }).eq('id', alert.id);
          continue;
        }

        const ts = settingsMap.get(variation.owner_id) || settings?.[0];
        const group = Array.isArray(variation.telegram_groups) ? variation.telegram_groups[0] : variation.telegram_groups;
        const destChatId = group?.chat_id || variation.telegram_chat_id || ts?.telegram_chat_id;
        const botToken = group?.bot_token || ts?.telegram_bot_token;
        if (!destChatId || !botToken) continue;

        const stats = alert.stats_snapshot?.fullMatch;
        const msg = `⏰ <b>ROBÔ OFICIAL (RECUPERADO POR SAFETY NET @${alert.telegram_alert_minute}')</b>\n` +
                    `________________________________\n\n` +
                    `⚽ <b>${alert.home_team} vs ${alert.away_team}</b>\n` +
                    `🏆 ${alert.league_name}\n` +
                    `⏰ Sinal: ${alert.minute_at_alert}' · Alvo: ${alert.telegram_alert_minute}'\n` +
                    `🎯 Filtro: ${alert.variation_name}\n` +
                    `⚠️ <i>Jogo saiu do feed ao vivo — alerta enviado por segurança com base no snapshot do sinal</i>\n\n` +
                    (stats
                      ? `📊 <b>ESTATÍSTICAS (Snapshot ${alert.minute_at_alert}')</b>\n` +
                        `________________________________\n\n` +
                        `📉 xG: ${stats.h?.xg || 0} - ${stats.a?.xg || 0}\n` +
                        `⛳ Cantos: ${stats.h?.corners || 0} - ${stats.a?.corners || 0}\n` +
                        `🥊 Na Área: ${stats.h?.shotsInBox || 0} - ${stats.a?.shotsInBox || 0}\n` +
                        `🚀 Chutes: ${stats.h?.shots || 0} - ${stats.a?.shots || 0}\n` +
                        `🎯 No Alvo: ${stats.h?.shotsOn || 0} - ${stats.a?.shotsOn || 0}\n` +
                        `⌛ Posse: ${stats.h?.possession || 0}% - ${stats.a?.possession || 0}%\n\n`
                      : '') +
                    `💰 <a href="https://www.bolsadeaposta.com/">ABRIR NA EXCHANGE</a>`;

        const sent = await sendTelegram(botToken, destChatId, msg);
        if (sent) {
          await supabase.from('live_alerts').update({ telegram_sent: true }).eq('id', alert.id);
          addLog({
            fixture_id: alert.fixture_id,
            league_id: alert.league_id,
            variation_id: alert.variation_id,
            stage: 'ALERT_SENT',
            reason: `Telegram sent (SAFETY NET @${alert.telegram_alert_minute}', ${Math.round(minutesElapsed)}min após sinal)`,
            details: { variation: alert.variation_name }
          });
          console.log(`[SAFETY] ✅ Sent stuck alert: ${alert.home_team} vs ${alert.away_team} (@${alert.telegram_alert_minute}')`);
        }
      }
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
