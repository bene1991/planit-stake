import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_WEIGHTS: Record<string, number> = {
  offensive_weight: 20,
  defensive_weight: 20,
  over_weight: 20,
  league_avg_weight: 15,
  h2h_weight: 15,
  odds_weight: 10,
};

const DEFAULT_THRESHOLDS: Record<string, number> = {
  min_home_goals_avg: 1.5,
  min_away_conceded_avg: 1.5,
  min_over15_combined: 70,
  max_h2h_0x1: 0,
};

const THRESHOLD_LIMITS: Record<string, [number, number]> = {
  min_home_goals_avg: [1.0, 2.5],
  min_away_conceded_avg: [1.0, 2.5],
  min_over15_combined: [50, 120],
  max_h2h_0x1: [0, 2],
};

const THRESHOLD_TO_SNAPSHOT: Record<string, string> = {
  min_home_goals_avg: 'home_goals_avg',
  min_away_conceded_avg: 'away_conceded_avg',
  min_over15_combined: 'over15_combined',
  max_h2h_0x1: 'h2h_0x1_count',
};

const WEIGHT_LABELS: Record<string, string> = {
  offensive_weight: 'Força Ofensiva Casa',
  defensive_weight: 'Fragilidade Defensiva Visitante',
  over_weight: 'Tendência Over 1.5',
  league_avg_weight: 'Média Gols Liga',
  h2h_weight: 'Histórico H2H',
  odds_weight: 'Faixa de Odds',
};

const THRESHOLD_LABELS: Record<string, string> = {
  min_home_goals_avg: 'Mín. Gols Casa',
  min_away_conceded_avg: 'Mín. Gols Sofridos Fora',
  min_over15_combined: 'Mín. Over 1.5 Combinado',
  max_h2h_0x1: 'Máx. H2H 0x1',
};

function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getPercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ========== Pattern Detection ==========

function detectPatterns(analyses: any[]): Record<string, any> {
  const patterns: Record<string, any> = {};

  const leagueStats: Record<string, { total: number; reds: number }> = {};
  for (const a of analyses) {
    if (!leagueStats[a.league]) leagueStats[a.league] = { total: 0, reds: 0 };
    leagueStats[a.league].total++;
    if (a.result === 'Red') leagueStats[a.league].reds++;
  }
  const leagueRedRates = Object.entries(leagueStats)
    .map(([league, s]) => ({ league, rate: s.reds / s.total, total: s.total, reds: s.reds }))
    .filter(l => l.total >= 3)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);
  patterns.top_red_leagues = leagueRedRates;

  // Leagues to auto-block: Red rate > 50% with 3+ games
  patterns.leagues_to_block = leagueRedRates.filter(l => l.rate > 0.5 && l.total >= 3).map(l => l.league);

  const leagueConsecutiveReds: string[] = [];
  const leagueLastResults: Record<string, string[]> = {};
  for (const a of analyses) {
    if (!a.result) continue;
    if (!leagueLastResults[a.league]) leagueLastResults[a.league] = [];
    leagueLastResults[a.league].push(a.result);
  }
  for (const [league, results] of Object.entries(leagueLastResults)) {
    const last2 = results.slice(-2);
    if (last2.length === 2 && last2[0] === 'Red' && last2[1] === 'Red') {
      leagueConsecutiveReds.push(league);
    }
  }
  patterns.consecutive_red_leagues = leagueConsecutiveReds;

  const oddsRanges = [
    { label: '1.50-2.50', min: 1.5, max: 2.5 },
    { label: '2.50-3.50', min: 2.5, max: 3.5 },
    { label: '3.50-4.50', min: 3.5, max: 4.5 },
  ];
  const oddsPerformance = oddsRanges.map(range => {
    const inRange = analyses.filter(a => {
      const odd = (a.criteria_snapshot as any)?.away_odd;
      return odd >= range.min && odd < range.max;
    });
    const greens = inRange.filter(a => a.result === 'Green').length;
    return {
      range: range.label,
      total: inRange.length,
      greens,
      rate: inRange.length > 0 ? Math.round((greens / inRange.length) * 100) : 0,
    };
  });
  patterns.odds_performance = oddsPerformance;

  const redAnalyses = analyses.filter(a => a.result === 'Red');
  const redOffensiveAvgs = redAnalyses
    .map(a => (a.criteria_snapshot as any)?.home_goals_avg)
    .filter((v: any) => typeof v === 'number');
  if (redOffensiveAvgs.length > 0) {
    patterns.red_avg_offensive = {
      median: Math.round(getMedian(redOffensiveAvgs) * 100) / 100,
      count: redOffensiveAvgs.length,
    };
  }

  const redOver15 = redAnalyses
    .map(a => (a.criteria_snapshot as any)?.over15_combined)
    .filter((v: any) => typeof v === 'number');
  if (redOver15.length > 0) {
    patterns.red_avg_over15 = {
      median: Math.round(getMedian(redOver15) * 100) / 100,
      count: redOver15.length,
    };
  }

  return patterns;
}

// ========== AI Analysis Phase ==========

async function callAIForCalibration(data: {
  generalRate: number;
  criterionRates: Record<string, number>;
  oldWeights: Record<string, number>;
  newWeightsMath: Record<string, number>;
  oldThresholds: Record<string, number>;
  newThresholdsMath: Record<string, number>;
  patterns: Record<string, any>;
  recentGames: any[];
  currentMinScore: number;
  financialContext: {
    avg_lay_odd: number;
    profit_per_green_pct: number;
    break_even_rate_pct: number;
    greens_per_red: number;
    current_roi_pct: number;
    total_greens: number;
    total_reds: number;
  };
}): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('[AI] LOVABLE_API_KEY not set, skipping AI phase');
    return null;
  }

  const fc = data.financialContext;

  const prompt = `Você é um analista especialista em estratégia Lay 0x1 no futebol.

## ⚠️ CONTEXTO FINANCEIRO CRÍTICO - LEIA ANTES DE TUDO

Na estratégia Lay 0x1, apostamos CONTRA o placar 0x1. A odd média de entrada é **${fc.avg_lay_odd.toFixed(1)}**.
Isso significa:
- **Lucro por Green**: apenas **${fc.profit_per_green_pct.toFixed(2)}%** do liability (após comissão de 4.5%)
- **Perda por Red**: **100%** do liability
- **1 Red anula ${fc.greens_per_red} Greens**
- **Break-even real**: taxa de acerto mínima de **${fc.break_even_rate_pct.toFixed(1)}%** para não ter prejuízo
- ROI atual estimado: **${fc.current_roi_pct.toFixed(2)}%** (${fc.total_greens}G / ${fc.total_reds}R)

IMPORTANTE: Taxas de acerto abaixo de ${Math.round(fc.break_even_rate_pct)}% geram PREJUÍZO. Uma taxa de 50% seria CATASTRÓFICA (-${(50 - fc.break_even_rate_pct).toFixed(0)}pp abaixo do break-even). Suas recomendações DEVEM priorizar MAXIMIZAR a taxa de acerto acima de ${Math.round(fc.break_even_rate_pct)}%, mesmo que isso signifique aprovar MUITO menos jogos.

## Dados da Calibração

- Taxa de acerto geral: ${Math.round(data.generalRate * 100)}% ${Math.round(data.generalRate * 100) < Math.round(fc.break_even_rate_pct) ? '⚠️ ABAIXO DO BREAK-EVEN!' : '✅ Acima do break-even'}
- Score mínimo atual: ${data.currentMinScore}
- Taxas por critério: ${JSON.stringify(data.criterionRates)}

## Pesos
- Anteriores: ${JSON.stringify(data.oldWeights)}
- Calculados matematicamente: ${JSON.stringify(data.newWeightsMath)}

## Thresholds
- Anteriores: ${JSON.stringify(data.oldThresholds)}
- Calculados: ${JSON.stringify(data.newThresholdsMath)}

## Padrões Detectados
${JSON.stringify(data.patterns, null, 2)}

## Últimos 30 jogos (resultados)
${data.recentGames.map(g => `${g.home_team} vs ${g.away_team} (${g.league}) - Score: ${g.score_value} - ${g.result} ${g.was_0x1 ? '(0x1!)' : ''}`).join('\n')}

Com base no contexto financeiro (break-even de ${fc.break_even_rate_pct.toFixed(1)}%), analise tudo e retorne recomendações RIGOROSAS usando a função fornecida. Bloqueie ligas com QUALQUER Red se tiverem poucos jogos. Recomende score mínimo alto (75-90) se a taxa atual estiver abaixo do break-even.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um analista de dados esportivos especializado em Lay 0x1. Responda SEMPRE usando a função fornecida.' },
          { role: 'user', content: prompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'calibration_recommendations',
            description: 'Retorna recomendações estruturadas de calibração da IA',
            parameters: {
              type: 'object',
              properties: {
                weight_adjustments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string', description: 'Nome do peso (ex: offensive_weight)' },
                      recommended_value: { type: 'number', description: 'Valor recomendado (5-30)' },
                      reason: { type: 'string', description: 'Justificativa da alteração' },
                    },
                    required: ['key', 'recommended_value', 'reason'],
                  },
                },
                threshold_adjustments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      recommended_value: { type: 'number' },
                      reason: { type: 'string' },
                    },
                    required: ['key', 'recommended_value', 'reason'],
                  },
                },
                leagues_to_block: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Ligas que devem ser bloqueadas. SOMENTE ligas com pelo menos 1 Red no historico. NUNCA bloqueie ligas com 0 Reds.',
                },
                recommended_min_score: {
                  type: 'number',
                  description: 'Score mínimo recomendado (65-90). Com break-even de ~93%, seja rigoroso.',
                },
                trends: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tendências identificadas',
                },
                strategic_summary: {
                  type: 'string',
                  description: 'Resumo estratégico em linguagem natural',
                },
              },
              required: ['weight_adjustments', 'leagues_to_block', 'recommended_min_score', 'trends', 'strategic_summary'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'calibration_recommendations' } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error(`[AI] Gateway error: ${status}`);
      return null;
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      console.log('[AI] Recommendations received:', JSON.stringify(parsed).slice(0, 200));
      return parsed;
    }
    return null;
  } catch (err) {
    console.error('[AI] Error calling AI:', err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    // Get all resolved analyses
    const { data: analyses, error: aErr } = await supabase
      .from('lay0x1_analyses')
      .select('*')
      .eq('owner_id', userId)
      .not('result', 'is', null)
      .order('created_at', { ascending: true });

    if (aErr) throw aErr;
    // Filter to only use non-backtest games for calibration
    const realAnalyses = (analyses || []).filter(a => !(a as any).is_backtest);

    if (realAnalyses.length < 100) {
      return new Response(
        JSON.stringify({
          message: 'Insufficient real data for calibration',
          count: realAnalyses.length,
          required: 100
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current weights
    const { data: currentWeights } = await supabase
      .from('lay0x1_weights')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle();

    const weights = currentWeights || {
      ...DEFAULT_WEIGHTS,
      ...DEFAULT_THRESHOLDS,
      cycle_count: 0,
      min_score: 65,
    };

    const currentMinScore = (weights as any).min_score ?? 65;

    // ========== PHASE 1: Weight calibration (mathematical) ==========
    const criteriaKeys = ['home_goals_avg', 'away_conceded_avg', 'over15_combined', 'league_goals_avg', 'h2h_0x1_count', 'away_odd'];
    const weightKeys = Object.keys(DEFAULT_WEIGHTS);

    const totalGreen = realAnalyses.filter(a => a.result === 'Green').length;
    const generalRate = totalGreen / realAnalyses.length;

    const criterionRates: number[] = [];
    const criterionRatesObj: Record<string, number> = {};

    for (let i = 0; i < criteriaKeys.length; i++) {
      const key = criteriaKeys[i];
      const strongGames = realAnalyses.filter(a => {
        const snapshot = a.criteria_snapshot as any;
        if (!snapshot?.criteria_met) return false;
        const metKey = key === 'h2h_0x1_count' ? 'h2h_no_0x1' : key;
        return snapshot.criteria_met[metKey] === true;
      });

      const strongGreens = strongGames.filter(a => a.result === 'Green').length;
      const rate = strongGames.length > 0 ? strongGreens / strongGames.length : generalRate;
      criterionRates.push(rate);
      criterionRatesObj[key] = Math.round(rate * 100);
    }

    const avgRate = criterionRates.reduce((s, r) => s + r, 0) / criterionRates.length || generalRate;
    const newCycleCount = (weights.cycle_count || 0) + 1;
    const forcedRebalance = newCycleCount % 4 === 0;

    const oldWeightsObj: Record<string, number> = {};
    for (const k of weightKeys) {
      oldWeightsObj[k] = (weights as any)[k] ?? DEFAULT_WEIGHTS[k];
    }

    const mathWeights: Record<string, number> = {};
    let totalNewWeight = 0;

    for (let i = 0; i < weightKeys.length; i++) {
      const key = weightKeys[i];
      let currentW = (weights as any)[key] as number;
      if (forcedRebalance) {
        currentW = (currentW + DEFAULT_WEIGHTS[key]) / 2;
      }
      const rate = criterionRates[i];
      let newW = currentW * (rate / (avgRate || 0.5));

      // Enforce 10% limit (Controlled Adaptive)
      const maxDelta = currentW * 0.1;
      newW = clamp(newW, currentW - maxDelta, currentW + maxDelta);

      newW = Math.max(5, Math.min(30, newW));
      mathWeights[key] = newW;
      totalNewWeight += newW;
    }

    const scale = 100 / totalNewWeight;
    for (const key of weightKeys) {
      mathWeights[key] = Math.round(mathWeights[key] * scale * 10) / 10;
    }
    const finalSum = weightKeys.reduce((s, k) => s + mathWeights[k], 0);
    const diff = 100 - finalSum;
    mathWeights[weightKeys[0]] = Math.round((mathWeights[weightKeys[0]] + diff) * 10) / 10;

    // ========== PHASE 2: Threshold calibration (mathematical) ==========
    const greenAnalyses = analyses.filter(a => a.result === 'Green');
    const redAnalyses = analyses.filter(a => a.result === 'Red');

    const oldThresholds: Record<string, number> = {};
    const mathThresholds: Record<string, number> = {};
    const thresholdDetails: Record<string, any> = {};

    for (const [thresholdKey, snapshotField] of Object.entries(THRESHOLD_TO_SNAPSHOT)) {
      const currentValue = (weights as any)[thresholdKey] ?? DEFAULT_THRESHOLDS[thresholdKey];
      oldThresholds[thresholdKey] = currentValue;

      const greenValues: number[] = [];
      const redValues: number[] = [];

      for (const a of greenAnalyses) {
        const val = (a.criteria_snapshot as any)?.[snapshotField];
        if (val !== undefined && val !== null && typeof val === 'number') greenValues.push(val);
      }
      for (const a of redAnalyses) {
        const val = (a.criteria_snapshot as any)?.[snapshotField];
        if (val !== undefined && val !== null && typeof val === 'number') redValues.push(val);
      }

      const [limitMin, limitMax] = THRESHOLD_LIMITS[thresholdKey];

      if (greenValues.length < 3 || redValues.length < 2) {
        mathThresholds[thresholdKey] = currentValue;
        thresholdDetails[thresholdKey] = { status: 'insufficient_data', green_count: greenValues.length, red_count: redValues.length };
        continue;
      }

      let optimalCutoff: number;
      if (thresholdKey === 'max_h2h_0x1') {
        optimalCutoff = (getPercentile(greenValues, 75) + getPercentile(redValues, 25)) / 2;
      } else {
        optimalCutoff = (getPercentile(greenValues, 25) + getPercentile(redValues, 75)) / 2;
      }

      const smoothed = 0.7 * optimalCutoff + 0.3 * currentValue;
      let finalValue = clamp(smoothed, limitMin, limitMax);

      // Enforce 10% limit for thresholds
      const maxDelta = Math.abs(currentValue * 0.1);
      finalValue = clamp(finalValue, currentValue - maxDelta, currentValue + maxDelta);

      if (thresholdKey === 'max_h2h_0x1' || thresholdKey === 'min_over15_combined') {
        finalValue = Math.round(finalValue);
      } else {
        finalValue = Math.round(finalValue * 10) / 10;
      }

      mathThresholds[thresholdKey] = finalValue;
      thresholdDetails[thresholdKey] = {
        status: 'calibrated',
        green_median: Math.round(getMedian(greenValues) * 100) / 100,
        red_median: Math.round(getMedian(redValues) * 100) / 100,
        optimal_cutoff: Math.round(optimalCutoff * 100) / 100,
        old_value: currentValue,
        new_value: finalValue,
        changed: finalValue !== currentValue,
      };
    }

    // ========== PHASE 3: Pattern detection ==========
    const patterns = detectPatterns(realAnalyses);

    // ========== PHASE 4: AI Analysis (Gemini) ==========
    const recentGames = realAnalyses.slice(-30).map(a => ({
      home_team: a.home_team,
      away_team: a.away_team,
      league: a.league,
      score_value: a.score_value,
      result: a.result,
      was_0x1: a.was_0x1,
    }));

    // ========== PHASE 4.1: Calculate financial context ==========
    const allOdds = realAnalyses
      .map(a => (a.criteria_snapshot as any)?.away_odd)
      .filter((v: any) => typeof v === 'number' && v > 1);
    const avgLayOdd = allOdds.length > 0 ? allOdds.reduce((s: number, v: number) => s + v, 0) / allOdds.length : 15.0;
    const profitPerGreen = (1 / (avgLayOdd - 1)) * 0.955;
    const breakEvenRate = 1 / (1 + profitPerGreen);
    const greensPerRed = Math.ceil(1 / profitPerGreen);
    const totalReds = realAnalyses.filter(a => a.result === 'Red').length;
    const currentRoi = realAnalyses.length > 0
      ? ((totalGreen * profitPerGreen - totalReds) / realAnalyses.length) * 100
      : 0;

    const financialContext = {
      avg_lay_odd: avgLayOdd,
      profit_per_green_pct: profitPerGreen * 100,
      break_even_rate_pct: breakEvenRate * 100,
      greens_per_red: greensPerRed,
      current_roi_pct: currentRoi,
      total_greens: totalGreen,
      total_reds: totalReds,
    };

    console.log('[Calibration] Financial context:', JSON.stringify(financialContext));

    let aiRecommendations: any = null;
    const finalWeights = { ...mathWeights };
    const finalThresholds = { ...mathThresholds };
    let newMinScore = currentMinScore;
    const autoActions: string[] = [];

    try {
      // Strategic Volume Control
      const last7Days = realAnalyses.filter(a => {
        const created = new Date(a.created_at);
        return (Date.now() - created.getTime()) < 7 * 24 * 3600 * 1000;
      });
      const avgVolumePerDay = last7Days.length / 7;

      console.log(`[Volume Check] Avg volume/day (last 7d): ${avgVolumePerDay.toFixed(2)}`);

      let volumeAction = '';
      if (avgVolumePerDay < 5) {
        // Low volume: Relax criteria slightly (up to 5% relax)
        for (const k of ['min_home_goals_avg', 'min_away_conceded_avg', 'min_over15_combined']) {
          const relaxFactor = 0.95;
          finalThresholds[k] = Math.max(THRESHOLD_LIMITS[k][0], finalThresholds[k] * relaxFactor);
          if (k === 'min_over15_combined') finalThresholds[k] = Math.round(finalThresholds[k]);
          else finalThresholds[k] = Math.round(finalThresholds[k] * 10) / 10;
        }
        volumeAction = 'Volume baixo (< 5/dia): Critérios relaxados em 5%';
      } else if (avgVolumePerDay > 15 && currentRoi < 0) {
        // High volume but losing: Tighten criteria significantly
        for (const k of ['min_home_goals_avg', 'min_away_conceded_avg', 'min_over15_combined']) {
          const tightenFactor = 1.10;
          finalThresholds[k] = Math.min(THRESHOLD_LIMITS[k][1], finalThresholds[k] * tightenFactor);
          if (k === 'min_over15_combined') finalThresholds[k] = Math.round(finalThresholds[k]);
          else finalThresholds[k] = Math.round(finalThresholds[k] * 10) / 10;
        }
        volumeAction = 'Volume alto com ROI negativo: Critérios endurecidos em 10%';
      }
      if (volumeAction) autoActions.push(volumeAction);

      aiRecommendations = await callAIForCalibration({
        generalRate,
        criterionRates: criterionRatesObj,
        oldWeights: oldWeightsObj,
        newWeightsMath: mathWeights,
        oldThresholds,
        newThresholdsMath: mathThresholds,
        patterns,
        recentGames,
        currentMinScore,
        financialContext,
      });
    } catch (err) {
      console.error('[AI] Failed:', err);
    }

    // Apply AI recommendations if available
    if (aiRecommendations) {
      // Apply weight adjustments from AI
      if (aiRecommendations.weight_adjustments?.length > 0) {
        for (const adj of aiRecommendations.weight_adjustments) {
          if (weightKeys.includes(adj.key)) {
            const val = clamp(adj.recommended_value, 5, 30);
            finalWeights[adj.key] = Math.round(val * 10) / 10;
            autoActions.push(`IA: ${WEIGHT_LABELS[adj.key] || adj.key} → ${val} (${adj.reason})`);
          }
        }
        // Re-normalize weights to sum to 100
        const total = weightKeys.reduce((s, k) => s + finalWeights[k], 0);
        const sc = 100 / total;
        for (const k of weightKeys) {
          finalWeights[k] = Math.round(finalWeights[k] * sc * 10) / 10;
        }
        const fs = weightKeys.reduce((s, k) => s + finalWeights[k], 0);
        finalWeights[weightKeys[0]] = Math.round((finalWeights[weightKeys[0]] + (100 - fs)) * 10) / 10;
      }

      // Apply threshold adjustments from AI
      if (aiRecommendations.threshold_adjustments?.length > 0) {
        for (const adj of aiRecommendations.threshold_adjustments) {
          if (THRESHOLD_LIMITS[adj.key]) {
            const [lMin, lMax] = THRESHOLD_LIMITS[adj.key];
            finalThresholds[adj.key] = clamp(adj.recommended_value, lMin, lMax);
            autoActions.push(`IA: Threshold ${THRESHOLD_LABELS[adj.key] || adj.key} → ${finalThresholds[adj.key]} (${adj.reason})`);
          }
        }
      }

      // Apply recommended min score
      if (aiRecommendations.recommended_min_score) {
        newMinScore = clamp(aiRecommendations.recommended_min_score, 55, 90);
        if (newMinScore !== currentMinScore) {
          autoActions.push(`IA: Score mínimo ${currentMinScore} → ${newMinScore}`);
        }
      }

      // Auto-block leagues recommended by AI — ONLY if they have reds
      if (aiRecommendations.leagues_to_block?.length > 0) {
        for (const league of aiRecommendations.leagues_to_block) {
          const stats = leagueStats[league];
          if (!stats || stats.reds === 0) {
            console.log(`[AI] Skipping block for "${league}" — no reds (${stats?.total || 0} games, 0 reds)`);
            continue;
          }
          const { error: blockErr } = await supabase
            .from('lay0x1_blocked_leagues')
            .upsert(
              { owner_id: userId, league_name: league, reason: 'auto_ia' },
              { onConflict: 'owner_id,league_name', ignoreDuplicates: true }
            );
          if (!blockErr) {
            autoActions.push(`IA: Liga bloqueada automaticamente → ${league}`);
          }
        }
      }
    } else {
      // Fallback: auto-block leagues with > 50% Red and 3+ games (pattern-based)
      if (patterns.leagues_to_block?.length > 0) {
        for (const league of patterns.leagues_to_block) {
          const { error: blockErr } = await supabase
            .from('lay0x1_blocked_leagues')
            .upsert(
              { owner_id: userId, league_name: league, reason: 'auto_pattern' },
              { onConflict: 'owner_id,league_name', ignoreDuplicates: true }
            );
          if (!blockErr) {
            autoActions.push(`Auto-bloqueio: ${league} (Red > 50%)`);
          }
        }
      }

      // Fallback: dynamic min_score based on general rate
      if (generalRate < 0.65 && currentMinScore < 70) {
        newMinScore = 70;
        autoActions.push(`Score mínimo elevado: ${currentMinScore} → 70 (taxa geral ${Math.round(generalRate * 100)}%)`);
      } else if (generalRate >= 0.75 && currentMinScore > 65) {
        newMinScore = 65;
        autoActions.push(`Score mínimo restaurado: ${currentMinScore} → 65 (taxa geral ${Math.round(generalRate * 100)}%)`);
      }
    }

    // ========== PHASE 5: Build changes summary ==========
    const changesSummary: string[] = [];
    for (const key of weightKeys) {
      const oldVal = oldWeightsObj[key];
      const newVal = finalWeights[key];
      if (Math.abs(oldVal - newVal) >= 0.5) {
        const direction = newVal > oldVal ? 'fortalecido' : 'enfraquecido';
        changesSummary.push(`${WEIGHT_LABELS[key] || key}: ${oldVal} → ${newVal} (${direction})`);
      }
    }
    for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
      const oldVal = oldThresholds[key];
      const newVal = finalThresholds[key];
      if (oldVal !== newVal) {
        changesSummary.push(`Threshold ${THRESHOLD_LABELS[key] || key}: ${oldVal} → ${newVal}`);
      }
    }
    if (forcedRebalance) changesSummary.push('Anti-overfitting: rebalanceamento forçado aplicado');
    changesSummary.push(...autoActions);

    const triggerType = forcedRebalance && newCycleCount % (100 / 30) === 0 ? 'rebalance_100' : 'auto_30';

    // ========== PHASE 6: Upsert weights ==========
    const { error: upsertErr } = await supabase
      .from('lay0x1_weights')
      .upsert({
        owner_id: userId,
        ...finalWeights,
        ...finalThresholds,
        max_away_odd: (weights as any).max_away_odd ?? 4.5,
        min_score: newMinScore,
        cycle_count: newCycleCount,
        last_calibration_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_id' });

    if (upsertErr) throw upsertErr;

    // ========== PHASE 7: Save calibration history ==========
    const historyRecord = {
      owner_id: userId,
      cycle_number: newCycleCount,
      trigger_type: triggerType,
      total_analyses: analyses.length,
      general_rate: Math.round(generalRate * 100) / 100,
      old_weights: oldWeightsObj,
      new_weights: finalWeights,
      old_thresholds: oldThresholds,
      new_thresholds: finalThresholds,
      criterion_rates: criterionRatesObj,
      threshold_details: thresholdDetails,
      patterns_detected: patterns,
      changes_summary: changesSummary,
      forced_rebalance: forcedRebalance,
      ai_recommendations: aiRecommendations || {},
    };

    const { error: histErr } = await supabase
      .from('lay0x1_calibration_history')
      .insert(historyRecord);

    if (histErr) {
      console.error('Failed to save calibration history:', histErr);
    }

    return new Response(
      JSON.stringify({
        message: 'Calibration complete',
        cycle: newCycleCount,
        forced_rebalance: forcedRebalance,
        total_analyses: analyses.length,
        general_rate: Math.round(generalRate * 100),
        criterion_rates: criterionRatesObj,
        old_weights: oldWeightsObj,
        new_weights: finalWeights,
        old_thresholds: oldThresholds,
        new_thresholds: finalThresholds,
        threshold_details: thresholdDetails,
        patterns_detected: patterns,
        changes_summary: changesSummary,
        ai_recommendations: aiRecommendations,
        auto_actions: autoActions,
        min_score: newMinScore,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in calibrate-lay0x1:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
