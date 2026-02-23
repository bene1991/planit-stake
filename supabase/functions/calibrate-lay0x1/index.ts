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

// Maps threshold keys to criteria_snapshot field names
const THRESHOLD_TO_SNAPSHOT: Record<string, string> = {
  min_home_goals_avg: 'home_goals_avg',
  min_away_conceded_avg: 'away_conceded_avg',
  min_over15_combined: 'over15_combined',
  max_h2h_0x1: 'h2h_0x1_count',
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

    // ========== PHASE 1: Weight calibration (existing logic) ==========
    const criteriaKeys = ['home_goals_avg', 'away_conceded_avg', 'over15_combined', 'league_goals_avg', 'h2h_0x1_count', 'away_odd'];
    const weightKeys = Object.keys(DEFAULT_WEIGHTS);

    const totalGreen = analyses.filter(a => a.result === 'Green').length;
    const generalRate = totalGreen / analyses.length;

    const criterionRates: number[] = [];

    for (const key of criteriaKeys) {
      const strongGames = analyses.filter(a => {
        const snapshot = a.criteria_snapshot as any;
        if (!snapshot?.criteria_met) return false;
        const metKey = key === 'h2h_0x1_count' ? 'h2h_no_0x1' : key;
        return snapshot.criteria_met[metKey] === true;
      });

      const strongGreens = strongGames.filter(a => a.result === 'Green').length;
      const rate = strongGames.length > 0 ? strongGreens / strongGames.length : generalRate;
      criterionRates.push(rate);
    }

    const avgRate = criterionRates.reduce((s, r) => s + r, 0) / criterionRates.length || generalRate;
    const newCycleCount = (weights.cycle_count || 0) + 1;

    const forcedRebalance = newCycleCount % 4 === 0;

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

    // ========== PHASE 2: Threshold calibration (NEW) ==========
    const greenAnalyses = analyses.filter(a => a.result === 'Green');
    const redAnalyses = analyses.filter(a => a.result === 'Red');

    const oldThresholds: Record<string, number> = {};
    const newThresholds: Record<string, number> = {};
    const thresholdDetails: Record<string, any> = {};

    for (const [thresholdKey, snapshotField] of Object.entries(THRESHOLD_TO_SNAPSHOT)) {
      const currentValue = (weights as any)[thresholdKey] ?? DEFAULT_THRESHOLDS[thresholdKey];
      oldThresholds[thresholdKey] = currentValue;

      // Extract values from criteria_snapshot for greens and reds
      const greenValues: number[] = [];
      const redValues: number[] = [];

      for (const a of greenAnalyses) {
        const snapshot = a.criteria_snapshot as any;
        const val = snapshot?.[snapshotField];
        if (val !== undefined && val !== null && typeof val === 'number') {
          greenValues.push(val);
        }
      }

      for (const a of redAnalyses) {
        const snapshot = a.criteria_snapshot as any;
        const val = snapshot?.[snapshotField];
        if (val !== undefined && val !== null && typeof val === 'number') {
          redValues.push(val);
        }
      }

      const [limitMin, limitMax] = THRESHOLD_LIMITS[thresholdKey];

      // Need at least some data in both groups
      if (greenValues.length < 3 || redValues.length < 2) {
        newThresholds[thresholdKey] = currentValue;
        thresholdDetails[thresholdKey] = {
          status: 'insufficient_data',
          green_count: greenValues.length,
          red_count: redValues.length,
        };
        continue;
      }

      let optimalCutoff: number;

      if (thresholdKey === 'max_h2h_0x1') {
        // For max_h2h_0x1, LOWER is better (fewer 0x1 in history)
        // Use p75 of greens and p25 of reds
        const greenP75 = getPercentile(greenValues, 75);
        const redP25 = getPercentile(redValues, 25);
        optimalCutoff = (greenP75 + redP25) / 2;
      } else {
        // For min thresholds, HIGHER is better
        // Use p25 of greens (weakest greens) and p75 of reds (strongest reds)
        const greenP25 = getPercentile(greenValues, 25);
        const redP75 = getPercentile(redValues, 75);
        optimalCutoff = (greenP25 + redP75) / 2;
      }

      // Smoothing: 70% calculated + 30% current
      const smoothed = 0.7 * optimalCutoff + 0.3 * currentValue;

      // Clamp to safety limits
      let finalValue = clamp(smoothed, limitMin, limitMax);

      // Round appropriately
      if (thresholdKey === 'max_h2h_0x1') {
        finalValue = Math.round(finalValue);
      } else if (thresholdKey === 'min_over15_combined') {
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

    // ========== PHASE 3: Upsert everything ==========
    const { error: upsertErr } = await supabase
      .from('lay0x1_weights')
      .upsert({
        owner_id: userId,
        ...newWeights,
        ...newThresholds,
        // max_away_odd stays untouched
        max_away_odd: (weights as any).max_away_odd ?? 4.5,
        cycle_count: newCycleCount,
        last_calibration_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_id' });

    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({
        message: 'Calibration complete',
        cycle: newCycleCount,
        forced_rebalance: forcedRebalance,
        total_analyses: analyses.length,
        general_rate: Math.round(generalRate * 100),
        criterion_rates: criteriaKeys.reduce((obj, k, i) => {
          obj[k] = Math.round(criterionRates[i] * 100);
          return obj;
        }, {} as Record<string, number>),
        old_weights: weightKeys.reduce((obj, k) => {
          obj[k] = (weights as any)[k];
          return obj;
        }, {} as Record<string, number>),
        new_weights: newWeights,
        old_thresholds: oldThresholds,
        new_thresholds: newThresholds,
        threshold_details: thresholdDetails,
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
