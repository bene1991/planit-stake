import { useMemo } from 'react';
import { BttsEntry, BttsMetrics, LeagueStats, calculateBreakeven } from '@/types/btts';
import { startOfMonth, subDays, isAfter, parseISO } from 'date-fns';

export function useBttsMetrics(entries: BttsEntry[], bankrollInitial: number, bankrollPeak: number) {
  return useMemo(() => {
    if (entries.length === 0) {
      return getEmptyMetrics(bankrollInitial);
    }

    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const monthStart = startOfMonth(now);

    // Sort entries by date (newest first is already done)
    const sortedEntries = [...entries].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateB.getTime() - dateA.getTime();
    });

    // Filter entries excluding Void
    const validEntries = sortedEntries.filter(e => e.result !== 'Void');

    // Calculate basic metrics
    const profitReais = validEntries.reduce((sum, e) => sum + (e.profit || 0), 0);
    const profitStakes = validEntries.reduce((sum, e) => {
      if (!e.profit || !e.stake_value) return sum;
      return sum + e.profit / e.stake_value;
    }, 0);

    // Banca
    const bankrollCurrent = bankrollInitial + profitReais;
    const actualPeak = Math.max(bankrollPeak, bankrollCurrent);
    const drawdownPercent = actualPeak > 0 ? ((actualPeak - bankrollCurrent) / actualPeak) * 100 : 0;
    const drawdownStakes = validEntries.length > 0 
      ? (actualPeak - bankrollCurrent) / (validEntries[0]?.stake_value || 100)
      : 0;

    // Win rates by window
    const winRate30 = calculateWinRate(validEntries.slice(0, 30));
    const winRate100 = calculateWinRate(validEntries.slice(0, 100));
    const winRate200 = calculateWinRate(validEntries.slice(0, 200));

    // Odd averages
    const oddAvg30 = calculateOddAvg(validEntries.slice(0, 30));
    const oddAvg100 = calculateOddAvg(validEntries.slice(0, 100));

    // EV (Expected Value) in stakes per entry
    const evStakes100 = calculateEV(validEntries.slice(0, 100));
    const evStakes300 = calculateEV(validEntries.slice(0, 300));

    // Streaks
    const currentStreak = calculateCurrentStreak(validEntries);
    const { maxBadRun: maxBadRunMonth, maxGoodRun: maxGoodRunMonth } = calculateMaxRuns(
      validEntries.filter(e => isAfter(parseISO(e.date), monthStart))
    );
    const { maxBadRun: maxBadRun30Days, maxGoodRun: maxGoodRun30Days } = calculateMaxRuns(
      validEntries.filter(e => isAfter(parseISO(e.date), thirtyDaysAgo))
    );

    // Profit by period
    const profitStakes30Days = calculateProfitStakes(
      validEntries.filter(e => isAfter(parseISO(e.date), thirtyDaysAgo))
    );
    const profitStakesMonth = calculateProfitStakes(
      validEntries.filter(e => isAfter(parseISO(e.date), monthStart))
    );
    const profitStakes300 = calculateProfitStakes(validEntries.slice(0, 300));

    // Odd distribution analysis (last 50)
    const last50 = validEntries.slice(0, 50);
    const highOddsPercent50 = last50.length > 0
      ? (last50.filter(e => e.odd > 2.55).length / last50.length) * 100
      : 0;
    const lowOddsPercent50 = last50.length > 0
      ? (last50.filter(e => e.odd < 2.05).length / last50.length) * 100
      : 0;

    const metrics: BttsMetrics = {
      profitReais,
      profitStakes,
      bankrollCurrent,
      bankrollPeak: actualPeak,
      drawdownPercent,
      drawdownStakes,
      winRate30,
      winRate100,
      winRate200,
      oddAvg30,
      oddAvg100,
      evStakes100,
      evStakes300,
      currentStreak,
      maxBadRunMonth,
      maxGoodRunMonth,
      maxBadRun30Days,
      maxGoodRun30Days,
      profitStakes30Days,
      profitStakesMonth,
      profitStakes300,
      highOddsPercent50,
      lowOddsPercent50,
      totalEntries: entries.length,
      entries30Days: entries.filter(e => isAfter(parseISO(e.date), thirtyDaysAgo)).length,
    };

    return metrics;
  }, [entries, bankrollInitial, bankrollPeak]);
}

export function useLeagueStats(entries: BttsEntry[], quarantineLeagues: string[]): LeagueStats[] {
  return useMemo(() => {
    const leagueMap = new Map<string, BttsEntry[]>();

    // Group by league
    entries.forEach(entry => {
      if (entry.result === 'Void') return;
      const current = leagueMap.get(entry.league) || [];
      leagueMap.set(entry.league, [...current, entry]);
    });

    // Calculate stats per league (last 80 entries)
    const stats: LeagueStats[] = [];

    leagueMap.forEach((leagueEntries, league) => {
      const last80 = leagueEntries.slice(0, 80);
      if (last80.length < 5) return; // Skip leagues with too few entries

      const winRate = calculateWinRate(last80);
      const oddAvg = calculateOddAvg(last80);
      const profitStakes = calculateProfitStakes(last80);
      const badRun = calculateMaxRuns(last80).maxBadRun;
      
      const breakeven = calculateBreakeven(oddAvg);
      const isQuarantine = quarantineLeagues.includes(league) || 
        profitStakes <= -3 || 
        winRate < breakeven;

      stats.push({
        league,
        entries: last80.length,
        winRate,
        oddAvg,
        profitStakes,
        badRun,
        status: isQuarantine ? 'quarantine' : 'ok',
      });
    });

    return stats.sort((a, b) => b.entries - a.entries);
  }, [entries, quarantineLeagues]);
}

function getEmptyMetrics(bankrollInitial: number): BttsMetrics {
  return {
    profitReais: 0,
    profitStakes: 0,
    bankrollCurrent: bankrollInitial,
    bankrollPeak: bankrollInitial,
    drawdownPercent: 0,
    drawdownStakes: 0,
    winRate30: 0,
    winRate100: 0,
    winRate200: 0,
    oddAvg30: 0,
    oddAvg100: 0,
    evStakes100: 0,
    evStakes300: 0,
    currentStreak: { type: null, count: 0 },
    maxBadRunMonth: 0,
    maxGoodRunMonth: 0,
    maxBadRun30Days: 0,
    maxGoodRun30Days: 0,
    profitStakes30Days: 0,
    profitStakesMonth: 0,
    profitStakes300: 0,
    highOddsPercent50: 0,
    lowOddsPercent50: 0,
    totalEntries: 0,
    entries30Days: 0,
  };
}

function calculateWinRate(entries: BttsEntry[]): number {
  if (entries.length === 0) return 0;
  const greens = entries.filter(e => e.result === 'Green').length;
  return (greens / entries.length) * 100;
}

function calculateOddAvg(entries: BttsEntry[]): number {
  if (entries.length === 0) return 0;
  const sum = entries.reduce((acc, e) => acc + e.odd, 0);
  return sum / entries.length;
}

function calculateEV(entries: BttsEntry[]): number {
  if (entries.length === 0) return 0;
  const profitStakes = calculateProfitStakes(entries);
  return profitStakes / entries.length;
}

function calculateProfitStakes(entries: BttsEntry[]): number {
  return entries.reduce((sum, e) => {
    if (!e.profit || !e.stake_value) return sum;
    return sum + e.profit / e.stake_value;
  }, 0);
}

function calculateCurrentStreak(entries: BttsEntry[]): { type: 'Green' | 'Red' | null; count: number } {
  if (entries.length === 0) return { type: null, count: 0 };

  const firstResult = entries[0].result;
  if (firstResult === 'Void') return { type: null, count: 0 };

  let count = 0;
  for (const entry of entries) {
    if (entry.result === firstResult) {
      count++;
    } else if (entry.result !== 'Void') {
      break;
    }
  }

  return { type: firstResult as 'Green' | 'Red', count };
}

function calculateMaxRuns(entries: BttsEntry[]): { maxBadRun: number; maxGoodRun: number } {
  let maxBadRun = 0;
  let maxGoodRun = 0;
  let currentBad = 0;
  let currentGood = 0;

  for (const entry of entries) {
    if (entry.result === 'Red') {
      currentBad++;
      currentGood = 0;
      maxBadRun = Math.max(maxBadRun, currentBad);
    } else if (entry.result === 'Green') {
      currentGood++;
      currentBad = 0;
      maxGoodRun = Math.max(maxGoodRun, currentGood);
    }
  }

  return { maxBadRun, maxGoodRun };
}
