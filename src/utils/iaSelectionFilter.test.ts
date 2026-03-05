import { describe, it, expect } from 'vitest';
import { evaluateIASelection, autoRelaxThresholds, DEFAULT_THRESHOLDS } from './iaSelectionFilter';

describe('evaluateIASelection', () => {
    const goodInput = {
        awayOdd: 3.50,
        homeGoalsAvg: 1.8,
        awayConcededAvg: 1.9,
        bttsPct: 0, // unavailable
        over25Pct: 0, // unavailable
        homeCleanSheetPct: 0,
        awayCleanSheetPct: 0,
    };

    it('approves game with good odds and goals (no BTTS/CS data)', () => {
        const result = evaluateIASelection(goodInput);
        expect(result.selected).toBe(true);
        expect(result.rejectionReasons).toHaveLength(0);
        expect(result.justification).toContain('✅');
        expect(result.justification).toContain('dados BTTS/CS pendentes');
    });

    it('rejects when away odd is too high', () => {
        const result = evaluateIASelection({ ...goodInput, awayOdd: 5.5 });
        expect(result.selected).toBe(false);
        expect(result.rejectionReasons.some(r => r.includes('Odd Visitante'))).toBe(true);
    });

    it('rejects when home goals avg is too low', () => {
        const result = evaluateIASelection({ ...goodInput, homeGoalsAvg: 0.8 });
        expect(result.selected).toBe(false);
        expect(result.rejectionReasons.some(r => r.includes('Casa média'))).toBe(true);
    });

    it('rejects when away conceded avg is too low', () => {
        const result = evaluateIASelection({ ...goodInput, awayConcededAvg: 0.9 });
        expect(result.selected).toBe(false);
        expect(result.rejectionReasons.some(r => r.includes('Visitante sofre'))).toBe(true);
    });

    it('skips BTTS/Over25 criteria when data is 0 (unavailable)', () => {
        const result = evaluateIASelection({
            ...goodInput,
            bttsPct: 0,
            over25Pct: 0,
        });
        // Should NOT reject based on missing data
        expect(result.selected).toBe(true);
        expect(result.rejectionReasons.filter(r => r.includes('BTTS') || r.includes('Over'))).toHaveLength(0);
    });

    it('checks BTTS/Over25 when data IS available', () => {
        const result = evaluateIASelection({
            ...goodInput,
            bttsPct: 30, // below threshold
            over25Pct: 40, // below threshold
        });
        expect(result.selected).toBe(false);
        expect(result.rejectionReasons.some(r => r.includes('Tendência'))).toBe(true);
    });

    it('passes with BTTS OR Over25 (OR condition)', () => {
        const resultBtts = evaluateIASelection({ ...goodInput, bttsPct: 55, over25Pct: 40 });
        expect(resultBtts.selected).toBe(true);

        const resultOver = evaluateIASelection({ ...goodInput, bttsPct: 30, over25Pct: 65 });
        expect(resultOver.selected).toBe(true);
    });

    it('skips clean sheet rejection when data is 0', () => {
        const result = evaluateIASelection({
            ...goodInput,
            homeCleanSheetPct: 0,
            awayCleanSheetPct: 0,
        });
        expect(result.selected).toBe(true);
    });

    it('rejects high home clean sheet when data is available', () => {
        const result = evaluateIASelection({
            ...goodInput,
            homeCleanSheetPct: 60,
            awayCleanSheetPct: 10,
        });
        expect(result.selected).toBe(false);
        expect(result.rejectionReasons.some(r => r.includes('CS Casa'))).toBe(true);
    });

    it('accepts dynamic thresholds', () => {
        const result = evaluateIASelection(
            { ...goodInput, awayOdd: 5.5 }, // would fail default 5.0
            { maxAwayOdd: 6.0 }, // relaxed
        );
        expect(result.selected).toBe(true);
    });

    it('returns confidence score based on criteria passed', () => {
        const result = evaluateIASelection(goodInput);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
    });
});

describe('autoRelaxThresholds', () => {
    const strictGames = [
        { awayOdd: 3.0, homeGoalsAvg: 1.0, awayConcededAvg: 1.0, bttsPct: 0, over25Pct: 0, homeCleanSheetPct: 0, awayCleanSheetPct: 0 },
        { awayOdd: 3.5, homeGoalsAvg: 1.1, awayConcededAvg: 1.3, bttsPct: 0, over25Pct: 0, homeCleanSheetPct: 0, awayCleanSheetPct: 0 },
        { awayOdd: 4.0, homeGoalsAvg: 2.0, awayConcededAvg: 2.0, bttsPct: 0, over25Pct: 0, homeCleanSheetPct: 0, awayCleanSheetPct: 0 },
    ];

    it('relaxes thresholds when 0 games pass', () => {
        const result = autoRelaxThresholds(strictGames, DEFAULT_THRESHOLDS, 2, 5);
        expect(result.relaxed).toBe(true);
        expect(result.rounds).toBeGreaterThan(0);
        // After relaxation, thresholds should be more permissive
        expect(result.thresholds.minHomeGoalsAvg).toBeLessThanOrEqual(DEFAULT_THRESHOLDS.minHomeGoalsAvg);
    });

    it('does not relax when enough games pass', () => {
        const easyGames = [
            { awayOdd: 3.0, homeGoalsAvg: 2.0, awayConcededAvg: 2.0, bttsPct: 0, over25Pct: 0, homeCleanSheetPct: 0, awayCleanSheetPct: 0 },
            { awayOdd: 3.5, homeGoalsAvg: 2.5, awayConcededAvg: 2.5, bttsPct: 0, over25Pct: 0, homeCleanSheetPct: 0, awayCleanSheetPct: 0 },
        ];
        const result = autoRelaxThresholds(easyGames, DEFAULT_THRESHOLDS, 1, 5);
        expect(result.relaxed).toBe(false);
        expect(result.rounds).toBe(0);
    });
});
