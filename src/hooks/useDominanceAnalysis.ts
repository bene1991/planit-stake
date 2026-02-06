import { useMemo } from 'react';
import { FixtureCacheData, MomentumPoint } from './useFixtureCache';

export type DataStatus = 'ok' | 'limited' | 'unavailable';

export interface DominanceAlert {
  type: 'momentum_shift' | 'high_pressure' | 'defensive_lock' | 'danger_zone';
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface DominanceResult {
  dataStatus: DataStatus;
  dataStatusMessage: string;
  dominanceIndex: number | null;
  dominantTeam: 'home' | 'away' | 'balanced' | null;
  dominanceLabel: string;
  alerts: DominanceAlert[];
}

function calcRatio(home: number, away: number): number {
  const total = home + away;
  if (total === 0) return 50;
  return (home / total) * 100;
}

function classifyData(cache: FixtureCacheData | null): { status: DataStatus; message: string } {
  if (!cache || !cache.minute_now || cache.minute_now === 0) {
    return { status: 'unavailable', message: 'Dados ao vivo indisponíveis no momento. Análise suspensa.' };
  }

  const s = cache.normalized_stats;
  if (!s) {
    return { status: 'unavailable', message: 'Estatísticas não disponíveis para este jogo.' };
  }

  const hasShots = (s.home.shots_total + s.away.shots_total) >= 2;
  const hasPossession = s.home.possession > 0;
  const hasCorners = (s.home.corners + s.away.corners) > 0;

  if (hasShots && hasPossession) {
    return { status: 'ok', message: 'Dados completos — análise ativa' };
  }

  if (hasPossession || hasShots || hasCorners) {
    return { status: 'limited', message: 'Dados limitados — análise parcial' };
  }

  return { status: 'unavailable', message: 'Estatísticas ainda não recebidas. Análise suspensa.' };
}

function calcLDI(cache: FixtureCacheData): number {
  const s = cache.normalized_stats!;
  const metrics: { home: number; away: number; weight: number }[] = [];

  // Possession (20%)
  if (s.home.possession > 0 || s.away.possession > 0) {
    metrics.push({ home: s.home.possession, away: s.away.possession, weight: 0.20 });
  }

  // Shots total (25%)
  if (s.home.shots_total + s.away.shots_total > 0) {
    metrics.push({ home: s.home.shots_total, away: s.away.shots_total, weight: 0.25 });
  }

  // Shots on target (30%)
  if (s.home.shots_on + s.away.shots_on > 0) {
    metrics.push({ home: s.home.shots_on, away: s.away.shots_on, weight: 0.30 });
  }

  // Corners (15%)
  if (s.home.corners + s.away.corners > 0) {
    metrics.push({ home: s.home.corners, away: s.away.corners, weight: 0.15 });
  }

  // Blocked shots (10%)
  if (s.home.shots_blocked + s.away.shots_blocked > 0) {
    metrics.push({ home: s.home.shots_blocked, away: s.away.shots_blocked, weight: 0.10 });
  }

  if (metrics.length === 0) return 50;

  // Normalize weights to sum to 1
  const totalWeight = metrics.reduce((s, m) => s + m.weight, 0);
  let ldi = 0;
  for (const m of metrics) {
    const ratio = calcRatio(m.home, m.away);
    ldi += ratio * (m.weight / totalWeight);
  }

  return Math.round(ldi);
}

function getDominanceLabel(ldi: number): { team: 'home' | 'away' | 'balanced'; label: string } {
  if (ldi >= 65) return { team: 'home', label: 'Casa domina' };
  if (ldi >= 55) return { team: 'home', label: 'Casa com vantagem' };
  if (ldi >= 45) return { team: 'balanced', label: 'Equilibrado' };
  if (ldi >= 35) return { team: 'away', label: 'Visitante com vantagem' };
  return { team: 'away', label: 'Visitante domina' };
}

function generateAlerts(cache: FixtureCacheData, ldi: number): DominanceAlert[] {
  const alerts: DominanceAlert[] = [];
  const s = cache.normalized_stats!;

  // High pressure
  if (ldi > 70) {
    alerts.push({
      type: 'high_pressure',
      message: `Pressão alta da casa — ${s.home.shots_on} chutes no gol vs ${s.away.shots_on}`,
      severity: 'warning',
    });
  } else if (ldi < 30) {
    alerts.push({
      type: 'high_pressure',
      message: `Pressão alta do visitante — ${s.away.shots_on} chutes no gol vs ${s.home.shots_on}`,
      severity: 'warning',
    });
  }

  // Danger zone: many shots on target but no goals
  const homeGoals = cache.key_events?.filter(e => e.team === 'home' && e.type === 'goal').length ?? 0;
  const awayGoals = cache.key_events?.filter(e => e.team === 'away' && e.type === 'goal').length ?? 0;

  if (s.home.shots_on >= 5 && homeGoals === 0) {
    alerts.push({
      type: 'danger_zone',
      message: `Casa com ${s.home.shots_on} finalizações no gol sem marcar`,
      severity: 'critical',
    });
  }
  if (s.away.shots_on >= 5 && awayGoals === 0) {
    alerts.push({
      type: 'danger_zone',
      message: `Visitante com ${s.away.shots_on} finalizações no gol sem marcar`,
      severity: 'critical',
    });
  }

  // Defensive lock: few shots, many fouls
  const totalShots = s.home.shots_total + s.away.shots_total;
  const totalFouls = s.home.fouls + s.away.fouls;
  if (cache.minute_now > 30 && totalShots < 6 && totalFouls > 15) {
    alerts.push({
      type: 'defensive_lock',
      message: 'Jogo travado — poucas finalizações e muitas faltas',
      severity: 'info',
    });
  }

  // Momentum shift via momentum_series
  if (cache.momentum_series && cache.momentum_series.length >= 4) {
    const recent = cache.momentum_series.slice(-4);
    const earlier = recent.slice(0, 2);
    const later = recent.slice(2);
    const earlierDominant = earlier.reduce((s, p) => s + (p.home - p.away), 0) > 0 ? 'home' : 'away';
    const laterDominant = later.reduce((s, p) => s + (p.home - p.away), 0) > 0 ? 'home' : 'away';
    if (earlierDominant !== laterDominant) {
      alerts.push({
        type: 'momentum_shift',
        message: `Momentum invertido — ${laterDominant === 'home' ? 'casa' : 'visitante'} assumiu controle`,
        severity: 'warning',
      });
    }
  }

  return alerts;
}

export function useDominanceAnalysis(cache: FixtureCacheData | null): DominanceResult {
  return useMemo(() => {
    const { status, message } = classifyData(cache);

    if (status === 'unavailable' || !cache?.normalized_stats) {
      return {
        dataStatus: status,
        dataStatusMessage: message,
        dominanceIndex: null,
        dominantTeam: null,
        dominanceLabel: '',
        alerts: [],
      };
    }

    const ldi = calcLDI(cache);
    const { team, label } = getDominanceLabel(ldi);
    const alerts = generateAlerts(cache, ldi);

    return {
      dataStatus: status,
      dataStatusMessage: message,
      dominanceIndex: ldi,
      dominantTeam: team,
      dominanceLabel: label,
      alerts,
    };
  }, [cache]);
}
