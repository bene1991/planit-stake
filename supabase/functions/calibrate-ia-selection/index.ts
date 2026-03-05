import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Thresholds {
    max_away_odd: number;
    min_home_goals_avg: number;
    min_away_conceded_avg: number;
    min_btts_pct: number;
    min_over25_pct: number;
    max_home_clean_sheet_pct: number;
    max_away_clean_sheet_pct: number;
}

interface SafetyBounds {
    bound_max_away_odd: number;
    bound_min_away_odd: number;
    bound_min_home_goals: number;
    bound_max_home_goals: number;
    bound_min_btts: number;
    bound_max_btts: number;
    bound_min_cs: number;
    bound_max_cs: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, serviceKey);

        const authHeader = req.headers.get('Authorization')!;
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) throw new Error('Unauthorized');

        // 1. Get current thresholds (or create defaults)
        let { data: thresholdRow } = await supabase
            .from('lay0x1_ia_thresholds')
            .select('*')
            .eq('owner_id', user.id)
            .maybeSingle();

        if (!thresholdRow) {
            const { data: newRow } = await supabase
                .from('lay0x1_ia_thresholds')
                .insert({ owner_id: user.id })
                .select()
                .single();
            thresholdRow = newRow;
        }

        const currentThresholds: Thresholds = {
            max_away_odd: parseFloat(thresholdRow.max_away_odd),
            min_home_goals_avg: parseFloat(thresholdRow.min_home_goals_avg),
            min_away_conceded_avg: parseFloat(thresholdRow.min_away_conceded_avg),
            min_btts_pct: parseFloat(thresholdRow.min_btts_pct),
            min_over25_pct: parseFloat(thresholdRow.min_over25_pct),
            max_home_clean_sheet_pct: parseFloat(thresholdRow.max_home_clean_sheet_pct),
            max_away_clean_sheet_pct: parseFloat(thresholdRow.max_away_clean_sheet_pct),
        };

        const bounds: SafetyBounds = {
            bound_max_away_odd: parseFloat(thresholdRow.bound_max_away_odd),
            bound_min_away_odd: parseFloat(thresholdRow.bound_min_away_odd),
            bound_min_home_goals: parseFloat(thresholdRow.bound_min_home_goals),
            bound_max_home_goals: parseFloat(thresholdRow.bound_max_home_goals),
            bound_min_btts: parseFloat(thresholdRow.bound_min_btts),
            bound_max_btts: parseFloat(thresholdRow.bound_max_btts),
            bound_min_cs: parseFloat(thresholdRow.bound_min_cs),
            bound_max_cs: parseFloat(thresholdRow.bound_max_cs),
        };

        // 2. Fetch resolved IA Selection analyses
        const { data: iaGames } = await supabase
            .from('lay0x1_analyses')
            .select('*')
            .eq('owner_id', user.id)
            .eq('source_list', 'ia_selection')
            .not('result', 'is', null)
            .order('date', { ascending: false })
            .limit(100);

        const { data: standardGames } = await supabase
            .from('lay0x1_analyses')
            .select('*')
            .eq('owner_id', user.id)
            .eq('source_list', 'lista_padrao')
            .not('result', 'is', null)
            .order('date', { ascending: false })
            .limit(100);

        const iaList = iaGames || [];
        const stdList = standardGames || [];

        if (iaList.length < 5) {
            return new Response(JSON.stringify({
                error: 'Poucos jogos IA Selection resolvidos para calibrar (mínimo: 5)',
                ia_count: iaList.length,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 3. Analyze win rate by threshold ranges for each criterion
        const iaGreens = iaList.filter(g => g.result === 'Green').length;
        const iaWinRate = iaList.length > 0 ? (iaGreens / iaList.length) * 100 : 0;
        const stdGreens = stdList.filter(g => g.result === 'Green').length;
        const stdWinRate = stdList.length > 0 ? (stdGreens / stdList.length) * 100 : 0;

        // Analyze which criteria values correlate with wins
        const greenGames = iaList.filter(g => g.result === 'Green');
        const redGames = iaList.filter(g => g.result === 'Red');

        const adjustments: string[] = [];
        const newThresholds = { ...currentThresholds };

        // Helper: compute average of a criteria field from games' criteria_snapshot
        const avgCriteria = (games: any[], field: string): number => {
            const values = games.map(g => {
                const cs = g.criteria_snapshot;
                return cs?.[field] || 0;
            }).filter(v => v > 0);
            return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        };

        // Adjustment step size (conservative: 5-10% of range)
        const STEP = 0.15;

        // --- Away Odd threshold ---
        const greenAvgOdd = avgCriteria(greenGames, 'away_odd');
        const redAvgOdd = avgCriteria(redGames, 'away_odd');
        if (redAvgOdd > 0 && greenAvgOdd > 0 && redAvgOdd > greenAvgOdd + 0.3) {
            // Reds tend to have higher away odds → tighten the ceiling
            const adjustment = (redAvgOdd - greenAvgOdd) * STEP;
            newThresholds.max_away_odd = clamp(
                currentThresholds.max_away_odd - adjustment,
                bounds.bound_min_away_odd,
                bounds.bound_max_away_odd
            );
            newThresholds.max_away_odd = Math.round(newThresholds.max_away_odd * 100) / 100;
            adjustments.push(`max_away_odd: ${currentThresholds.max_away_odd} → ${newThresholds.max_away_odd} (Reds avg @${redAvgOdd.toFixed(2)} vs Greens avg @${greenAvgOdd.toFixed(2)})`);
        }

        // --- Home goals avg threshold ---
        const greenHomeGoals = avgCriteria(greenGames, 'home_goals_avg');
        const redHomeGoals = avgCriteria(redGames, 'home_goals_avg');
        if (greenHomeGoals > 0 && redHomeGoals > 0 && greenHomeGoals > redHomeGoals + 0.1) {
            // Greens have higher home goals avg → raise the minimum
            const adjustment = (greenHomeGoals - redHomeGoals) * STEP;
            newThresholds.min_home_goals_avg = clamp(
                currentThresholds.min_home_goals_avg + adjustment,
                bounds.bound_min_home_goals,
                bounds.bound_max_home_goals
            );
            newThresholds.min_home_goals_avg = Math.round(newThresholds.min_home_goals_avg * 100) / 100;
            adjustments.push(`min_home_goals_avg: ${currentThresholds.min_home_goals_avg} → ${newThresholds.min_home_goals_avg}`);
        }

        // --- Away conceded avg threshold ---
        const greenAwayConceded = avgCriteria(greenGames, 'away_conceded_avg');
        const redAwayConceded = avgCriteria(redGames, 'away_conceded_avg');
        if (greenAwayConceded > 0 && redAwayConceded > 0 && greenAwayConceded > redAwayConceded + 0.1) {
            const adjustment = (greenAwayConceded - redAwayConceded) * STEP;
            newThresholds.min_away_conceded_avg = clamp(
                currentThresholds.min_away_conceded_avg + adjustment,
                0.8,
                3.0
            );
            newThresholds.min_away_conceded_avg = Math.round(newThresholds.min_away_conceded_avg * 100) / 100;
            adjustments.push(`min_away_conceded_avg: ${currentThresholds.min_away_conceded_avg} → ${newThresholds.min_away_conceded_avg}`);
        }

        // --- If IA win rate is below standard, tighten all thresholds moderately ---
        if (iaWinRate < stdWinRate - 5 && iaList.length >= 10) {
            // IA is underperforming → tighten criteria
            newThresholds.min_btts_pct = clamp(currentThresholds.min_btts_pct + 2, bounds.bound_min_btts, bounds.bound_max_btts);
            newThresholds.max_home_clean_sheet_pct = clamp(currentThresholds.max_home_clean_sheet_pct - 2, bounds.bound_min_cs, bounds.bound_max_cs);
            newThresholds.max_away_clean_sheet_pct = clamp(currentThresholds.max_away_clean_sheet_pct - 2, bounds.bound_min_cs, bounds.bound_max_cs);
            adjustments.push(`Global tightening: IA WR ${iaWinRate.toFixed(1)}% < Padrão WR ${stdWinRate.toFixed(1)}%`);
        } else if (iaWinRate > stdWinRate + 10 && iaList.length >= 10) {
            // IA is significantly better → slightly relax to catch more games
            newThresholds.min_btts_pct = clamp(currentThresholds.min_btts_pct - 1, bounds.bound_min_btts, bounds.bound_max_btts);
            newThresholds.max_home_clean_sheet_pct = clamp(currentThresholds.max_home_clean_sheet_pct + 1, bounds.bound_min_cs, bounds.bound_max_cs);
            adjustments.push(`Slight relaxation: IA WR ${iaWinRate.toFixed(1)}% >> Padrão WR ${stdWinRate.toFixed(1)}%`);
        }

        // Round all thresholds
        for (const key of Object.keys(newThresholds) as (keyof Thresholds)[]) {
            newThresholds[key] = Math.round(newThresholds[key] * 100) / 100;
        }

        const newCycle = (thresholdRow.cycle || 1) + 1;

        // 4. Save new thresholds
        await supabase
            .from('lay0x1_ia_thresholds')
            .update({
                ...newThresholds,
                cycle: newCycle,
                games_since_calibration: 0,
                last_calibrated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('owner_id', user.id);

        // 5. Log the evolution
        await supabase
            .from('lay0x1_ia_evolution_log')
            .insert({
                owner_id: user.id,
                cycle: newCycle,
                thresholds_before: currentThresholds,
                thresholds_after: newThresholds,
                total_games_analyzed: iaList.length + stdList.length,
                ia_games: iaList.length,
                ia_win_rate: iaWinRate,
                standard_win_rate: stdWinRate,
                adjustment_reason: adjustments.length > 0
                    ? adjustments.join(' | ')
                    : 'Nenhum ajuste necessário (dentro do esperado)',
            });

        return new Response(JSON.stringify({
            cycle: newCycle,
            ia_win_rate: Math.round(iaWinRate * 10) / 10,
            standard_win_rate: Math.round(stdWinRate * 10) / 10,
            ia_games: iaList.length,
            standard_games: stdList.length,
            adjustments,
            thresholds: newThresholds,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
