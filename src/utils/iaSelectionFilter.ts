/**
 * IA Selection Filter — Smart pre-match intelligence for Lay 0x1.
 * 
 * KEY DESIGN: The IA is autonomous and intelligent.
 * - If data is unavailable (0%), skip that criterion entirely
 * - Evaluate based on whatever data IS available
 * - Auto-relaxation: if 0 games pass, progressively widen thresholds
 */

export interface IASelectionInput {
    awayOdd: number;
    homeGoalsAvg: number;
    awayConcededAvg: number;
    bttsPct: number;
    over25Pct: number;
    homeCleanSheetPct: number;
    awayCleanSheetPct: number;
}

export interface IASelectionResult {
    selected: boolean;
    justification: string;
    rejectionReasons: string[];
    confidence: number; // 0-100, higher = more criteria met
}

export interface IASelectionThresholds {
    maxAwayOdd: number;
    minHomeGoalsAvg: number;
    minAwayConcededAvg: number;
    minBttsPct: number;
    minOver25Pct: number;
    maxHomeCleanSheetPct: number;
    maxAwayCleanSheetPct: number;
}

export const DEFAULT_THRESHOLDS: IASelectionThresholds = {
    maxAwayOdd: 5.0,
    minHomeGoalsAvg: 1.2,
    minAwayConcededAvg: 1.5,
    minBttsPct: 50,
    minOver25Pct: 60,
    maxHomeCleanSheetPct: 50,
    maxAwayCleanSheetPct: 40,
};

export function evaluateIASelection(
    input: IASelectionInput,
    dynamicThresholds?: Partial<IASelectionThresholds>,
): IASelectionResult {
    const t = { ...DEFAULT_THRESHOLDS, ...dynamicThresholds };
    const rejectionReasons: string[] = [];
    const approvalNotes: string[] = [];
    let criteriaChecked = 0;
    let criteriaPassed = 0;

    // 1. Away odd ceiling (always available)
    if (input.awayOdd > 0) {
        criteriaChecked++;
        if (input.awayOdd >= t.maxAwayOdd) {
            rejectionReasons.push(`Odd Visitante @${input.awayOdd.toFixed(2)} ≥ ${t.maxAwayOdd}`);
        } else {
            criteriaPassed++;
            approvalNotes.push(`Odd Visitante @${input.awayOdd.toFixed(2)}`);
        }
    }

    // 2. Home goals avg (always available)
    if (input.homeGoalsAvg > 0) {
        criteriaChecked++;
        if (input.homeGoalsAvg <= t.minHomeGoalsAvg) {
            rejectionReasons.push(`Casa média ${input.homeGoalsAvg.toFixed(2)} gols (mín: >${t.minHomeGoalsAvg})`);
        } else {
            criteriaPassed++;
            approvalNotes.push(`Casa ${input.homeGoalsAvg.toFixed(1)} gols/jogo`);
        }
    }

    // 3. Away conceded avg (always available)
    if (input.awayConcededAvg > 0) {
        criteriaChecked++;
        if (input.awayConcededAvg <= t.minAwayConcededAvg) {
            rejectionReasons.push(`Visitante sofre ${input.awayConcededAvg.toFixed(2)} gols (mín: >${t.minAwayConcededAvg})`);
        } else {
            criteriaPassed++;
            approvalNotes.push(`Visitante sofre ${input.awayConcededAvg.toFixed(1)} gols/jogo`);
        }
    }

    // 4-6: BTTS, Over 2.5, Clean Sheets — SKIP if data is 0 (unavailable)
    // These are only available after edge function deployment with API-Football stats
    const hasBttsData = input.bttsPct > 0;
    const hasOver25Data = input.over25Pct > 0;
    const hasCleanSheetData = input.homeCleanSheetPct > 0 || input.awayCleanSheetPct > 0;

    // 4. BTTS OR Over 2.5 trend — only check if data exists
    if (hasBttsData || hasOver25Data) {
        criteriaChecked++;
        const bttsMet = hasBttsData && input.bttsPct > t.minBttsPct;
        const over25Met = hasOver25Data && input.over25Pct > t.minOver25Pct;

        if (!bttsMet && !over25Met) {
            const parts: string[] = [];
            if (hasBttsData) parts.push(`BTTS ${input.bttsPct.toFixed(0)}%`);
            if (hasOver25Data) parts.push(`Over 2.5 ${input.over25Pct.toFixed(0)}%`);
            rejectionReasons.push(`Tendência: ${parts.join(' e ')} abaixo do mínimo`);
        } else {
            criteriaPassed++;
            if (bttsMet) approvalNotes.push(`BTTS ${input.bttsPct.toFixed(0)}%`);
            if (over25Met) approvalNotes.push(`Over 2.5 ${input.over25Pct.toFixed(0)}%`);
        }
    }

    // 5. Home clean sheet rejection — only if data exists
    if (hasCleanSheetData && input.homeCleanSheetPct > 0) {
        criteriaChecked++;
        if (input.homeCleanSheetPct > t.maxHomeCleanSheetPct) {
            rejectionReasons.push(`CS Casa ${input.homeCleanSheetPct.toFixed(0)}% (máx: ${t.maxHomeCleanSheetPct}%)`);
        } else {
            criteriaPassed++;
        }
    }

    // 6. Away clean sheet rejection — only if data exists
    if (hasCleanSheetData && input.awayCleanSheetPct > 0) {
        criteriaChecked++;
        if (input.awayCleanSheetPct > t.maxAwayCleanSheetPct) {
            rejectionReasons.push(`CS Fora ${input.awayCleanSheetPct.toFixed(0)}% (máx: ${t.maxAwayCleanSheetPct}%)`);
        } else {
            criteriaPassed++;
        }
    }

    const selected = rejectionReasons.length === 0 && criteriaChecked > 0;
    const confidence = criteriaChecked > 0
        ? Math.round((criteriaPassed / criteriaChecked) * 100)
        : 0;

    let justification: string;
    if (selected) {
        const dataNote = (!hasBttsData && !hasOver25Data)
            ? ' (dados BTTS/CS pendentes)'
            : '';
        justification = `✅ ${approvalNotes.join(' + ')}${dataNote}`;
    } else {
        justification = `❌ ${rejectionReasons.join(' | ')}`;
    }

    return { selected, justification, rejectionReasons, confidence };
}

/**
 * Smart auto-relaxation: if no games pass, progressively widen thresholds.
 * Returns the adjusted thresholds that allow at least some games through.
 */
export function autoRelaxThresholds(
    games: IASelectionInput[],
    baseThresholds: IASelectionThresholds,
    targetMinGames: number = 3,
    maxRounds: number = 5,
): { thresholds: IASelectionThresholds; relaxed: boolean; rounds: number } {
    let current = { ...baseThresholds };
    let rounds = 0;

    for (let i = 0; i < maxRounds; i++) {
        const passing = games.filter(g => evaluateIASelection(g, current).selected);
        if (passing.length >= targetMinGames) {
            return { thresholds: current, relaxed: rounds > 0, rounds };
        }

        // Relax each threshold by ~10%
        rounds++;
        current = {
            maxAwayOdd: Math.min(current.maxAwayOdd + 0.5, 7.0),
            minHomeGoalsAvg: Math.max(current.minHomeGoalsAvg - 0.15, 0.5),
            minAwayConcededAvg: Math.max(current.minAwayConcededAvg - 0.15, 0.5),
            minBttsPct: Math.max(current.minBttsPct - 5, 30),
            minOver25Pct: Math.max(current.minOver25Pct - 5, 40),
            maxHomeCleanSheetPct: Math.min(current.maxHomeCleanSheetPct + 5, 70),
            maxAwayCleanSheetPct: Math.min(current.maxAwayCleanSheetPct + 5, 60),
        };
    }

    return { thresholds: current, relaxed: true, rounds };
}
