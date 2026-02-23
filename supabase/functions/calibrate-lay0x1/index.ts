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
      cycle_count: 0,
    };

    const criteriaKeys = ['home_goals_avg', 'away_conceded_avg', 'over15_combined', 'league_goals_avg', 'h2h_0x1_count', 'away_odd'];
    const weightKeys = Object.keys(DEFAULT_WEIGHTS);

    const totalGreen = analyses.filter(a => a.result === 'Green').length;
    const generalRate = totalGreen / analyses.length;

    // For each criterion, calculate success rate when criterion was "strong"
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

    // Check if forced rebalance is needed (anti-overfitting every ~120 games / cycle 4)
    const forcedRebalance = newCycleCount % 4 === 0;

    const newWeights: Record<string, number> = {};
    let totalNewWeight = 0;

    for (let i = 0; i < weightKeys.length; i++) {
      let currentW = (weights as any)[weightKeys[i]] as number;

      // Forced rebalance: pull weights towards defaults before applying formula
      if (forcedRebalance) {
        currentW = (currentW + DEFAULT_WEIGHTS[weightKeys[i]]) / 2;
      }

      const rate = criterionRates[i];
      let newW = currentW * (rate / (avgRate || 0.5));

      // Clamp between 5 and 30
      newW = Math.max(5, Math.min(30, newW));
      newWeights[weightKeys[i]] = newW;
      totalNewWeight += newW;
    }

    // Rebalance to sum to 100
    const scale = 100 / totalNewWeight;
    for (const key of weightKeys) {
      newWeights[key] = Math.round(newWeights[key] * scale * 10) / 10;
    }

    // Final adjustment to ensure exact 100
    const finalSum = weightKeys.reduce((s, k) => s + newWeights[k], 0);
    const diff = 100 - finalSum;
    newWeights[weightKeys[0]] = Math.round((newWeights[weightKeys[0]] + diff) * 10) / 10;

    // Upsert weights
    const { error: upsertErr } = await supabase
      .from('lay0x1_weights')
      .upsert({
        owner_id: userId,
        ...newWeights,
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
