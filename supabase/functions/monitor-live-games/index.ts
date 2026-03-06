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

    console.log(`[Monitor] Starting live games monitoring cycle... (${providedFixtures?.length || 'no'} fixtures provided)`);

    // 1. Fetch all games that are Live or Pending (starting within 30 min)
    const now = new Date();
    const thirtyMinFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    const { data: games, error: gamesErr } = await sb
      .from('games')
      .select('id, owner_id, api_fixture_id, home_team, away_team, league, final_score_home, final_score_away, status, date_time')
      .not('api_fixture_id', 'is', null)
      .in('status', ['Live', 'Pending']);

    if (gamesErr) {
      console.error('[Monitor] Error fetching games from DB:', gamesErr);
      throw gamesErr;
    }

    if (!games || games.length === 0) {
      console.log('[Monitor] No live or pending games to monitor in DB.');
      return new Response(JSON.stringify({ message: 'No games to monitor', monitored: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter pending games: only those starting within 30 min
    const activeGames = games.filter((g: any) => {
      if (g.status === 'Live') return true;
      if (g.status === 'Pending' && g.date_time) {
        const kickoff = new Date(g.date_time);
        return kickoff <= thirtyMinFromNow;
      }
      return false;
    });

    if (activeGames.length === 0) {
      console.log('[Monitor] No active games within monitoring window.');
      return new Response(JSON.stringify({ message: 'No active games', monitored: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Monitor] Found ${activeGames.length} games to monitor in DB`);

    // 2. Determine live fixtures (Use provided or fetch)
    let liveFixtures: any[] = [];
    if (providedFixtures && providedFixtures.length > 0) {
      liveFixtures = providedFixtures;
      console.log(`[Monitor] Using ${liveFixtures.length} provided fixtures (skipping API fetch)`);
    } else {
      console.log('[Monitor] No fixtures provided, fetching from API-Football...');
      const liveData = await fetchLiveFixtures(apiKey);
      liveFixtures = liveData.response || [];
      console.log(`[Monitor] API returned ${liveFixtures.length} live fixtures`);
    }


    // Build lookup by fixture ID
    const fixtureMap = new Map<string, any>();
    for (const f of liveFixtures) {
      fixtureMap.set(String(f.fixture.id), f);
    }

    // 3. Get or create monitor state for each game
    const gameIds = activeGames.map((g: any) => g.id);
    const { data: existingStates } = await sb
      .from('live_monitor_state')
      .select('*')
      .in('game_id', gameIds);

    const stateMap = new Map<string, any>();
    if (existingStates) {
      for (const s of existingStates) {
        stateMap.set(s.game_id, s);
      }
    }

    // 4. Fetch Telegram settings per owner (batch)
    const ownerIds = [...new Set(activeGames.map((g: any) => g.owner_id))];
    const { data: allSettings } = await sb
      .from('settings')
      .select('owner_id, telegram_bot_token, telegram_chat_id')
      .in('owner_id', ownerIds);

    const settingsMap = new Map<string, any>();
    if (allSettings) {
      for (const s of allSettings) {
        if (s.telegram_bot_token && s.telegram_chat_id) {
          settingsMap.set(s.owner_id, s);
        }
      }
    }

    // 4b. Fetch finalized games (any method_operation with result)
    const { data: allOps } = await sb
      .from('method_operations')
      .select('game_id, result')
      .in('game_id', gameIds);

    const finalizedGameIds = new Set<string>();
    if (allOps) {
      const opsByGame = new Map<string, any[]>();
      for (const op of allOps) {
        const list = opsByGame.get(op.game_id) || [];
        list.push(op);
        opsByGame.set(op.game_id, list);
      }

      for (const [gId, ops] of opsByGame.entries()) {
        const isFullyResolved = ops.length > 0 && ops.every(op => op.result !== null);
        if (isFullyResolved) {
          finalizedGameIds.add(gId);
        }
      }
    }
    console.log(`[Monitor] ${finalizedGameIds.size} games fully finalized by user`);

    let notificationsSent = 0;
    let gamesUpdated = 0;

    // 5. Process each game
    for (const game of activeGames) {
      const fixtureId = game.api_fixture_id;
      const fixture = fixtureMap.get(fixtureId);

      if (!fixture) {
        // Game not currently live in API
        continue;
      }

      const currentHome = fixture.goals.home ?? 0;
      const currentAway = fixture.goals.away ?? 0;
      const minute = fixture.fixture.status.elapsed ?? 0;
      const state = stateMap.get(game.id);
      const prevHome = state?.last_home_score ?? (game.final_score_home ?? 0);
      const prevAway = state?.last_away_score ?? (game.final_score_away ?? 0);
      const notifiedEvents: string[] = state?.notified_events ?? [];

      const telegramSettings = settingsMap.get(game.owner_id);

      const isFinalized = finalizedGameIds.has(game.id);

      // --- Detect GAME STATUS CHANGES (Start, HT, FT) ---
      const prevStatusStr = state?.status || (game.status === 'Pending' ? 'NS' : 'Live');
      const currentShortStatus = fixture.fixture.status.short;

      // Jogo Iniciou (Was Not Started, now in First Half)
      if (prevStatusStr !== '1H' && currentShortStatus === '1H') {
        const gameStartKey = `start_${fixtureId}`;
        if (!notifiedEvents.includes(gameStartKey)) {
          console.log(`[Monitor] Jogo Iniciado: ${game.home_team} vs ${game.away_team}`);
          notifiedEvents.push(gameStartKey);

          if (telegramSettings) {
            const msg = `▶️ <b>JOGO INICIADO</b>\n⚽ ${game.home_team} vs ${game.away_team}\n🏟 ${game.league}`;
            sendTelegram(telegramSettings.telegram_bot_token, telegramSettings.telegram_chat_id, msg);
          }
        }
      }

      // Final de Jogo ou Intervalo
      const isFinished = ['FT', 'AET', 'PEN'].includes(currentShortStatus);
      const isHalfTime = currentShortStatus === 'HT';

      if (isFinished || isHalfTime) {
        const endStatusKey = `end_${fixtureId}_${currentShortStatus}`;
        if (!notifiedEvents.includes(endStatusKey)) {
          console.log(`[Monitor] Jogo ${isFinished ? 'Terminou' : 'no Intervalo'}: ${game.home_team} vs ${game.away_team}`);
          notifiedEvents.push(endStatusKey);

          if (telegramSettings) {
            const statusLabel = isFinished ? 'FIM DE JOGO' : 'INTERVALO';
            const msg = `🏁 <b>${statusLabel}</b>\n⚽ ${game.home_team} ${currentHome} - ${currentAway} ${game.away_team}\n🏟 ${game.league}`;
            sendTelegram(telegramSettings.telegram_bot_token, telegramSettings.telegram_chat_id, msg);

            // Proactively resolve alerts for this fixture to avoid delay
            try {
              const { data: alerts } = await sb.from('live_alerts')
                .select('id, goal_ht_result, over15_result, variation_name, league_name')
                .eq('fixture_id', fixtureId)
                .or('goal_ht_result.eq.pending,over15_result.eq.pending');

              if (alerts && alerts.length > 0) {
                for (const alert of alerts) {
                  const updates: any = { updated_at: new Date().toISOString() };
                  let notifySuccess = true; // Default true if no notify needed
                  let resolveNeeded = false;

                  if (isHalfTime && alert.goal_ht_result === 'pending') {
                    const res = (currentHome + currentAway > 0) ? 'green' : 'red';

                    const marketLabel = 'Gol no 1T';
                    const scoreLabel = `${currentHome}x${currentAway} (HT)`;
                    const emoji = res === 'green' ? '✅' : '❌';
                    const resultLabel = res === 'green' ? 'GREEN!' : 'RED!';
                    const msg = `${emoji} <b>ROBÔ: ${resultLabel}</b>\n\n⚽ <b>${game.home_team} vs ${game.away_team}</b>\n🏆 ${alert.league_name}\n📊 Mercado: <b>${marketLabel}</b>\n🎯 Filtro: ${alert.variation_name}\n🏁 Placar: <b>${scoreLabel}</b>`;

                    const sent = await sendTelegram(telegramSettings.telegram_bot_token, telegramSettings.telegram_chat_id, {
                      message: msg,
                      title: 'Atenção',
                      type: 'alert'
                    });
                    if (sent) {
                      updates.goal_ht_result = res;
                      resolveNeeded = true;
                    } else {
                      notifySuccess = false;
                      console.error(`[Monitor] HT Alert Notification failed for ${fixtureId}, will retry in next cycle.`);
                    }
                  }

                  if (isFinished && alert.over15_result === 'pending') {
                    const res = (currentHome + currentAway >= 2) ? 'green' : 'red';

                    const marketLabel = 'Over 1.5';
                    const scoreLabel = `${currentHome}x${currentAway} (FT)`;
                    const emoji = res === 'green' ? '✅' : '❌';
                    const resultLabel = res === 'green' ? 'GREEN!' : 'RED!';
                    const msg = `${emoji} <b>ROBÔ: ${resultLabel}</b>\n\n⚽ <b>${game.home_team} vs ${game.away_team}</b>\n🏆 ${alert.league_name}\n📊 Mercado: <b>${marketLabel}</b>\n🎯 Filtro: ${alert.variation_name}\n🏁 Placar: <b>${scoreLabel}</b>`;

                    const sent = await sendTelegram(telegramSettings.telegram_bot_token, telegramSettings.telegram_chat_id, {
                      message: msg,
                      title: 'Atenção',
                      type: 'alert'
                    });
                    if (sent) {
                      updates.over15_result = res;
                      resolveNeeded = true;
                    } else {
                      notifySuccess = false;
                      console.error(`[Monitor] FT Alert Notification failed for ${fixtureId}, will retry in next cycle.`);
                    }
                  }

                  if (resolveNeeded && notifySuccess) {
                    await sb.from('live_alerts').update(updates).eq('id', alert.id);
                    notificationsSent++;
                  }
                }
              }
            } catch (err) {
              console.error('[Monitor] Proactive resolution error:', err);
            }
          }
        }
      }

      // Pre-fetch events for detection (at most once per game)
      const events = await fetchFixtureEvents(apiKey, fixtureId);

      // --- Detect GOALS ---
      if (currentHome > prevHome || currentAway > prevAway) {
        console.log(`[Monitor] GOAL detected in ${game.home_team} vs ${game.away_team}: ${currentHome}-${currentAway} (was ${prevHome}-${prevAway})`);

        if (isFinalized) {
          console.log(`[Monitor] Skipping goal notification - game already finalized by user`);
        } else {
          const goalKey = `goal_${currentHome}_${currentAway}`;
          // Atomic check and record
          const { data: isNewGoal, error: rpcErr } = await sb.rpc('mark_game_event_notified', {
            p_game_id: game.id,
            p_event_key: goalKey,
            p_home: currentHome,
            p_away: currentAway
          });

          if (rpcErr) {
            console.error('[Monitor] RPC Goal Error:', rpcErr);
          } else if (isNewGoal) {
            notifiedEvents.push(goalKey);

            // --- SYNC RESULTS TO OTHER TABLES ---
            try {
              const scoreStr = `${currentHome}x${currentAway}`;

              // 1. Fetch events and Update live_alerts
              const goalEvents = events
                .filter((e: any) => e.type === 'Goal' && e.detail !== 'Missed Penalty')
                .map((e: any) => ({
                  minute: e.time.elapsed,
                  extra: e.time.extra,
                  team: e.team?.name,
                  player: e.player?.name,
                  detail: e.detail
                }));

              const alertUpdates: any = {
                final_score: scoreStr,
                goal_events: goalEvents,
                updated_at: new Date().toISOString()
              };
              // If it's a goal in the first 45 mins, HT result is Green
              if (minute <= 45) alertUpdates.goal_ht_result = 'green';
              // If total goals >= 2, Over 1.5 is Green
              if (currentHome + currentAway >= 2) alertUpdates.over15_result = 'green';

              const { error: alertErr } = await sb.from('live_alerts')
                .update(alertUpdates)
                .eq('fixture_id', fixtureId);

              if (alertErr) console.error('[Monitor] Error updating live_alerts:', alertErr);

              // 2. Update lay1x0_analyses (Real-time "Gold Card" feedback)
              // For Lay 1x0, any score that isn't 1-0 is a Green if a goal happened
              if (currentHome !== 1 || currentAway !== 0) {
                const { error: analysisErr } = await sb.from('lay1x0_analyses')
                  .update({
                    result: 'Green',
                    final_score_home: currentHome,
                    final_score_away: currentAway,
                    resolved_at: new Date().toISOString()
                  })
                  .eq('fixture_id', fixtureId);

                if (analysisErr) console.error('[Monitor] Error updating lay1x0_analyses:', analysisErr);
              }
            } catch (syncErr) {
              console.error('[Monitor] Result sync error:', syncErr);
            }

            if (telegramSettings) {
              let scoringTeam = '';
              if (currentHome > prevHome) scoringTeam = game.home_team;
              else if (currentAway > prevAway) scoringTeam = game.away_team;

              const msg = `⚽ <b>GOL! ${scoringTeam}</b>\n${game.home_team} ${currentHome} - ${currentAway} ${game.away_team}\n🏟 ${game.league} | ⏱ ${minute}'`;
              const sent = await sendTelegram(telegramSettings.telegram_bot_token, telegramSettings.telegram_chat_id, msg);
              if (sent) notificationsSent++;
            }
          } else {
            console.log(`[Monitor] Skipping duplicate goal notification for ${goalKey}`);
          }
        }
      }

      // --- Detect RED CARDS ---
      for (const event of events) {
        if (event.type === 'Card' && event.detail === 'Red Card') {
          const eventKey = `red_${event.time?.elapsed}_${event.player?.name}`;
          if (!notifiedEvents.includes(eventKey)) {
            console.log(`[Monitor] RED CARD in ${game.home_team} vs ${game.away_team}: ${event.player?.name}`);

            if (isFinalized) {
              console.log(`[Monitor] Skipping red card notification - game already finalized by user`);
            } else {
              // Atomic check and record
              const { data: isNewRed, error: rpcErr } = await sb.rpc('mark_game_event_notified', {
                p_game_id: game.id,
                p_event_key: eventKey,
                p_home: currentHome,
                p_away: currentAway
              });

              if (rpcErr) {
                console.error('[Monitor] RPC Red Card Error:', rpcErr);
              } else if (isNewRed) {
                notifiedEvents.push(eventKey);
                if (telegramSettings) {
                  const playerName = event.player?.name || 'Desconhecido';
                  const teamName = event.team?.name || '';
                  const msg = `🟥 <b>CARTÃO VERMELHO!</b>\nJogador: ${playerName} (${teamName})\n${game.home_team} ${currentHome} - ${currentAway} ${game.away_team} | ⏱ ${event.time?.elapsed}'`;
                  const sent = await sendTelegram(telegramSettings.telegram_bot_token, telegramSettings.telegram_chat_id, msg);
                  if (sent) notificationsSent++;
                }
              } else {
                console.log(`[Monitor] Skipping duplicate red card notification for ${eventKey}`);
              }
            }
          }
        }
      }

      // 6. Upsert monitor state (ensure all score updates are persisted)
      await sb
        .from('live_monitor_state')
        .upsert({
          game_id: game.id,
          owner_id: game.owner_id,
          fixture_id: fixtureId,
          last_home_score: currentHome,
          last_away_score: currentAway,
          notified_events: notifiedEvents,
          status: 'monitoring',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'game_id' });

      // 7. Update game scores in main table
      await sb
        .from('games')
        .update({
          final_score_home: currentHome,
          final_score_away: currentAway,
          status: 'Live',
        })
        .eq('id', game.id);

      gamesUpdated++;
    }

    // 8. Cleanup: mark finished games
    for (const game of activeGames) {
      const fixture = fixtureMap.get(game.api_fixture_id);
      if (fixture) {
        const fixtureStatus = fixture.fixture.status.short;
        if (['FT', 'AET', 'PEN'].includes(fixtureStatus)) {
          await sb
            .from('live_monitor_state')
            .update({ status: 'finished' })
            .eq('game_id', game.id);
        }
      }
    }

    console.log(`[Monitor] Cycle complete. Games monitored: ${gamesUpdated}, Notifications sent: ${notificationsSent}`);

    return new Response(
      JSON.stringify({
        message: 'Monitoring cycle complete',
        monitored: gamesUpdated,
        notifications: notificationsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Monitor] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { fixtures } = await req.json();
    const supabase = createSupabaseClient();
    return await handleMonitor(supabase, fixtures);
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 400,
      headers: corsHeaders
    });
  }
});
