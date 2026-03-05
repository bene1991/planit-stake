import { describe, it, expect } from 'vitest';
import { calculateProfit, calculatePotentialProfit, formatCurrency } from './profitCalculator';

describe('calculateProfit', () => {
    it('returns 0 for Void result', () => {
        expect(calculateProfit({ stakeValue: 100, odd: 2, operationType: 'Back', result: 'Void' })).toBe(0);
    });

    it('returns 0 for invalid stake or odd', () => {
        expect(calculateProfit({ stakeValue: 0, odd: 2, operationType: 'Back', result: 'Green' })).toBe(0);
        expect(calculateProfit({ stakeValue: 100, odd: 1, operationType: 'Back', result: 'Green' })).toBe(0);
        expect(calculateProfit({ stakeValue: -10, odd: 2, operationType: 'Back', result: 'Green' })).toBe(0);
    });

    it('calculates Back Green correctly with default commission', () => {
        // stake=100, odd=2 → profit = 100 * (2-1) * (1-0.045) = 95.50
        const result = calculateProfit({ stakeValue: 100, odd: 2, operationType: 'Back', result: 'Green' });
        expect(result).toBe(95.5);
    });

    it('calculates Back Red correctly', () => {
        const result = calculateProfit({ stakeValue: 100, odd: 2, operationType: 'Back', result: 'Red' });
        expect(result).toBe(-100);
    });

    it('calculates Lay Green correctly with default commission', () => {
        // stake=100 (responsabilidade), odd=2 → stakeLay = 100/(2-1) = 100 → profit = 100*(1-0.045) = 95.50
        const result = calculateProfit({ stakeValue: 100, odd: 2, operationType: 'Lay', result: 'Green' });
        expect(result).toBe(95.5);
    });

    it('calculates Lay Red correctly', () => {
        const result = calculateProfit({ stakeValue: 100, odd: 2, operationType: 'Lay', result: 'Red' });
        expect(result).toBe(-100);
    });

    it('uses custom commission rate', () => {
        // stake=100, odd=2, commission=0.10 → profit = 100 * 1 * 0.90 = 90.00
        const result = calculateProfit({ stakeValue: 100, odd: 2, operationType: 'Back', result: 'Green', commissionRate: 0.10 });
        expect(result).toBe(90);
    });
});

describe('calculatePotentialProfit', () => {
    it('returns zeroes for invalid inputs', () => {
        expect(calculatePotentialProfit(0, 2, 'Back')).toEqual({ green: 0, red: 0 });
        expect(calculatePotentialProfit(100, 1, 'Back')).toEqual({ green: 0, red: 0 });
    });

    it('calculates Back potential correctly', () => {
        const result = calculatePotentialProfit(100, 2, 'Back');
        expect(result.green).toBe(95.5);
        expect(result.red).toBe(-100);
    });

    it('calculates Lay potential correctly', () => {
        const result = calculatePotentialProfit(100, 3, 'Lay');
        // stakeLay = 100 / (3-1) = 50 → green = 50 * 0.955 = 47.75
        expect(result.green).toBe(47.75);
        expect(result.red).toBe(-100);
    });
});

describe('formatCurrency', () => {
    it('formats to BRL currency', () => {
        const result = formatCurrency(1234.56);
        expect(result).toContain('1.234,56');
    });

    it('handles negative values', () => {
        const result = formatCurrency(-50);
        expect(result).toContain('50,00');
    });
});
