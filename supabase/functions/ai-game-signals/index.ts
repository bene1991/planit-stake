// IA de jogo quente: lê as estatísticas ao vivo já coletadas pelo robô e pede a um modelo da OpenAI
// uma leitura do jogo (intensidade, chance de gol nos próximos 10 min, explicação). Não dá palpite.
// Piloto: só ligas principais, jogos entre o minuto 20 e 80, uma análise a cada ~5 min por jogo, com teto de gasto por dia.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
let OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''; // segredo da função; se não existir, lê da tabela fechada app_secrets
const MODEL = Deno.env.get('AI_MODEL') || 'gpt-4.1-mini';
const DAILY_BUDGET_USD = Number(Deno.env.get('AI_DAILY_BUDGET_USD') || '1'); // teto por dia (horário de Brasília)
// preço em US$ por 1 milhão de tokens (confira no painel da OpenAI e ajuste por variável de ambiente se mudar)
const PRICE_IN = Number(Deno.env.get('AI_PRICE_IN') || '0.40');
const PRICE_OUT = Number(Deno.env.get('AI_PRICE_OUT') || '1.60');
// ids de liga da API-Football: Premier, La Liga, Serie A, Bundesliga, Ligue 1, Champions, Europa, Conference, Brasileirão A,
// Libertadores, Sul-Americana, Copa do Brasil, Argentina, Eredivisie, Primeira Liga, Championship, MLS, Liga MX, Saudi
const LEAGUES = new Set((Deno.env.get('AI_LEAGUES') || '39,140,135,78,61,2,3,848,71,13,11,73,128,88,94,40,253,262,307').split(',').map(s => s.trim()));
const MIN_MINUTE = 20, MAX_MINUTE = 65; // até o minuto 65 para a janela de 25 min caber no tempo regular
const REANALYZE_MS = 4.5 * 60 * 1000;
const MAX_PER_RUN = 30;
const CONCURRENCY = 5;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// PLAYBOOK v0 — só afirma o que foi medido nos dados do próprio sistema (18,9 mil leituras de 5 mil jogos, nov/2026).
// Revise esta seção conforme a tabela "A IA está acertando?" e os dados gravados em ai_game_signals.features.
const SYSTEM = `Você é um analista de futebol ao vivo. Recebe estatísticas de UM jogo (acumuladas e dos últimos minutos) e descreve o quanto o jogo está "quente" e a chance de sair gol nos próximos 25 minutos.

REGRAS
- Isto NÃO é palpite nem tip. Descreva o que os números mostram, sem recomendar aposta.
- Use somente os dados enviados. Se faltar dado, diga que a leitura é limitada.
- Responda em português do Brasil, curto e direto.

O QUE OS DADOS DO SISTEMA MOSTRAM (use como âncora)
- Taxa base (jogos entre os minutos 15 e 49): sai gol nos próximos 25 minutos em cerca de 56% dos casos.
- Nas medições deste sistema, chutes, chutes no alvo, escanteios, posse e chutes dentro da área NÃO separaram bem os jogos que tiveram gol dos que não tiveram: a taxa ficou praticamente igual em todas as faixas. Pressão acumulada sozinha é um sinal fraco.
- Por isso, na grande maioria dos jogos, a chance de gol em 25 minutos deve ficar entre 45% e 66%. Só saia dessa faixa se vários sinais fortes e recentes apontarem na mesma direção, e nunca passe de 80%.
- Sinais com algum apoio, ainda modestos: jogo com 2 ou mais gols já marcados (cerca de 60%), alertas a partir do minuto 35 (cerca de 59 a 60%).
- A taxa de gol varia entre ligas, mas você NÃO recebe a taxa da liga: não afirme que uma liga tem muitos ou poucos gols.
- Hipóteses de futebol NÃO confirmadas nos dados (cite só como contexto, sem inflar a chance): time perdendo e pressionando no fim do jogo, expulsão, jogo aberto com os dois times atacando.

COMO AVALIAR "JOGO QUENTE"
- "heat" descreve a intensidade ofensiva observada agora (volume e qualidade das finalizações nos últimos 5 e 10 minutos, escanteios, domínio). É uma descrição do jogo, não uma previsão. Use esta escala, somando os dois times nos últimos 10 minutos:
  0 a 29 = jogo parado (0 ou 1 chute); 30 a 54 = ritmo normal (2 a 3 chutes, no máximo 1 no alvo); 55 a 74 = movimentado (4 a 6 chutes, 2 ou mais no alvo, ou várias finalizações dentro da área); 75 a 100 = muito intenso (7 ou mais chutes, 3 ou mais no alvo, escanteios em sequência).
  Se os últimos 10 minutos vierem sem dados, avalie pelo acumulado e diga que a leitura é limitada, com heat até 45.
- "trend" compara os últimos 5 minutos com os 5 anteriores (veja "ritmo"). Se os chutes dos últimos 5 minutos forem pelo menos 2 a mais que os 5 anteriores, é "subindo"; se forem pelo menos 2 a menos, é "caindo"; em qualquer outro caso é "estavel". Sem dados de ritmo, use "estavel".
- "goal_chance_25m" é a previsão, ancorada na taxa base. Um jogo muito intenso pode ter heat alto e ainda assim chance perto da média.
- Dê mais peso ao que aconteceu nos últimos 10 minutos do que ao acumulado, e diga na explicação o que sustenta a leitura.`;

const SCHEMA = {
  name: 'sinal_jogo',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['heat', 'goal_chance_25m', 'level', 'trend', 'summary', 'drivers'],
    properties: {
      heat: { type: 'integer', description: 'Intensidade ofensiva do jogo agora, de 0 a 100' },
      goal_chance_25m: { type: 'integer', description: 'Chance de sair gol nos próximos 25 minutos, de 0 a 100' },
      level: { type: 'string', enum: ['frio', 'morno', 'quente', 'muito_quente'] },
      trend: { type: 'string', enum: ['subindo', 'estavel', 'caindo'] },
      summary: { type: 'string', description: 'Leitura do jogo em até 220 caracteres' },
      drivers: { type: 'array', items: { type: 'string' }, description: 'Até 3 motivos curtos' },
    },
  },
};

const bDay = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const startOfDayBR = () => new Date(`${bDay()}T00:00:00-03:00`).toISOString();

const side = (s: any) => ({ chutes: s?.shots ?? 0, no_alvo: s?.shotsOn ?? 0, na_area: s?.shotsInBox ?? 0, escanteios: s?.corners ?? 0, posse: s?.possession ?? null, gols: s?.goals ?? 0 });
const diff = (a: any, b: any) => ({
  chutes: Math.max(0, (a?.shots ?? 0) - (b?.shots ?? 0)), no_alvo: Math.max(0, (a?.shotsOn ?? 0) - (b?.shotsOn ?? 0)),
  na_area: Math.max(0, (a?.shotsInBox ?? 0) - (b?.shotsInBox ?? 0)), escanteios: Math.max(0, (a?.corners ?? 0) - (b?.corners ?? 0)),
});

// fatos para a tendência: chutes e chutes no alvo (os dois times) nos últimos 5 min contra os 5 anteriores
function ritmoDe(now: any, s5: any, s10: any) {
  const sum = (o: any, k: string) => (o?.h?.[k] ?? 0) + (o?.a?.[k] ?? 0);
  const chutes5 = Math.max(0, sum(now, 'shots') - sum(s5, 'shots')), chutes10 = Math.max(0, sum(now, 'shots') - sum(s10, 'shots'));
  const alvo5 = Math.max(0, sum(now, 'shotsOn') - sum(s5, 'shotsOn')), alvo10 = Math.max(0, sum(now, 'shotsOn') - sum(s10, 'shotsOn'));
  return { chutes_ultimos_5: chutes5, chutes_5_anteriores: Math.max(0, chutes10 - chutes5), no_alvo_ultimos_5: alvo5, no_alvo_5_anteriores: Math.max(0, alvo10 - alvo5) };
}

async function analyze(fx: any, prevSignal: any | null, dry = false) {
  const now = fx.stats_snapshot || {};
  const minute = fx.minute || 0;
  // histórico minuto a minuto do próprio robô: pega o ponto mais próximo de 5 e 10 minutos atrás
  const { data: snaps } = await supabase.from('live_stats_snapshots').select('minute, stats_json')
    .eq('fixture_id', String(fx.fixture_id)).gte('minute', minute - 12).lte('minute', minute).order('minute', { ascending: true });
  const pick = (target: number) => (snaps || []).filter((s: any) => s.minute <= target).slice(-1)[0] || (snaps || [])[0];
  const s5 = pick(minute - 5), s10 = pick(minute - 10);
  const payload = {
    minuto: minute, placar: `${fx.home_team} ${fx.home_score} x ${fx.away_score} ${fx.away_team}`, liga: fx.league_name,
    acumulado: { casa: side(now.h), fora: side(now.a) },
    ultimos_5_min: s5 ? { casa: diff(now.h, s5.stats_json?.h), fora: diff(now.a, s5.stats_json?.a) } : null,
    ritmo: s5 && s10 ? ritmoDe(now, s5.stats_json, s10.stats_json) : null,
    ultimos_10_min: s10 ? { casa: diff(now.h, s10.stats_json?.h), fora: diff(now.a, s10.stats_json?.a) } : null,
    leitura_anterior: prevSignal ? { minuto: prevSignal.minute, heat: prevSignal.heat, chance_gol: prevSignal.goal_chance, nivel: prevSignal.level } : null,
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL, temperature: 0.2, max_tokens: 350,
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(payload) }],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const out = JSON.parse(j.choices?.[0]?.message?.content || '{}');
  const tin = j.usage?.prompt_tokens ?? 0, tout = j.usage?.completion_tokens ?? 0;
  // tendência calculada nos fatos (a IA não decide isso): chutes dos últimos 5 min contra os 5 anteriores, diferença mínima de 2
  const trendOf = (r: any) => (!r ? 'estavel' : r.chutes_ultimos_5 - r.chutes_5_anteriores >= 2 ? 'subindo' : r.chutes_5_anteriores - r.chutes_ultimos_5 >= 2 ? 'caindo' : 'estavel');
  const levelOf = (h: number) => (h >= 75 ? 'muito_quente' : h >= 55 ? 'quente' : h >= 30 ? 'morno' : 'frio'); // o nível sempre bate com o número
  const clamp = (n: any) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const row = {
    fixture_id: String(fx.fixture_id), league_id: String(fx.league_id ?? ''), league_name: fx.league_name,
    home_team: fx.home_team, away_team: fx.away_team, minute, score: `${fx.home_score}-${fx.away_score}`,
    goals_total: (fx.home_score || 0) + (fx.away_score || 0),
    heat: clamp(out.heat), goal_chance: clamp(out.goal_chance_25m), level: levelOf(clamp(out.heat)), trend: trendOf(payload.ritmo),
    summary: String(out.summary || '').slice(0, 280), drivers: Array.isArray(out.drivers) ? out.drivers.slice(0, 3) : [],
    model: MODEL, tokens_in: tin, tokens_out: tout, cost_usd: (tin * PRICE_IN + tout * PRICE_OUT) / 1e6,
    features: payload, // guarda o que a IA viu, para depois medir quais sinais realmente separam jogo com gol de jogo sem gol
  };
  if (!dry) { const { error } = await supabase.from('ai_game_signals').insert(row); if (error) throw error; }
  return row;
}

// preenche "saiu gol nos 25 min seguintes?" nas leituras antigas, comparando com o histórico minuto a minuto
async function resolveOld() {
  const { data: pend } = await supabase.from('ai_game_signals').select('id, fixture_id, minute, goals_total')
    .is('goal_next25', null).lt('created_at', new Date(Date.now() - 29 * 60 * 1000).toISOString())
    .gte('created_at', new Date(Date.now() - 8 * 3600 * 1000).toISOString()).limit(100);
  for (const p of pend || []) {
    const { data: later } = await supabase.from('live_stats_snapshots').select('minute, stats_json')
      .eq('fixture_id', p.fixture_id).gte('minute', p.minute + 25).order('minute', { ascending: true }).limit(1);
    const s = later?.[0]; if (!s) continue;
    const g = (s.stats_json?.h?.goals ?? 0) + (s.stats_json?.a?.goals ?? 0);
    await supabase.from('ai_game_signals').update({ goal_next25: g > (p.goals_total ?? 0) }).eq('id', p.id);
  }
}

serve(async (req) => {
  const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  if (!OPENAI_API_KEY) {
    const { data: sec } = await supabase.from('app_secrets').select('value').eq('name', 'OPENAI_API_KEY').maybeSingle();
    OPENAI_API_KEY = sec?.value || '';
  }
  if (!OPENAI_API_KEY) return json({ ok: false, error: 'OPENAI_API_KEY não configurada' });
  try {
    // modo teste: analisa um jogo fictício e devolve a resposta, sem gravar nada
    const body = await req.json().catch(() => ({}));
    if (body?.test && body?.fixture_id) {
      // teste com um jogo real do radar (mesmo no intervalo), sem gravar
      const { data: fx } = await supabase.from('radar_live_fixtures').select('*').eq('fixture_id', String(body.fixture_id)).maybeSingle();
      if (!fx) return json({ ok: false, error: 'jogo não está no radar' });
      return json({ ok: true, teste: true, resposta: await analyze(fx, null, true) });
    }
    if (body?.test) {
      const row = await analyze({ fixture_id: 'teste', league_id: '39', league_name: 'Teste', home_team: 'Casa', away_team: 'Fora', minute: 34, home_score: 0, away_score: 0,
        stats_snapshot: { h: { shots: 9, shotsOn: 4, shotsInBox: 6, corners: 5, possession: 61, goals: 0 }, a: { shots: 3, shotsOn: 1, shotsInBox: 1, corners: 1, possession: 39, goals: 0 } } }, null, true);
      return json({ ok: true, teste: true, resposta: row });
    }
    await resolveOld().catch(e => console.error('resolveOld', e));
    const { data: spent } = await supabase.from('ai_game_signals').select('cost_usd').gte('created_at', startOfDayBR());
    let total = (spent || []).reduce((a: number, r: any) => a + Number(r.cost_usd || 0), 0);
    if (total >= DAILY_BUDGET_USD) return json({ ok: true, skipped: 'teto diário atingido', gasto_usd: total });

    const { data: live } = await supabase.from('radar_live_fixtures').select('*')
      .in('status', ['1H', '2H']).gte('minute', MIN_MINUTE).lte('minute', MAX_MINUTE);
    const cands = (live || []).filter((f: any) => LEAGUES.has(String(f.league_id)));
    if (!cands.length) return json({ ok: true, analisados: 0, candidatos: 0 });

    const { data: recent } = await supabase.from('ai_game_signals').select('*')
      .in('fixture_id', cands.map((f: any) => String(f.fixture_id))).gte('created_at', new Date(Date.now() - 20 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    const last = new Map<string, any>();
    for (const r of recent || []) if (!last.has(r.fixture_id)) last.set(r.fixture_id, r);
    const todo = cands.filter((f: any) => { const l = last.get(String(f.fixture_id)); return !l || Date.now() - new Date(l.created_at).getTime() >= REANALYZE_MS; }).slice(0, MAX_PER_RUN);

    let done = 0, failed = 0, idx = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (idx < todo.length && total < DAILY_BUDGET_USD) {
        const f = todo[idx++];
        try { total += (await analyze(f, last.get(String(f.fixture_id)) || null)).cost_usd; done++; }
        catch (e) { failed++; console.error('analyze', f.fixture_id, e instanceof Error ? e.message : e); }
      }
    }));
    return json({ ok: true, candidatos: cands.length, analisados: done, falhas: failed, gasto_hoje_usd: Number(total.toFixed(4)) });
  } catch (e) {
    console.error(e); return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
