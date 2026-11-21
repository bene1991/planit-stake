// IA de jogo quente: lê as estatísticas ao vivo já coletadas pelo robô e pede a um modelo da OpenAI
// uma leitura do jogo (intensidade, chance de gol nos próximos 10 min, explicação). Não dá palpite.
// Todos os jogos com estatística recente (os sem estatística são bloqueados antes de chamar a IA), entre os minutos 20 e 65,
// uma análise a cada ~10 min por jogo, com teto de gasto por dia. Ligas principais têm prioridade na fila e são marcadas em is_main.
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
const REANALYZE_MS = 9 * 60 * 1000; // uma análise a cada ~10 min por jogo
const MAX_PER_RUN = 150;
const CONCURRENCY = 8;
const SIGNAL_MIN_CHANCE = 60, SIGNAL_MIN_EDGE = 10; // regra provisória do sinal em teste: chance da IA >= 60% e pelo menos 10 pontos acima do mercado
const MAX_STALE_MS = 3 * 60 * 1000; // leitura do radar mais velha que isso = API parada, não analisa

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

// Variante de teste SEM âncora: a IA estima livremente, sem taxa base nem faixas de chance.
const SYSTEM_FREE = `Você é um analista de futebol ao vivo. Recebe estatísticas de UM jogo (acumuladas e dos últimos minutos) e estima o quanto ele está "quente" e a chance de sair gol nos próximos 25 minutos.
- Isto NÃO é palpite nem tip: descreva o que os números mostram.
- Use somente os dados enviados. Se faltar dado, diga que a leitura é limitada.
- Estime a chance de gol com base nos dados, usando toda a escala de 0 a 100 quando os dados justificarem. Pressão forte e recente (chutes, chutes no alvo, escanteios e jogo aberto) deve elevar bastante a chance; jogo parado deve reduzi-la.
- "heat" é a intensidade ofensiva observada agora (0 a 100), com mais peso para os últimos 10 minutos.
- Responda em português do Brasil, curto e direto.`;

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


// ── Mercado: preço do Over (gols atuais + 0,5) na Polymarket, só leitura ──────────────────────────────
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['fc', 'cf', 'sc', 'ca', 'cd', 'club', 'de', 'the', 'ac', 'afc', 'fk', 'sk', 'u21', 'u23', 'w', 'ii']);
const toks = (s: string) => norm(s).split(' ').filter(t => t.length > 2 && !STOP.has(t));
async function pmGet(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`PM ${r.status}`);
  return r.json();
}
// devolve o preço (0 a 1) de haver pelo menos mais um gol até o fim, ou null se não achar mercado confiável
async function marketOver(home: string, away: string, goals: number): Promise<{ price: number; backOdd: number; line: number; slug: string } | null> {
  try {
    const found = await pmGet(`https://gamma-api.polymarket.com/public-search?limit_per_type=6&q=${encodeURIComponent(`${home} ${away}`)}`);
    const hT = toks(home), aT = toks(away);
    if (!hT.length || !aT.length) return null;
    const ev = (found?.events || []).find((e: any) => {
      if (e.closed || !e.active) return false;
      const t = norm(e.title || '');
      if (!hT.some(x => t.includes(x)) || !aT.some(x => t.includes(x))) return false;
      const d = e.startTime ? new Date(e.startTime).getTime() : e.eventDate ? new Date(e.eventDate + 'T12:00:00Z').getTime() : NaN;
      return Math.abs(d - Date.now()) < 36 * 3600 * 1000;
    });
    if (!ev) return null;
    const line = goals + 0.5;
    let market: any = null;
    for (const slug of [`${ev.slug}-more-markets`, ev.slug]) {
      try { const r = await pmGet(`https://gamma-api.polymarket.com/events?slug=${slug}`); market = (r?.[0]?.markets || []).find((m: any) => m.sportsMarketType === 'totals' && Number(m.line) === line && m.active && !m.closed); if (market) break; } catch { /* tenta o próximo */ }
    }
    if (!market) return null;
    const outs: string[] = JSON.parse(market.outcomes), ids: string[] = JSON.parse(market.clobTokenIds);
    const i = outs.findIndex(o => o.toLowerCase() === 'over');
    if (i < 0) return null;
    const book = await pmGet(`https://clob.polymarket.com/book?token_id=${ids[i]}`);
    const lv = (a: any[]) => (a || []).map((b: any) => ({ p: Number(b.price), sz: Number(b.size) })).filter((b: any) => b.p > 0 && b.p < 1);
    const bids = lv(book?.bids).sort((a: any, b: any) => b.p - a.p), asks = lv(book?.asks).sort((a: any, b: any) => a.p - b.p);
    const solid = (l: any) => l && l.p * l.sz >= 1; // lance com pelo menos US$ 1, não migalha
    // só usa a média lance/pedido se o livro está apertado (afastamento de até 6 pontos); senão cai no último negócio
    let price: number | null = solid(bids[0]) && solid(asks[0]) && asks[0].p - bids[0].p <= 0.06 ? (bids[0].p + asks[0].p) / 2 : null;
    if (price == null) { try { const lt = Number((await pmGet(`https://clob.polymarket.com/last-trade-price?token_id=${ids[i]}`))?.price); if (lt > 0 && lt < 1) price = lt; } catch { /* sem último negócio */ } }
    if (price == null) return null;
    // odd executável do back no Over = comprar no melhor pedido (se for só migalha, usa o preço de referência)
    const backOdd = 1 / (solid(asks[0]) && asks[0].p <= price + 0.05 ? asks[0].p : price);
    return { price, backOdd, line, slug: ev.slug };
  } catch { return null; }
}
// converte "chance de pelo menos 1 gol até o fim" em "chance de gol nos próximos 25 min", supondo ritmo de gols constante
const p25FromOver = (pOver: number, minute: number) => 1 - Math.pow(1 - pOver, 25 / Math.max(5, 95 - minute));

// uma chamada ao modelo com o playbook; devolve a resposta estruturada e os tokens gastos
async function askModel(payload: any, system: string = SYSTEM) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL, temperature: 0.2, max_tokens: 350,
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(payload) }],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const out = JSON.parse(j.choices?.[0]?.message?.content || '{}');
  const tin = j.usage?.prompt_tokens ?? 0, tout = j.usage?.completion_tokens ?? 0;
  return { out, tin, tout };
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
  const { out, tin, tout } = await askModel(payload);
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
    is_main: LEAGUES.has(String(fx.league_id)),
    model: MODEL, tokens_in: tin, tokens_out: tout, cost_usd: (tin * PRICE_IN + tout * PRICE_OUT) / 1e6,
    features: payload, // guarda o que a IA viu, para depois medir quais sinais realmente separam jogo com gol de jogo sem gol
  };
  // mercado e sinal em teste
  const mk = await marketOver(fx.home_team, fx.away_team, row.goals_total);
  if (mk) {
    const p25 = Math.round(p25FromOver(mk.price, minute) * 100);
    Object.assign(row, { line: mk.line, over_price: mk.price, over_back_odd: Number(mk.backOdd.toFixed(2)), market_p25: p25, edge: row.goal_chance - p25, market_slug: mk.slug });
    (row as any).signal = row.goal_chance >= SIGNAL_MIN_CHANCE && row.goal_chance - p25 >= SIGNAL_MIN_EDGE;
  }
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


// ── Teste da IA no histórico (500 jogos sorteados, sem nomes de times nem liga) ───────────────────────
async function runBacktest(batch: number, variant: string = 'ancora') {
  const { data: sample, error } = variant === 'ancora'
    ? await supabase.rpc('ai_backtest_sample', { n: Math.min(batch, 120) })
    : await supabase.rpc('ai_backtest_same', { n: Math.min(batch, 120), v: variant });
  if (error) throw error;
  const gm = (g: any) => (g.minute || 0) + (g.extra || 0);
  let done = 0, failed = 0, cost = 0, idx = 0;
  const rows: any[] = sample || [];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (idx < rows.length) {
      const r = rows[idx++];
      try {
        const fm = r.stats?.fullMatch, w = r.stats?.window10Min;
        const ev: any[] = typeof r.goal_events === 'string' ? JSON.parse(r.goal_events) : (r.goal_events || []);
        const m = r.minute_at_alert || 0;
        const side2 = (o: any) => ({ chutes: o?.shots ?? 0, no_alvo: o?.shotsOn ?? 0, na_area: o?.shotsInBox ?? 0, escanteios: o?.corners ?? 0, posse: o?.possession ?? null, gols: o?.goals ?? 0 });
        const wsum = (w?.h?.shots ?? 0) + (w?.a?.shots ?? 0);
        const payload = {
          minuto: m, placar: `${fm.h.goals ?? 0} x ${fm.a.goals ?? 0}`,
          acumulado: { casa: side2(fm.h), fora: side2(fm.a) },
          ultimos_10_min: wsum > 0 ? { casa: { chutes: w.h.shots ?? 0, no_alvo: w.h.shotsOn ?? 0 }, fora: { chutes: w.a.shots ?? 0, no_alvo: w.a.shotsOn ?? 0 } } : null,
          ritmo: null, leitura_anterior: null,
        };
        const { out, tin, tout } = await askModel(payload, variant === 'sem_ancora' ? SYSTEM_FREE : SYSTEM);
        const clampN = (n: any) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
        const heat = clampN(out.heat);
        const c = (tin * PRICE_IN + tout * PRICE_OUT) / 1e6;
        const { error: e2 } = await supabase.from('ai_backtest').insert({
          fixture_id: r.fixture_id, alert_minute: m, goals_before: ev.filter((g: any) => gm(g) <= m).length,
          heat, goal_chance: clampN(out.goal_chance_25m), level: heat >= 75 ? 'muito_quente' : heat >= 55 ? 'quente' : heat >= 30 ? 'morno' : 'frio',
          summary: String(out.summary || '').slice(0, 280),
          goal25: ev.some((g: any) => gm(g) > m && gm(g) <= m + 25), goal10: ev.some((g: any) => gm(g) > m && gm(g) <= m + 10),
          tokens_in: tin, tokens_out: tout, cost_usd: c, variant,
        });
        if (e2) throw e2;
        done++; cost += c;
      } catch (e) { failed++; console.error('backtest', r.fixture_id, e instanceof Error ? e.message : e); }
    }
  }));
  const { count } = await supabase.from('ai_backtest').select('*', { count: 'exact', head: true }).eq('variant', variant);
  return { ok: true, backtest: true, analisados: done, falhas: failed, custo_lote_usd: Number(cost.toFixed(4)), total_no_teste: count };
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
    if (body?.backtest) return json(await runBacktest(Number(body.batch) || 100, body.variant || 'ancora'));
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
    // bloqueio antes da IA: jogo sem estatística (tudo zerado) ou com leitura velha (API parada) não é analisado
    const hasStats = (f: any) => {
      const sum = (k: string) => (f.stats_snapshot?.h?.[k] ?? 0) + (f.stats_snapshot?.a?.[k] ?? 0);
      return sum('possession') > 0 || sum('shots') > 0 || sum('corners') > 0;
    };
    const semEstatistica = (live || []).filter((f: any) => !hasStats(f)).length;
    const desatualizados = (live || []).filter((f: any) => hasStats(f) && Date.now() - new Date(f.updated_at).getTime() > MAX_STALE_MS).length;
    const cands = (live || [])
      .filter((f: any) => hasStats(f) && Date.now() - new Date(f.updated_at).getTime() <= MAX_STALE_MS)
      .sort((a: any, b: any) => Number(LEAGUES.has(String(b.league_id))) - Number(LEAGUES.has(String(a.league_id)))); // ligas principais primeiro
    if (!cands.length) return json({ ok: true, analisados: 0, candidatos: 0, bloqueados_sem_estatistica: semEstatistica, bloqueados_desatualizados: desatualizados });

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
    return json({ ok: true, candidatos: cands.length, analisados: done, falhas: failed, bloqueados_sem_estatistica: semEstatistica, bloqueados_desatualizados: desatualizados, gasto_hoje_usd: Number(total.toFixed(4)) });
  } catch (e) {
    console.error(e); return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
