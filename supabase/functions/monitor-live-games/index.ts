import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GameWithState {
  id: string;
  owner_id: string;
  api_fixture_id: string;
  home_team: string;
  away_team: string;
  league: string;
  final_score_home: number | null;
  final_score_away: number | null;
  status: string;
  monitor_state?: {
    id: string;
    last_home_score: number;
    last_away_score: number;
    notified_events: string[];
  };
}

function createSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function fetchLiveFixtures(sb: any): Promise<any> {
  console.log('[Monitor] Fetching live=all via proxy...');
  try {
    const { data, error } = await sb.functions.invoke('api-football', {
      body: {
        endpoint: 'fixtures',
        params: { live: 'all' }
      }
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Monitor] Failed to fetch live fixtures via proxy:', err);
    return { response: [] };
  }
}

async function fetchFixtureEvents(sb: any, fixtureId: string): Promise<any[]> {
  try {
    const { data, error } = await sb.functions.invoke('api-football', {
      body: {
        endpoint: 'fixtures/events',
        params: { fixture: fixtureId }
      }
    });
    if (error) throw error;
    return data.response || [];
  } catch (err) {
    console.error('[Monitor] Failed to fetch events via proxy:', err);
    return [];
  }
}

async function sendTelegram(botToken: string, chatId: string, payload: string | { message: string, title?: string, type?: string }, userId?: string) {
  const maxRetries = 2;
  const body = typeof payload === 'string' ? { message: payload, type: 'notification' } : payload;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 500;
        console.log(`[Monitor] Telegram retry ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }

      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-telegram-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
        },
        body: JSON.stringify({
          botToken,
          chatId,
          userId,
          ...body
        }),
      });

      if (response.ok) return true;

      const errorText = await response.text();
      console.error(`[Monitor] Telegram attempt ${attempt} failed:`, errorText);

      // If unauthorized, don't retry
      if (response.status === 401) return false;

    } catch (err) {
      console.error(`[Monitor] Telegram attempt ${attempt} catch error:`, err);
    }
  }
  return false;
}

async function handleMonitor(sb: ReturnType<typeof createClient>, providedFixtures?: any[]) {
  try {
    const apiKey = Deno.env.get('API_FOOTBALL_KEY');
    if (!apiKey) throw new Error('API_FOOTBALL_KEY not configured');

    console.log(`[Monitor] Starting unified monitoring cycle... (${providedFixtures?.length || 'no'} fixtures provided)`);

    // 1. Fetch active Games (Planejamento Manual)
    const today = new Date().toISOString().split('T')[0];
    const { data: dbGames, error: gamesErr } = await sb
      .from('games')
      .select('id, owner_id, api_fixture_id, home_team, away_team, league, final_score_home, final_score_away, status, date_time')
      .not('api_fixture_id', 'is', null)
      .in('status', ['Live', 'Pending'])
      .gte('date_time', today);

    if (gamesErr) {
      console.error('[Monitor] Error fetching games from DB:', gamesErr);
      throw gamesErr;
    }

    // 2. Fetch pending Live Alerts (Monitoramento do Robô)
    const { data: dbAlerts, error: alertsErr } = await sb
      .from('live_alerts')
      .select('*, robot_variations(send_telegram)')
      .or('goal_ht_result.eq.pending,over15_result.eq.pending')
      .gte('created_at', today);

    if (alertsErr) {
      console.error('[Monitor] Error fetching alerts from DB:', alertsErr);
      throw alertsErr;
    }

    const monitoredFixtureIds = new Set<string>();
    dbGames?.forEach(g => monitoredFixtureIds.add(String(g.api_fixture_id)));
    dbAlerts?.forEach(a => monitoredFixtureIds.add(String(a.fixture_id)));

    if (monitoredFixtureIds.size === 0) {
      console.log('[Monitor] No games or alerts to monitor for today.');
      return new Response(JSON.stringify({ message: 'Nothing to monitor', monitored: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Monitor] Total unique fixtures to check: ${monitoredFixtureIds.size} (${dbGames?.length || 0} manual games, ${dbAlerts?.length || 0} robot alerts)`);

    // 3. Determine live fixtures (Use provided or fetch)
    let liveFixtures: any[] = [];
    if (providedFixtures && providedFixtures.length > 0) {
      liveFixtures = providedFixtures;
      console.log(`[Monitor] Using ${liveFixtures.length} provided fixtures`);
    } else {
      console.log('[Monitor] Fetching from API-Football via proxy...');
      const liveData = await fetchLiveFixtures(sb);
      liveFixtures = liveData?.response || [];
    }

    const fixtureMap = new Map<string, any>();
    for (const f of liveFixtures) {
      fixtureMap.set(String(f.fixture.id), f);
    }

    // 4. Fetch State for manual games
    const gameIds = dbGames?.map((g: any) => g.id) || [];
    const { data: existingStates } = gameIds.length > 0
      ? await sb.from('live_monitor_state').select('*').in('game_id', gameIds)
      : { data: [] };

    const stateMap = new Map<string, any>();
    if (existingStates) {
      for (const s of existingStates) {
        stateMap.set(s.game_id, s);
      }
    }

    // 5. Fetch Telegram settings per owner
    const allOwnerIds = new Set<string>();
    dbGames?.forEach(g => { if (g.owner_id) allOwnerIds.add(g.owner_id); });
    dbAlerts?.forEach(a => { if (a.owner_id) allOwnerIds.add(a.owner_id); });

    const ownerIdArray = Array.from(allOwnerIds);
    console.log(`[Monitor] Fetching settings for owners: ${ownerIdArray.join(', ')}`);

    const { data: allSettings, error: settingsErr } = ownerIdArray.length > 0
      ? await sb.from('settings').select('owner_id, telegram_bot_token, telegram_chat_id').in('owner_id', ownerIdArray)
      : { data: [], error: null };

    if (settingsErr) console.error('[Monitor] Error fetching user settings:', settingsErr);

    const settingsMap = new Map<string, any>();
    if (allSettings) {
      for (const s of allSettings) {
        if (s.telegram_bot_token && s.telegram_chat_id) {
          settingsMap.set(s.owner_id, s);
        }
      }
    }
    console.log(`[Monitor] Configured telegram settings found for ${settingsMap.size} users`);

    let notificationsSent = 0;
    let itemsUpdated = 0;
    const sentThisCycle = new Set<string>(); // Global dedupe per run: chat_id:fixture_id:event_key

    // 6. Process each monitored fixture
    for (const fId of monitoredFixtureIds) {
      const fixture = fixtureMap.get(fId);
      if (!fixture) continue;

      const currentHome = fixture.goals.home ?? 0;
      const currentAway = fixture.goals.away ?? 0;
      const minute = fixture.fixture.status.elapsed ?? 0;
      const currentShortStatus = fixture.fixture.status.short;
      const isFinished = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(currentShortStatus);
      const isHalfTime = currentShortStatus === 'HT';

      // --- Part A: Update Manual Games (Planejamento) ---
      const relatedGames = dbGames?.filter(g => String(g.api_fixture_id) === fId) || [];
      if (relatedGames.length > 0) {
        // Fetch events for detailed goal info and red cards
        const events = await fetchFixtureEvents(sb, fId);

        for (const game of relatedGames) {
          const state = stateMap.get(game.id);
          const prevHome = state?.last_home_score ?? (game.final_score_home ?? 0);
          const prevAway = state?.last_away_score ?? (game.final_score_away ?? 0);
          const notifiedEvents: string[] = state?.notified_events ?? [];
          const telegramSettings = settingsMap.get(game.owner_id);

          // 1. Goal Notification
          if (currentHome > prevHome || currentAway > prevAway) {
            const goalKey = `goal_${currentHome}_${currentAway}`;
            if (!notifiedEvents.includes(goalKey)) {
              // ATOMIC LOCK
              const { data: isNewGoal } = await sb.rpc('mark_game_event_notified', {
                p_game_id: game.id, p_event_key: goalKey, p_home: currentHome, p_away: currentAway,
                p_fixture_id: fId, p_owner_id: game.owner_id
              });

              if (isNewGoal) {
                if (telegramSettings) {
                  const dedupeKey = `${telegramSettings.telegram_chat_id}:${fId}:${goalKey}`;
                  if (!sentThisCycle.has(dedupeKey)) {
                    const scoringTeam = currentHome > prevHome ? game.home_team : game.away_team;
                    const msg = `⚽ <b>GOL! (Aba Planejamento)</b>\n\n🎯 <b>${scoringTeam}</b> marca!\n🏟 ${game.home_team} ${currentHome} - ${currentAway} ${game.away_team}\n🏆 ${game.league} | ⏱ ${minute}'`;

                    const sent = await sendTelegram(telegramSettings.telegram_bot_token, telegramSettings.telegram_chat_id, msg, game.owner_id);
                    if (sent) {
                      notificationsSent++;
                      sentThisCycle.add(dedupeKey);
                      // ONLY add to notifiedEvents if successfully sent
                      notifiedEvents.push(goalKey);
                    } else {
                      console.error(`[Monitor] CRITICAL: Failed to deliver goal notification for ${game.home_team} vs ${game.away_team}. Rolling back DB entry.`);
                      // Rollback so next run can try again
                      await sb.from('sent_notifications').delete().match({ owner_id: game.owner_id, fixture_id: fId, event_key: goalKey });
                      // NOT adding to notifiedEvents here so the upsert below doesn't block next run
                    }
                  } else {
                    // Already sent this cycle (multiple games for same fixture)
                    notifiedEvents.push(goalKey);
                  }
                } else {
                  // No telegram settings, still mark as notified so we don't spam attempts
                  notifiedEvents.push(goalKey);
                }
              }
            }
          }

          // 2. Red Card Notification
          const redCards = events.filter((e: any) => e.type?.toLowerCase() === 'red card');
          for (const rc of redCards) {
            const rcKey = `red_card_${rc.time?.elapsed}_${rc.team?.id}_${rc.player?.name || 'unknown'}`;
            if (!notifiedEvents.includes(rcKey)) {
              const { data: isNewRC } = await sb.rpc('mark_game_event_notified', {
                p_game_id: game.id, p_event_key: rcKey, p_home: currentHome, p_away: currentAway,
                p_fixture_id: fId, p_owner_id: game.owner_id
              });

              if (isNewRC) {
                if (telegramSettings) {
                  const dedupeKey = `${telegramSettings.telegram_chat_id}:${fId}:${rcKey}`;
                  if (!sentThisCycle.has(dedupeKey)) {
                    const rcTeamName = rc.team?.name || (rc.team?.id === fixture.teams.home.id ? game.home_team : game.away_team);
                    const msg = `🟥 <b>CARTÃO VERMELHO! (Aba Planejamento)</b>\n\n👤 Jogador: ${rc.player?.name || 'Não identificado'}\n🛡 Time: <b>${rcTeamName}</b>\n⚽ Placar: ${game.home_team} ${currentHome} - ${currentAway} ${game.away_team}\n🏆 ${game.league} | ⏱ ${rc.time?.elapsed}'`;

                    const sent = await sendTelegram(telegramSettings.telegram_bot_token, telegramSettings.telegram_chat_id, msg, game.owner_id);
                    if (sent) {
                      notificationsSent++;
                      sentThisCycle.add(dedupeKey);
                      notifiedEvents.push(rcKey);
                    } else {
                      console.error(`[Monitor] CRITICAL: Failed to deliver red card notification for ${game.home_team} vs ${game.away_team}. Rolling back DB entry.`);
                      await sb.from('sent_notifications').delete().match({ owner_id: game.owner_id, fixture_id: fId, event_key: rcKey });
                    }
                  } else {
                    notifiedEvents.push(rcKey);
                  }
                } else {
                  notifiedEvents.push(rcKey);
                }
              }
            }
          }

          // Only update if no pending critical notification OR if finished
          const hasPending = (currentHome > prevHome || currentAway > prevAway) && !notifiedEvents.includes(`goal_${currentHome}_${currentAway}`);
          if (!hasPending || isFinished) {
            await sb.from('live_monitor_state').upsert({
              game_id: game.id, owner_id: game.owner_id, fixture_id: fId,
              last_home_score: currentHome, last_away_score: currentAway,
              notified_events: notifiedEvents, status: isFinished ? 'finished' : 'monitoring',
              updated_at: new Date().toISOString()
            }, { onConflict: 'game_id' });

            await sb.from('games').update({
              final_score_home: currentHome,
              final_score_away: currentAway,
              current_minute: minute,
              last_sync_at: new Date().toISOString(),
              status: isFinished ? 'Finished' : 'Live'
            }).eq('id', game.id);
            itemsUpdated++;
          }
        }
      }

      // --- Part B: Update Robot Alerts ---
      const relatedAlerts = dbAlerts?.filter(a => String(a.fixture_id) === fId) || [];
      if (relatedAlerts.length > 0) {
        const events = await fetchFixtureEvents(sb, fId);
        const goalEvents = events
          .filter((e: any) => e.type === 'Goal' && e.detail !== 'Missed Penalty')
          .map((e: any) => ({
            minute: e.time.elapsed, extra: e.time.extra,
            team: e.team?.name, player: e.player?.name, detail: e.detail
          }));

        // Group results by market+result to avoid double notifications for different variations
        const groupKey = (market: string, res: string) => `${market}_${res}`;
        const notifiedGroups = new Set<string>();

        for (const alert of relatedAlerts) {
          const tSettings = settingsMap.get(alert.owner_id);
          const updates: any = {
            final_score: `${currentHome}x${currentAway}`,
            goal_events: goalEvents,
            updated_at: new Date().toISOString()
          };
          let resolveNeeded = false;

          // 1. Goal HT resolution
          if (alert.goal_ht_result === 'pending') {
            const hasGoal1T = (currentHome + currentAway > 0) && (minute <= 45 || isHalfTime);
            const isLate1T = isHalfTime || minute > 45;

            if (hasGoal1T || isLate1T) {
              const res = (currentHome + currentAway > 0) ? 'green' : 'red';
              const sendTelegramEnabled = alert.robot_variations?.send_telegram !== false;
              const gKey = groupKey('gt_ht', res);

              if (tSettings && sendTelegramEnabled && !notifiedGroups.has(gKey)) {
                // ATOMIC LOCK
                const alertKey = `alert_ht_${alert.id}_${res}`;
                const { data: isNewAlert } = await sb.rpc('mark_alert_resolved_atomically', {
                  p_alert_id: alert.id, p_market_key: alertKey, p_fixture_id: fId, p_owner_id: alert.owner_id
                });

                if (isNewAlert) {
                  // Find all other pending alerts for this game with same result to include their names
                  const sameResultAlerts = relatedAlerts.filter(a =>
                    a.id !== alert.id &&
                    a.goal_ht_result === 'pending' &&
                    a.robot_variations?.send_telegram !== false
                  );
                  const names = [alert.variation_name, ...sameResultAlerts.map(a => a.variation_name)].join(', ');

                  const msg = `${res === 'green' ? '✅' : '❌'} <b>ROBÔ: ${res === 'green' ? 'GREEN!' : 'RED!'}</b>\n\n⚽ <b>${alert.home_team} vs ${alert.away_team}</b>\n🏆 ${alert.league_name}\n📊 Mercado: <b>Gol no 1T</b>\n🎯 Filtros: ${names}\n🏁 Placar: <b>${currentHome}x${currentAway}</b>`;
                  const sent = await sendTelegram(tSettings.telegram_bot_token, tSettings.telegram_chat_id, { message: msg, type: 'alert' }, alert.owner_id);
                  if (sent) {
                    updates.goal_ht_result = res;
                    resolveNeeded = true;
                    notifiedGroups.add(gKey);
                    await new Promise(r => setTimeout(r, 200));
                  } else {
                    await sb.from('sent_notifications').delete().match({ owner_id: alert.owner_id, fixture_id: fId, event_key: alertKey });
                  }
                }
              } else {
                updates.goal_ht_result = res;
                resolveNeeded = true;
              }
            }
          }

          // 2. Over 1.5 resolution
          if (alert.over15_result === 'pending') {
            const hasOver15 = (currentHome + currentAway >= 2);
            if (hasOver15 || isFinished) {
              const res = hasOver15 ? 'green' : 'red';
              const sendTelegramEnabled = alert.robot_variations?.send_telegram !== false;
              const gKey = groupKey('o15', res);

              if (tSettings && sendTelegramEnabled && !notifiedGroups.has(gKey)) {
                // ATOMIC LOCK
                const alertKey = `alert_o15_${alert.id}_${res}`;
                const { data: isNewAlert } = await sb.rpc('mark_alert_resolved_atomically', {
                  p_alert_id: alert.id, p_market_key: alertKey, p_fixture_id: fId, p_owner_id: alert.owner_id
                });

                if (isNewAlert) {
                  const sameResultAlerts = relatedAlerts.filter(a =>
                    a.id !== alert.id &&
                    a.over15_result === 'pending' &&
                    a.robot_variations?.send_telegram !== false
                  );
                  const names = [alert.variation_name, ...sameResultAlerts.map(a => a.variation_name)].join(', ');

                  const msg = `${res === 'green' ? '✅' : '❌'} <b>ROBÔ: ${res === 'green' ? 'GREEN!' : 'RED!'}</b>\n\n⚽ <b>${alert.home_team} vs ${alert.away_team}</b>\n🏆 ${alert.league_name}\n📊 Mercado: <b>Over 1.5</b>\n🎯 Filtros: ${names}\n🏁 Placar: <b>${currentHome}x${currentAway}</b>`;
                  const sent = await sendTelegram(tSettings.telegram_bot_token, tSettings.telegram_chat_id, { message: msg, type: 'alert' }, alert.owner_id);
                  if (sent) {
                    updates.over15_result = res;
                    resolveNeeded = true;
                    notifiedGroups.add(gKey);
                    await new Promise(r => setTimeout(r, 200));
                  } else {
                    await sb.from('sent_notifications').delete().match({ owner_id: alert.owner_id, fixture_id: fId, event_key: alertKey });
                  }
                }
              } else {
                updates.over15_result = res;
                resolveNeeded = true;
              }
            }
          }

          if (resolveNeeded || isFinished) {
            await sb.from('live_alerts').update(updates).eq('id', alert.id);
            // ... (rest of the logic remains same)

            // Proactively update lay1x0_analyses if it relates to this fixture
            const resVal = (currentHome === 1 && currentAway === 0) ? 'Red' : 'Green';
            if (currentHome !== 1 || currentAway !== 0 || isFinished) {
              await sb.from('lay1x0_analyses').update({
                result: resVal,
                final_score_home: currentHome,
                final_score_away: currentAway,
                resolved_at: new Date().toISOString()
              }).eq('fixture_id', fId);
            }
            itemsUpdated++;
          }
        }
      }
    }

    console.log(`[Monitor] Cycle complete. Items monitored: ${itemsUpdated}, Notifications: ${notificationsSent}`);

    return new Response(JSON.stringify({ message: 'Success', monitored: itemsUpdated, notifications: notificationsSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Monitor] Global Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const apiKeyHeader = req.headers.get('apikey');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const legacyAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E';

    // Manual Auth Validation
    const isServiceRole = authHeader === `Bearer ${serviceKey}` || authHeader?.includes(serviceKey) || apiKeyHeader === serviceKey;
    const isAnon = authHeader === `Bearer ${anonKey}` || authHeader?.includes(anonKey) || apiKeyHeader === anonKey;
    const hasLegacyAnon = authHeader?.includes(legacyAnonKey) || apiKeyHeader === legacyAnonKey;

    if (!isServiceRole && !isAnon && !hasLegacyAnon) {
      console.warn('[Monitor] Non-standard auth detected, checking if headers contain keys...');
      // Double check specifically for internal calls
      const srInAuth = authHeader?.includes(serviceKey);

      if (!srInAuth) {
        console.error('[Monitor] Unauthorized request Attempt');
        console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));
        return new Response(JSON.stringify({
          error: 'Unauthorized',
          details: 'No valid key found',
          debug: {
            authHeader: authHeader?.substring(0, 15) + '...',
            apiKeyHeader: apiKeyHeader?.substring(0, 15) + '...',
            serviceKeyDefined: !!serviceKey,
            anonKeyDefined: !!anonKey
          }
        }), { status: 401, headers: corsHeaders });
      }
    }

    const { fixtures } = await req.json();
    const supabase = createSupabaseClient();
    return await handleMonitor(supabase, fixtures);
  } catch (err) {
    console.error('[Monitor] Request Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 400,
      headers: corsHeaders
    });
  }
});
