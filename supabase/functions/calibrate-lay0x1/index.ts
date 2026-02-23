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

  // 1. Leagues with highest Red rate
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

  // 2. Leagues with 2+ consecutive Reds (auto-escalation alert)
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

  // 3. Odds ranges with worst performance
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

  // 4. Offensive averages not converting
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

  // 5. Over 1.5 artificial trend
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

function buildChangesSummary(
  weightKeys: string[],
  oldWeightsObj: Record<string, number>,
  newWeights: Record<string, number>,
  oldThresholds: Record<string, number>,
  newThresholds: Record<string, number>,
  generalRate: number,
  forcedRebalance: boolean,
): string[] {
  const changes: string[] = [];

  for (const key of weightKeys) {
    const oldVal = oldWeightsObj[key] ?? DEFAULT_WEIGHTS[key];
    const newVal = newWeights[key];
    if (Math.abs(oldVal - newVal) >= 0.5) {
      const direction = newVal > oldVal ? 'fortalecido' : 'enfraquecido';
      changes.push(`${WEIGHT_LABELS[key] || key}: ${oldVal} → ${newVal} (${direction})`);
    }
  }

  for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
    const oldVal = oldThresholds[key];
    const newVal = newThresholds[key];
    if (oldVal !== newVal) {
      changes.push(`Threshold ${THRESHOLD_LABELS[key] || key}: ${oldVal} → ${newVal}`);
    }
  }

  if (forcedRebalance) {
    changes.push('Anti-overfitting: rebalanceamento forçado aplicado');
  }

  if (generalRate < 0.65) {
    changes.push(`⚠️ Taxa geral (${Math.round(generalRate * 100)}%) abaixo de 65% - recomendado elevar score mínimo`);
  }

  return changes;
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
    if (!analyses || analyses.length < 10) {
      return new Response(
        JSON.stringify({ message: 'Insufficient data for calibration', count: analyses?.length || 0 }),
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
    };

    // ========== PHASE 1: Weight calibration ==========
    const criteriaKeys = ['home_goals_avg', 'away_conceded_avg', 'over15_combined', 'league_goals_avg', 'h2h_0x1_count', 'away_odd'];
    const weightKeys = Object.keys(DEFAULT_WEIGHTS);

    const totalGreen = analyses.filter(a => a.result === 'Green').length;
    const generalRate = totalGreen / analyses.length;

    const criterionRates: number[] = [];
    const criterionRatesObj: Record<string, number> = {};

    for (let i = 0; i < criteriaKeys.length; i++) {
      const key = criteriaKeys[i];
      const strongGames = analyses.filter(a => {
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

    // Save old weights for history
    const oldWeightsObj: Record<string, number> = {};
    for (const k of weightKeys) {
      oldWeightsObj[k] = (weights as any)[k] ?? DEFAULT_WEIGHTS[k];
    }

    const newWeights: Record<string, number> = {};
    let totalNewWeight = 0;

    for (let i = 0; i < weightKeys.length; i++) {
      let currentW = (weights as any)[weightKeys[i]] as number;

      if (forcedRebalance) {
        currentW = (currentW + DEFAULT_WEIGHTS[weightKeys[i]]) / 2;
      }

      const rate = criterionRates[i];
      let newW = currentW * (rate / (avgRate || 0.5));
      newW = Math.max(5, Math.min(30, newW));
      newWeights[weightKeys[i]] = newW;
      totalNewWeight += newW;
    }

    const scale = 100 / totalNewWeight;
    for (const key of weightKeys) {
      newWeights[key] = Math.round(newWeights[key] * scale * 10) / 10;
    }

    const finalSum = weightKeys.reduce((s, k) => s + newWeights[k], 0);
    const diff = 100 - finalSum;
    newWeights[weightKeys[0]] = Math.round((newWeights[weightKeys[0]] + diff) * 10) / 10;

    // ========== PHASE 2: Threshold calibration ==========
    const greenAnalyses = analyses.filter(a => a.result === 'Green');
    const redAnalyses = analyses.filter(a => a.result === 'Red');

    const oldThresholds: Record<string, number> = {};
    const newThresholds: Record<string, number> = {};
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
        newThresholds[thresholdKey] = currentValue;
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

      if (thresholdKey === 'max_h2h_0x1' || thresholdKey === 'min_over15_combined') {
        finalValue = Math.round(finalValue);
      } else {
        finalValue = Math.round(finalValue * 10) / 10;
      }

      newThresholds[thresholdKey] = finalValue;
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
    const patterns = detectPatterns(analyses);

    // ========== PHASE 4: Build changes summary ==========
    const triggerType = forcedRebalance && newCycleCount % (100 / 30) === 0 ? 'rebalance_100' : (forcedRebalance ? 'auto_30' : 'auto_30');
    const changesSummary = buildChangesSummary(weightKeys, oldWeightsObj, newWeights, oldThresholds, newThresholds, generalRate, forcedRebalance);

    // ========== PHASE 5: Upsert weights ==========
    const { error: upsertErr } = await supabase
      .from('lay0x1_weights')
      .upsert({
        owner_id: userId,
        ...newWeights,
        ...newThresholds,
        max_away_odd: (weights as any).max_away_odd ?? 4.5,
        cycle_count: newCycleCount,
        last_calibration_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_id' });

    if (upsertErr) throw upsertErr;

    // ========== PHASE 6: Save calibration history ==========
    const historyRecord = {
      owner_id: userId,
      cycle_number: newCycleCount,
      trigger_type: triggerType,
      total_analyses: analyses.length,
      general_rate: Math.round(generalRate * 100) / 100,
      old_weights: oldWeightsObj,
      new_weights: newWeights,
      old_thresholds: oldThresholds,
      new_thresholds: newThresholds,
      criterion_rates: criterionRatesObj,
      threshold_details: thresholdDetails,
      patterns_detected: patterns,
      changes_summary: changesSummary,
      forced_rebalance: forcedRebalance,
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
        new_weights: newWeights,
        old_thresholds: oldThresholds,
        new_thresholds: newThresholds,
        threshold_details: thresholdDetails,
        patterns_detected: patterns,
        changes_summary: changesSummary,
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
