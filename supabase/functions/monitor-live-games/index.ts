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

async function fetchLiveFixtures(apiKey: string): Promise<any> {
  const response = await fetch(
    'https://v3.football.api-sports.io/fixtures?live=all',
    { headers: { 'x-apisports-key': apiKey } }
  );
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('[Monitor] Non-JSON response from API:', text.substring(0, 200));
    return { response: [] };
  }
}

async function fetchFixtureEvents(apiKey: string, fixtureId: string): Promise<any[]> {
  const response = await fetch(
    `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`,
    { headers: { 'x-apisports-key': apiKey } }
  );
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data.response || [];
  } catch {
    console.error('[Monitor] Non-JSON events response:', text.substring(0, 200));
    return [];
  }
}

async function sendTelegram(botToken: string, chatId: string, payload: string | { message: string, title?: string, type?: string }) {
  try {
    const body = typeof payload === 'string' ? { message: payload, type: 'notification' } : payload;
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-telegram-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        botToken,
        chatId,
        ...body
      }),
    });

    if (!response.ok) {
      console.error('[Monitor] Telegram function errored:', await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Monitor] Telegram send error:', err);
    return false;
  }
}

async function handleMonitor(sb: ReturnType<typeof createClient>, providedFixtures?: any[]) {
  try {
    const apiKey = Deno.env.get('API_FOOTBALL_KEY');
    if (!apiKey) throw new Error('API_FOOTBALL_KEY not configured');

    console.log(`[Monitor] Starting unified monitoring cycle... (${providedFixtures?.length || 'no'} fixtures provided)`);

    // 1. Fetch active Games (Planejamento Manual)
    const { data: dbGames, error: gamesErr } = await sb
      .from('games')
      .select('id, owner_id, api_fixture_id, home_team, away_team, league, final_score_home, final_score_away, status, date_time')
      .not('api_fixture_id', 'is', null)
      .in('status', ['Live', 'Pending']);

    if (gamesErr) {
      console.error('[Monitor] Error fetching games from DB:', gamesErr);
      throw gamesErr;
    }

    // 2. Fetch pending Live Alerts (Monitoramento do Robô)
    const { data: dbAlerts, error: alertsErr } = await sb
      .from('live_alerts')
      .select('id, owner_id, fixture_id, home_team, away_team, league_name, goal_ht_result, over15_result, variation_name')
      .or('goal_ht_result.eq.pending,over15_result.eq.pending');

    if (alertsErr) {
      console.error('[Monitor] Error fetching alerts from DB:', alertsErr);
      throw alertsErr;
    }

    const monitoredFixtureIds = new Set<string>();
    dbGames?.forEach(g => monitoredFixtureIds.add(String(g.api_fixture_id)));
    dbAlerts?.forEach(a => monitoredFixtureIds.add(String(a.fixture_id)));

    if (monitoredFixtureIds.size === 0) {
      console.log('[Monitor] No games or alerts to monitor.');
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
      console.log('[Monitor] Fetching from API-Football...');
      const liveData = await fetchLiveFixtures(apiKey);
      liveFixtures = liveData.response || [];
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
    dbGames?.forEach(g => allOwnerIds.add(g.owner_id));
    dbAlerts?.forEach(a => allOwnerIds.add(a.owner_id));

    const ownerIdArray = Array.from(allOwnerIds).filter(id => !!id);
    const { data: allSettings } = ownerIdArray.length > 0
      ? await sb.from('settings').select('owner_id, telegram_bot_token, telegram_chat_id').in('owner_id', ownerIdArray)
      : { data: [] };

    const settingsMap = new Map<string, any>();
    if (allSettings) {
      for (const s of allSettings) {
        if (s.telegram_bot_token && s.telegram_chat_id) {
          settingsMap.set(s.owner_id, s);
        }
      }
    }

    let notificationsSent = 0;
    let itemsUpdated = 0;

    // 6. Process each monitored fixture
    for (const fId of monitoredFixtureIds) {
      const fixture = fixtureMap.get(fId);
      if (!fixture) continue;

      const currentHome = fixture.goals.home ?? 0;
      const currentAway = fixture.goals.away ?? 0;
      const minute = fixture.fixture.status.elapsed ?? 0;
      const currentShortStatus = fixture.fixture.status.short;
      const isFinished = ['FT', 'AET', 'PEN'].includes(currentShortStatus);
      const isHalfTime = currentShortStatus === 'HT';

      // --- Part A: Update Manual Games (Planejamento) ---
      const relatedGames = dbGames?.filter(g => String(g.api_fixture_id) === fId) || [];
      for (const game of relatedGames) {
        const state = stateMap.get(game.id);
        const prevHome = state?.last_home_score ?? (game.final_score_home ?? 0);
        const prevAway = state?.last_away_score ?? (game.final_score_away ?? 0);
        const notifiedEvents: string[] = state?.notified_events ?? [];
        const telegramSettings = settingsMap.get(game.owner_id);

        if (currentHome > prevHome || currentAway > prevAway) {
          const goalKey = `goal_${currentHome}_${currentAway}`;
          const { data: isNewGoal } = await sb.rpc('mark_game_event_notified', {
            p_game_id: game.id, p_event_key: goalKey, p_home: currentHome, p_away: currentAway
          });

          if (isNewGoal) {
            notifiedEvents.push(goalKey);
            if (telegramSettings) {
              const scoringTeam = currentHome > prevHome ? game.home_team : game.away_team;
              const msg = `⚽ <b>GOL! ${scoringTeam}</b>\n${game.home_team} ${currentHome} - ${currentAway} ${game.away_team}\n🏟 ${game.league} | ⏱ ${minute}'`;
              await sendTelegram(telegramSettings.telegram_bot_token, telegramSettings.telegram_chat_id, msg);
              notificationsSent++;
            }
          }
        }

        await sb.from('live_monitor_state').upsert({
          game_id: game.id, owner_id: game.owner_id, fixture_id: fId,
          last_home_score: currentHome, last_away_score: currentAway,
          notified_events: notifiedEvents, status: isFinished ? 'finished' : 'monitoring',
          updated_at: new Date().toISOString()
        }, { onConflict: 'game_id' });

        await sb.from('games').update({
          final_score_home: currentHome, final_score_away: currentAway,
          status: isFinished ? 'Finished' : 'Live'
        }).eq('id', game.id);
        itemsUpdated++;
      }

      // --- Part B: Update Robot Alerts ---
      const relatedAlerts = dbAlerts?.filter(a => String(a.fixture_id) === fId) || [];
      if (relatedAlerts.length > 0) {
        const events = await fetchFixtureEvents(apiKey, fId);
        const goalEvents = events
          .filter((e: any) => e.type === 'Goal' && e.detail !== 'Missed Penalty')
          .map((e: any) => ({
            minute: e.time.elapsed, extra: e.time.extra,
            team: e.team?.name, player: e.player?.name, detail: e.detail
          }));

        for (const alert of relatedAlerts) {
          const tSettings = settingsMap.get(alert.owner_id);
          const updates: any = {
            final_score: `${currentHome}x${currentAway}`,
            goal_events: goalEvents,
            updated_at: new Date().toISOString()
          };
          let resolveNeeded = false;

          // 1. Goal HT resolution (if minute 45+ or goal happened in 1T)
          if (alert.goal_ht_result === 'pending') {
            const hasGoal1T = (currentHome + currentAway > 0) && (minute <= 45 || isHalfTime); // Inprecise but usually okay
            const isLate1T = isHalfTime || minute > 45;

            if (hasGoal1T || isLate1T) {
              const res = (currentHome + currentAway > 0) ? 'green' : 'red';
              if (tSettings) {
                const msg = `${res === 'green' ? '✅' : '❌'} <b>ROBÔ: ${res === 'green' ? 'GREEN!' : 'RED!'}</b>\n\n⚽ <b>${alert.home_team} vs ${alert.away_team}</b>\n🏆 ${alert.league_name}\n📊 Mercado: <b>Gol no 1T</b>\n🎯 Filtro: ${alert.variation_name}\n🏁 Placar: <b>${currentHome}x${currentAway}</b>`;
                const sent = await sendTelegram(tSettings.telegram_bot_token, tSettings.telegram_chat_id, { message: msg, type: 'alert' });
                if (sent) {
                  updates.goal_ht_result = res;
                  resolveNeeded = true;
                }
              }
            }
          }

          // 2. Over 1.5 resolution
          if (alert.over15_result === 'pending') {
            const hasOver15 = (currentHome + currentAway >= 2);
            if (hasOver15 || isFinished) {
              const res = hasOver15 ? 'green' : 'red';
              if (tSettings) {
                const msg = `${res === 'green' ? '✅' : '❌'} <b>ROBÔ: ${res === 'green' ? 'GREEN!' : 'RED!'}</b>\n\n⚽ <b>${alert.home_team} vs ${alert.away_team}</b>\n🏆 ${alert.league_name}\n📊 Mercado: <b>Over 1.5</b>\n🎯 Filtro: ${alert.variation_name}\n🏁 Placar: <b>${currentHome}x${currentAway}</b>`;
                const sent = await sendTelegram(tSettings.telegram_bot_token, tSettings.telegram_chat_id, { message: msg, type: 'alert' });
                if (sent) {
                  updates.over15_result = res;
                  resolveNeeded = true;
                }
              }
            }
          }

          if (resolveNeeded || isFinished) {
            await sb.from('live_alerts').update(updates).eq('id', alert.id);

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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    // Manual Auth Validation
    const isServiceKey = authHeader === `Bearer ${serviceKey}`;
    const isAnonKey = authHeader === `Bearer ${anonKey}` || req.headers.get('apikey') === anonKey;

    if (!isServiceKey && !isAnonKey) {
      console.error('[Monitor] Unauthorized request Attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
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
