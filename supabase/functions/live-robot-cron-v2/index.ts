
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function sendTelegram(payload: { message: string, userId?: string, type?: string }) {
    const maxRetries = 2;
    let lastErrorMessage = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = Math.pow(2, attempt) * 500;
                console.log(`[Cron] Telegram retry ${attempt}/${maxRetries} after ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }

            const response = await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY.trim()}`,
                    'apikey': SUPABASE_SERVICE_ROLE_KEY.trim()
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) return { success: true };

            const errorText = await response.text();
            lastErrorMessage = `Status ${response.status}: ${errorText}`;
            console.error(`[Cron] Telegram attempt ${attempt} failed:`, lastErrorMessage);

            if (response.status === 401 || response.status === 400) return { success: false, error: lastErrorMessage };
        } catch (err) {
            lastErrorMessage = err instanceof Error ? err.message : String(err);
            console.error(`[Cron] Telegram attempt ${attempt} catch error:`, lastErrorMessage);
        }
    }
    return { success: false, error: lastErrorMessage };
}

async function callApiFootball(endpoint: string, token: string, params: Record<string, unknown> = {}) {
    // Increased delay to avoid Supabase Edge Function rate limits (bursts)
    await new Promise(r => setTimeout(r, 400));

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
        // Get default user ID for notifications
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
        if (!variations || variations.length === 0) {
            console.log('[Cron] No active variations found.');
            return;
        }

        const apiData = await callApiFootball('fixtures?live=all', SUPABASE_SERVICE_ROLE_KEY);
        const fixtures = apiData?.response || [];

        // Heartbeat log
        await supabase.from('robot_execution_logs').insert([{
            fixture_id: '0',
            league_id: '0',
            variation_id: null,
            stage: 'CRON_HEARTBEAT',
            reason: `Cron executado: ${fixtures.length} jogos ao vivo encontrados`,
            details: { fixture_count: fixtures.length }
        }]);

        // --- CRITICAL PRIORITIZATION ---
        // Trigger monitoring tasks FIRST so manual planning games are updated immediately
        try {
            console.log('[Cron] Triggering monitor-live-games...');
            await fetch(`${SUPABASE_URL}/functions/v1/monitor-live-games`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                },
                body: JSON.stringify({ fixtures }),
            });
        } catch (monErr) {
            console.error('[Cron] Failed to trigger monitor:', monErr);
        }

        try {
            console.log('[Cron] Triggering live-alerts-resolver...');
            fetch(`${SUPABASE_URL}/functions/v1/live-alerts-resolver`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'apikey': SUPABASE_SERVICE_ROLE_KEY
                },
            }).catch(e => console.error('[Cron] Async Resolver trigger error:', e));
        } catch (resolverErr) {
            console.error('[Cron] Failed to trigger resolver:', resolverErr);
        }

        console.log(`[Cron] Starting fixture loop for ${fixtures.length} games...`);

        // FIXTURE LOOP
        for (const f of fixtures) {
            try {
                const fId = String(f.fixture.id), lId = String(f.league.id), lName = f.league.name;
                const tElapsed = f.fixture.status.elapsed, status = f.fixture.status.long;
                const hTeam = f.teams.home.name, aTeam = f.teams.away.name;
                const teams = `${hTeam} vs ${aTeam}`;
                const details = { league: lName, teams, minute: tElapsed };
                const gameRef = `[${lName}] ${teams} (${tElapsed}')`;

                if (blockedSet.has(lId)) {
                    logsBuffer.push({
                        fixture_id: fId, league_id: lId, variation_id: null,
                        stage: 'DISCARDED_PRE_FILTER', reason: `Liga Bloqueada: ${lName}`, details
                    });
                    continue;
                }

                if (!['First Half', 'Halftime', 'Second Half', '2nd Half', '2H'].some(s => status.includes(s))) {
                    logsBuffer.push({
                        fixture_id: fId, league_id: lId, variation_id: null,
                        stage: 'DISCARDED_PRE_FILTER', reason: `Status: ${status}`, details
                    });
                    continue;
                }

                const eligibleVariations = variations.filter((v: any) => tElapsed >= v.min_minute && tElapsed <= v.max_minute);
                if (eligibleVariations.length === 0) {
                    logsBuffer.push({
                        fixture_id: fId, league_id: lId, variation_id: null,
                        stage: 'DISCARDED_PRE_FILTER', reason: 'Fora da faixa de minutos', details
                    });
                    continue;
                }

                const apiStatsData = await callApiFootball('fixtures/statistics', SUPABASE_SERVICE_ROLE_KEY, { fixture: fId });
                const rawStats = apiStatsData?.response || [];
                if (rawStats.length < 2) {
                    logsBuffer.push({
                        fixture_id: fId, league_id: lId, variation_id: null,
                        stage: 'DISCARDED_PRE_FILTER', reason: 'Stats indisponíveis', details
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
                    if (v.blocked_leagues && v.blocked_leagues.includes(lId)) continue;
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
                        logsBuffer.push({
                            fixture_id: fId, league_id: lId, variation_id: v.id,
                            stage: 'DISCARDED_FILTER', reason: `Filtro ${v.name} não atingido`, details: { ...details, stats }
                        });
                        continue;
                    }

                    const { data: existing } = await supabase.from('live_alerts').select('id').eq('fixture_id', fId).eq('variation_id', v.id).limit(1);
                    if (existing && existing.length > 0) continue;
                    matchedResults.push(v);
                }

                if (matchedResults.length > 0) {
                    const { data: previousAlerts } = await supabase.from('live_alerts').select('id').eq('fixture_id', fId).limit(1);
                    const isFirstAlertForFixture = (!previousAlerts || previousAlerts.length === 0);

                    const { data: isDuplicate } = await supabase.rpc('check_duplicate_alert', { p_fixture_id: fId, p_minute: tElapsed });
                    if (isDuplicate) continue;

                    const processedNames = [];
                    const processedNamesForTelegram = [];

                    for (const v of matchedResults) {
                        const alertData = {
                            fixture_id: fId, league_id: lId, league_name: lName, home_team: hTeam, away_team: aTeam,
                            minute_at_alert: tElapsed, variation_id: v.id, variation_name: v.name, stats_snapshot: stats, owner_id: defaultUserId
                        };

                        const { error: alertErr } = await supabase.from('live_alerts').insert(alertData);
                        if (!alertErr) {
                            processedNames.push(v.name);
                            if (v.send_telegram !== false) processedNamesForTelegram.push(v.name);
                            logsBuffer.push({
                                fixture_id: fId, league_id: lId, variation_id: v.id,
                                stage: 'ALERT_SENT', reason: `🚨 ${gameRef} - ALERTA GERADO! (${v.name})`, details: { ...details, stats }
                            });
                        }
                    }

                    if (processedNamesForTelegram.length > 0) {
                        if (isFirstAlertForFixture) {
                            try {
                                const d = new Date();
                                const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                const webhookUrl = 'https://script.google.com/macros/s/AKfycbxx8v-ebefycSipV1YVIyR2RH7Rxpb7nvRP6swlp_R_Hvx234d8mxBnO46Am6FwuqFh/exec';

                                await fetch(webhookUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        action: 'NEW_ALERT',
                                        date: dateStr,
                                        match: teams,
                                        league: lName,
                                        method: processedNamesForTelegram.join(', '),
                                        alertMinute: String(tElapsed),
                                        fixtureId: fId
                                    })
                                });
                            } catch (sheetErr) {
                                console.error('[Cron] Google Sheets NEW_ALERT failed:', sheetErr);
                            }
                        }

                        const combinedNames = processedNamesForTelegram.join(', ');
                        const escapedHome = escapeHtml(hTeam);
                        const escapedAway = escapeHtml(aTeam);
                        const escapedLeague = escapeHtml(lName);
                        const message = `🤖 <b>ROBÔ AO VIVO</b>\n\n⚽ <b>${escapedHome} vs ${escapedAway}</b>\n🏆 ${escapedLeague}\n⏰ ${tElapsed}'\n🔥 Filtros: <b>${escapeHtml(combinedNames)}</b>\n\n📊 <b>STATS (ATUAL)</b>\nxG: ${stats.h.xg}-${stats.a.xg}\nEscanteios: ${stats.h.corners}-${stats.a.corners}\nChutes na Área: ${stats.h.shotsInBox}-${stats.a.shotsInBox}\nTotal Chutes: ${stats.h.shots}-${stats.a.shots}\nNo Alvo: ${stats.h.shotsOn}-${stats.a.shotsOn}\nPosse: ${stats.h.possession}%-${stats.a.possession}%`;

                        const result = await sendTelegram({ userId: defaultUserId, message, type: 'alert' });
                        if (!result.success) {
                            logsBuffer.push({
                                fixture_id: fId, league_id: lId, variation_id: null, stage: 'TELEGRAM_ERROR',
                                reason: `Falha Telegram: ${teams}`, details: { ...details, api_error: result.error }
                            });
                        }
                    }
                }
            } catch (fixtureErr) {
                console.error(`[Cron] Error fixture ${f.fixture.id}:`, fixtureErr);
                logsBuffer.push({
                    fixture_id: String(f.fixture.id), stage: 'CRON_ERROR',
                    reason: `Erro no jogo: ${fixtureErr instanceof Error ? fixtureErr.message : String(fixtureErr)}`,
                    details: { teams: `${f.teams.home.name} vs ${f.teams.away.name}` }
                });
            }
        }

        if (logsBuffer.length > 0) {
            await supabase.from('robot_execution_logs').insert(logsBuffer);
        }
    } catch (e) {
        console.error('Global Cron error:', e);
        try {
            await supabase.from('robot_execution_logs').insert([{
                fixture_id: '0', stage: 'CRON_ERROR',
                reason: `Erro crítico: ${e instanceof Error ? e.message : String(e)}`,
                details: { stack: e instanceof Error ? e.stack : null }
            }]);
        } catch { }
    }
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const authHeader = req.headers.get('Authorization');
    const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    const isAnon = authHeader === `Bearer ${SUPABASE_ANON_KEY}`;

    if (!isServiceRole && !isAnon) {
        const hasServiceRole = authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY);
        const hasAnon = authHeader?.includes(SUPABASE_ANON_KEY);
        const legacyAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E';
        const hasLegacyAnon = authHeader?.includes(legacyAnonKey);

        if (!hasServiceRole && !hasAnon && !hasLegacyAnon) {
            console.error('[Auth] Unauthorized request to live-robot-cron-v2');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    await runRobot();
    return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
});
