export interface BttsEntry {
  id: string;
  owner_id: string;
  date: string;
  time: string;
  league: string;
  home_team: string;
  away_team: string;
  odd: number;
  stake_value: number;
  result: 'Green' | 'Red' | 'Void';
  method: string;
  profit: number | null;
  created_at: string;
  updated_at: string;
}

export interface BttsHealthSettings {
  id: string;
  owner_id: string;
  stake_percent: number;
  bankroll_initial: number;
  bankroll_current: number;
  bankroll_peak: number;
  pause_until: string | null;
  stake_reduction_until: string | null;
  stake_reduction_percent: number;
  odd_range_min: number;
  odd_range_max: number;
  created_at: string;
  updated_at: string;
}

export interface BttsLeagueQuarantine {
  id: string;
  owner_id: string;
  league: string;
  quarantine_until: string;
  reason: string | null;
  created_at: string;
}

export type AlertStatus = 'ok' | 'caution' | 'pause';

export interface BttsAlert {
  id: string;
  status: AlertStatus;
  title: string;
  description: string;
  action?: string;
}

export interface BttsMetrics {
  // Lucros
  profitReais: number;
  profitStakes: number;
  
  // Banca
  bankrollCurrent: number;
  bankrollPeak: number;
  drawdownPercent: number;
  drawdownStakes: number;
  
  // Win Rates
  winRate30: number;
  winRate100: number;
  winRate200: number;
  
  // Odds
  oddAvg30: number;
  oddAvg100: number;
  
  // EV
  evStakes100: number;
  evStakes300: number;
  
  // Streaks
  currentStreak: { type: 'Green' | 'Red' | null; count: number };
  maxBadRunMonth: number;
  maxGoodRunMonth: number;
  maxBadRun30Days: number;
  maxGoodRun30Days: number;
  
  // Profit por período
  profitStakes30Days: number;
  profitStakesMonth: number;
  profitStakes300: number;
  
  // Análise de odds
  highOddsPercent50: number; // % odds >2.55 nas últimas 50
  lowOddsPercent50: number;  // % odds <2.05 nas últimas 50
  
  // Contadores
  totalEntries: number;
  entries30Days: number;
}

export interface LeagueStats {
  league: string;
  entries: number;
  winRate: number;
  oddAvg: number;
  profitStakes: number;
  badRun: number;
  status: 'ok' | 'quarantine';
  quarantineUntil?: string;
}

export interface StakeLadderCondition {
  label: string;
  required: string;
  current: string;
  met: boolean;
}

export type OddZone = 'ok' | 'warning' | 'blocked';

export function getOddZone(odd: number): OddZone {
  if (odd < 2.00 || odd > 2.70) return 'blocked';
  if ((odd >= 2.00 && odd < 2.05) || (odd > 2.55 && odd <= 2.70)) return 'warning';
  return 'ok';
}

export function calculateBreakeven(odd: number): number {
  return 100 / odd;
}
