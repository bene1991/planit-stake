
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

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function callApiFootball(endpoint: string, token: string, params: Record<string, unknown> = {}) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/api-football`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint, ...params }),
    });
    if (!res.ok) {
        const errorText = await res.text().catch(() => 'No body');
        console.error(`[Cron] API call failed: ${res.status} ${res.statusText}`, errorText);
        throw new Error(`API error: ${res.status} - ${errorText.substring(0, 100)}`);
    }
    return res.json();
}


async function runRobot() {
    const logsBuffer: any[] = [];
    try {
        // Get default user ID for notifications (first user with telegram configured)
        const { data: defaultUserSettings } = await supabase
            .from('settings')
            .select('owner_id')
            .not('telegram_bot_token', 'is', null)
            .limit(1)
            .single();

        const defaultUserId = defaultUserSettings?.owner_id;

        const { data: blockedLeagues } = await supabase.from('robot_blocked_leagues').select('league_id').eq('active', true);
        const blockedSet = new Set(blockedLeagues?.map((l: any) => String(l.league_id)) || []);

        const { data: variations } = await supabase.from('robot_variations').select('*').eq('active', true);
        if (!variations || variations.length === 0) return;

        const apiData = await callApiFootball('fixtures?live=all', SUPABASE_SERVICE_ROLE_KEY);
        const fixtures = apiData?.response || [];

        // Heartbeat log to show cron is alive
        const { error: heartbeatErr } = await supabase.from('robot_execution_logs').insert([{
            fixture_id: '0',
            league_id: '0',
            variation_id: null,
            stage: 'CRON_HEARTBEAT',
            reason: `Cron executado: ${fixtures.length} jogos ao vivo encontrados`,
            details: { fixture_count: fixtures.length }
        }]);

        if (heartbeatErr) {
            console.error('[Cron] Failed to insert heartbeat log:', heartbeatErr);
            throw new Error(`DB error: ${heartbeatErr.message}`);
        }

        for (const f of fixtures) {
            const fId = String(f.fixture.id), lId = String(f.league.id), lName = f.league.name;
            const tElapsed = f.fixture.status.elapsed, status = f.fixture.status.long;
            const hTeam = f.teams.home.name, aTeam = f.teams.away.name;
            const teams = `${hTeam} vs ${aTeam}`;
            const details = { league: lName, teams, minute: tElapsed };
            const gameRef = `[${lName}] ${teams} (${tElapsed}')`;

            if (blockedSet.has(lId)) {
                logsBuffer.push({
                    fixture_id: fId,
                    league_id: lId,
                    variation_id: null,
                    stage: 'DISCARDED_PRE_FILTER',
                    reason: `Liga Bloqueada: ${lName}`,
                    details
                });
                continue;
            }

            // Allow First Half, Halftime, or Second Half
            if (!['First Half', 'Halftime', 'Second Half', '2nd Half', '2H'].some(s => status.includes(s))) {
                logsBuffer.push({
                    fixture_id: fId,
                    league_id: lId,
                    variation_id: null,
                    stage: 'DISCARDED_PRE_FILTER',
                    reason: `Status: ${status} (Não está no Tempo Regulamentar)`,
                    details
                });
                continue;
            }

            const eligibleVariations = variations.filter((v: any) => tElapsed >= v.min_minute && tElapsed <= v.max_minute);
            if (eligibleVariations.length === 0) {
                logsBuffer.push({
                    fixture_id: fId,
                    league_id: lId,
                    variation_id: null,
                    stage: 'DISCARDED_PRE_FILTER',
                    reason: 'Fora da faixa de minutos de qualquer filtro ativo',
                    details
                });
                continue;
            }

            const apiStatsData = await callApiFootball('fixtures/statistics', SUPABASE_SERVICE_ROLE_KEY, { fixture: fId });
            const rawStats = apiStatsData?.response || [];
            if (rawStats.length < 2) {
                logsBuffer.push({
                    fixture_id: fId,
                    league_id: lId,
                    variation_id: null,
                    stage: 'DISCARDED_PRE_FILTER',
                    reason: 'Stats indisponíveis',
                    details
                });
                continue;
            }

            const hStats = rawStats[0].statistics, aStats = rawStats[1].statistics;
            const extractNum = (s: any[], t: string) => parseInt((s.find(x => x.type === t)?.value || '0').toString().replace('%', ''));
            const extractFloat = (s: any[], t: string) => parseFloat((s.find(x => x.type === t)?.value || '0').toString());

            const stats = {
                h: {
                    xg: extractFloat(hStats, 'expected_goals'),
                    corners: extractNum(hStats, 'Corner Kicks'),
                    shotsInBox: extractNum(hStats, 'Shots insidebox'),
                    shots: extractNum(hStats, 'Total Shots'),
                    shotsOn: extractNum(hStats, 'Shots on Goal'),
                    goals: f.goals.home || 0,
                    possession: extractNum(hStats, 'Ball Possession')
                },
                a: {
                    xg: extractFloat(aStats, 'expected_goals'),
                    corners: extractNum(aStats, 'Corner Kicks'),
                    shotsInBox: extractNum(aStats, 'Shots insidebox'),
                    shots: extractNum(aStats, 'Total Shots'),
                    shotsOn: extractNum(aStats, 'Shots on Goal'),
                    goals: f.goals.away || 0,
                    possession: extractNum(aStats, 'Ball Possession')
                }
            };

            const matchedResults = [];

            for (const v of eligibleVariations) {
                if (v.require_score_zero && (stats.h.goals > 0 || stats.a.goals > 0)) continue;

                const combinedShots = (stats.h.shots + stats.a.shots);

                const homePressure =
                    stats.h.xg >= (v.min_expected_goals || 0) &&
                    stats.h.corners >= (v.min_corners || 0) &&
                    stats.h.shotsInBox >= (v.min_shots_insidebox || 0) &&
                    stats.h.shots >= (v.min_shots || 0) &&
                    stats.h.possession >= (v.min_possession || 0);

                const awayPressure =
                    stats.a.xg >= (v.min_expected_goals || 0) &&
                    stats.a.corners >= (v.min_corners || 0) &&
                    stats.a.shotsInBox >= (v.min_shots_insidebox || 0) &&
                    stats.a.shots >= (v.min_shots || 0) &&
                    stats.a.possession >= (v.min_possession || 0);

                const shotsOnOk = (stats.h.shotsOn + stats.a.shotsOn) >= (v.min_shots_on_target || 0);
                const combinedShotsOk = combinedShots >= (v.min_combined_shots || 0);

                const pressureMet = (homePressure || awayPressure) && shotsOnOk && combinedShotsOk;

                if (!pressureMet) {
                    let failReason = 'Não atingiu critérios';
                    if (v.require_score_zero && (stats.h.goals > 0 || stats.a.goals > 0)) {
                        failReason = 'Jogo com gols (Exige 0x0)';
                    } else if (!combinedShotsOk) {
                        failReason = `Chutes insuficientes (${combinedShots}/${v.min_combined_shots})`;
                    } else if (!shotsOnOk) {
                        failReason = `Alvo insuficiente (${stats.h.shotsOn + stats.a.shotsOn}/${v.min_shots_on_target})`;
                    }

                    logsBuffer.push({
                        fixture_id: fId,
                        league_id: lId,
                        variation_id: v.id,
                        stage: 'DISCARDED_FILTER',
                        reason: `Variação ${v.name}: ${failReason}`,
                        details: { ...details, stats }
                    });
                    continue;
                }

                // Check if this specific variation has already triggered for this fixture
                const { data: existing } = await supabase
                    .from('live_alerts')
                    .select('id')
                    .eq('fixture_id', fId)
                    .eq('variation_id', v.id)
                    .limit(1);

                if (existing && existing.length > 0) continue;

                matchedResults.push(v);
            }

            if (matchedResults.length > 0) {
                // Secondary check: If any variation requires 0-0, verify the absolute latest score bypassing cache
                const needsZeroScore = matchedResults.some(v => v.require_score_zero);
                if (needsZeroScore) {
                    try {
                        const freshData = await callApiFootball('fixtures', SUPABASE_SERVICE_ROLE_KEY, { id: fId, ignoreCache: true });
                        const freshFixture = freshData?.response?.[0];
                        if (freshFixture) {
                            const freshHomeGoals = freshFixture.goals.home || 0;
                            const freshAwayGoals = freshFixture.goals.away || 0;

                            if (freshHomeGoals > 0 || freshAwayGoals > 0) {
                                // Filter out variations that require 0-0 but now have goals
                                const beforeCount = matchedResults.length;
                                const filteredResults = matchedResults.filter(v => !v.require_score_zero);

                                if (filteredResults.length === 0) {
                                    console.log(`[Cron] Alert cancelled for ${gameRef}: Score changed to ${freshHomeGoals}-${freshAwayGoals} (confirmed via bypass)`);
                                    continue;
                                }

                                if (filteredResults.length < beforeCount) {
                                    console.log(`[Cron] Some variations filtered out for ${gameRef} due to score change to ${freshHomeGoals}-${freshAwayGoals}`);
                                    // Update matchedResults for the rest of the flow
                                    matchedResults.splice(0, matchedResults.length, ...filteredResults);
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`[Cron] Error during score verification for ${fId}:`, err);
                        // We proceed with existing data if verification fails to avoid missing alerts, 
                        // though normally this would be a cache hit/miss issue.
                    }
                }

                // Double check with minute-lock to prevent concurrent execution duplicates
                const { data: isDuplicate } = await supabase.rpc('check_duplicate_alert', {
                    p_fixture_id: fId,
                    p_minute: tElapsed
                });
                if (isDuplicate) continue;

                const processedNames = [];
                const processedNamesForTelegram = [];

                // Insert EACH matched variation separately so deduplication works in the future
                for (const v of matchedResults) {
                    const alertData = {
                        fixture_id: fId,
                        league_id: lId,
                        league_name: lName,
                        home_team: hTeam,
                        away_team: aTeam,
                        minute_at_alert: tElapsed,
                        variation_id: v.id,
                        variation_name: v.name,
                        stats_snapshot: stats,
                        owner_id: defaultUserId
                    };

                    const { error: alertErr } = await supabase.from('live_alerts').insert(alertData);
                    if (!alertErr) {
                        processedNames.push(v.name);
                        if (v.send_telegram !== false) {
                            processedNamesForTelegram.push(v.name);
                        }

                        logsBuffer.push({
                            fixture_id: fId,
                            league_id: lId,
                            variation_id: v.id,
                            stage: 'ALERT_SENT',
                            reason: `🚨 ${gameRef} - ALERTA GERADO! (${v.name})${v.send_telegram === false ? ' (Telegram desativado)' : ''}`,
                            details: { ...details, stats }
                        });
                    }
                }


                // Send ONE combined Telegram notification for all NEW transformations (if notification enabled)
                if (processedNamesForTelegram.length > 0) {
                    try {
                        const combinedNames = processedNamesForTelegram.join(', ');
                        const escapedHome = escapeHtml(hTeam);
                        const escapedAway = escapeHtml(aTeam);
                        const escapedLeague = escapeHtml(lName);
                        const escapedFilters = escapeHtml(combinedNames);


                        await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                            },
                            body: JSON.stringify({
                                userId: defaultUserId,
                                message: `🤖 <b>ROBÔ AO VIVO</b>\n\n⚽ <b>${escapedHome} vs ${escapedAway}</b>\n🏆 ${escapedLeague}\n⏰ ${tElapsed}'\n🔥 Filtros: <b>${escapedFilters}</b>\n\n📊 <b>STATS (ATUAL)</b>\nxG: ${stats.h.xg}-${stats.a.xg}\nEscanteios: ${stats.h.corners}-${stats.a.corners}\nChutes na Área: ${stats.h.shotsInBox}-${stats.a.shotsInBox}\nTotal Chutes: ${stats.h.shots}-${stats.a.shots}\nNo Alvo: ${stats.h.shotsOn}-${stats.a.shotsOn}\nPosse: ${stats.h.possession}%-${stats.a.possession}%`,
                                type: 'alert'
                            }),
                        });
                    } catch (telErr) { console.error('Telegram error:', telErr); }
                }
            }
        }

        if (logsBuffer.length > 0) {
            await supabase.from('robot_execution_logs').insert(logsBuffer);
        }

        // Trigger the background monitor to check for Goals and Red Cards
        try {
            console.log('[Cron] Triggering monitor-live-games...');
            await fetch(`${SUPABASE_URL}/functions/v1/monitor-live-games`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ fixtures }),
            });
        } catch (monErr) {
            console.error('[Cron] Failed to trigger monitor:', monErr);
        }

        // Trigger the alerts resolver to resolve pending HT/FT results and send Telegram notifications
        try {
            console.log('[Cron] Triggering live-alerts-resolver...');
            const resolverRes = await fetch(`${SUPABASE_URL}/functions/v1/live-alerts-resolver`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                },
            });
            const resolverData = await resolverRes.json();
            console.log('[Cron] Resolver result:', JSON.stringify(resolverData));
        } catch (resolverErr) {
            console.error('[Cron] Failed to trigger resolver:', resolverErr);
        }
    } catch (e) {
        console.error('Robot error:', e);
        try {
            await supabase.from('robot_execution_logs').insert([{
                fixture_id: '0',
                league_id: '0',
                variation_id: null,
                stage: 'CRON_ERROR',
                reason: `Erro crítico no Robô: ${e instanceof Error ? e.message : String(e)}`,
                details: { stack: e instanceof Error ? e.stack : null }
            }]);
        } catch (logErr) {
            console.error('Failed to log robot error to DB:', logErr);
        }
    }
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const authHeader = req.headers.get('Authorization');
    const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    const isAnon = authHeader === `Bearer ${SUPABASE_ANON_KEY}`;

    if (!isServiceRole && !isAnon) {
        console.error('[Auth] Unauthorized request to live-robot-cron-v2');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    await runRobot();
    return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
});
