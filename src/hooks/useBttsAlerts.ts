import { useMemo } from 'react';
import { BttsMetrics, BttsAlert, BttsHealthSettings } from '@/types/btts';

export function useBttsAlerts(metrics: BttsMetrics, settings: BttsHealthSettings | null): BttsAlert[] {
  return useMemo(() => {
    const alerts: BttsAlert[] = [];

    if (!settings) return alerts;

    // 1. WR_200 < 48% => ⚠️ Cautela + congelar subida de stake
    if (metrics.winRate200 > 0 && metrics.winRate200 < 48) {
      alerts.push({
        id: 'wr200_low',
        status: 'caution',
        title: 'Win Rate 200 abaixo de 48%',
        description: `WR atual: ${metrics.winRate200.toFixed(1)}%`,
        action: 'Congelar subida de stake',
      });
    }

    // 2. Profit_stakes_300 < 0 => 🔴 Revisar + sugerir reduzir stake% 20%
    if (metrics.profitStakes300 < 0 && metrics.totalEntries >= 50) {
      alerts.push({
        id: 'profit300_negative',
        status: 'pause',
        title: 'Lucro negativo nas últimas 300 entradas',
        description: `Profit: ${metrics.profitStakes300.toFixed(2)} stakes`,
        action: 'Reduzir stake em 20%',
      });
    }

    // 3. OddAvg_100 < 2.10 ou > 2.40 => ⚠️ Fora do padrão
    if (metrics.oddAvg100 > 0 && (metrics.oddAvg100 < 2.10 || metrics.oddAvg100 > 2.40)) {
      alerts.push({
        id: 'oddavg_outofrange',
        status: 'caution',
        title: 'Odd média fora do padrão',
        description: `Média 100: ${metrics.oddAvg100.toFixed(2)} (ideal: 2.10-2.40)`,
        action: 'Revisar seleção de jogos',
      });
    }

    // 4. % odds >2.55 nas últimas 50 entradas >25% => alerta "Caçando odds altas"
    if (metrics.highOddsPercent50 > 25) {
      alerts.push({
        id: 'high_odds_chasing',
        status: 'caution',
        title: 'Caçando odds altas',
        description: `${metrics.highOddsPercent50.toFixed(0)}% das últimas 50 entradas com odd > 2.55`,
        action: 'Voltar ao range padrão',
      });
    }

    // 5. % odds <2.05 nas últimas 50 entradas >25% => alerta "Aceitando odds baixas"
    if (metrics.lowOddsPercent50 > 25) {
      alerts.push({
        id: 'low_odds_accepting',
        status: 'caution',
        title: 'Aceitando odds baixas',
        description: `${metrics.lowOddsPercent50.toFixed(0)}% das últimas 50 entradas com odd < 2.05`,
        action: 'Buscar melhor valor',
      });
    }

    // 6. Reds seguidos >= 8 => 🔴 Pausa 24h + ao retornar stake% -20% por 7 dias
    if (metrics.currentStreak.type === 'Red' && metrics.currentStreak.count >= 8) {
      alerts.push({
        id: 'bad_streak',
        status: 'pause',
        title: 'Sequência de 8+ Reds',
        description: `${metrics.currentStreak.count} reds seguidos`,
        action: 'Pausa 24h + reduzir stake 20% por 7 dias',
      });
    }

    // 7. Profit_stakes_mês <= -10 => ⚠️ Modo defensivo
    if (metrics.profitStakesMonth <= -10) {
      alerts.push({
        id: 'monthly_loss',
        status: 'caution',
        title: 'Perda mensal crítica',
        description: `Lucro do mês: ${metrics.profitStakesMonth.toFixed(2)} stakes`,
        action: 'Ativar modo defensivo',
      });
    }

    // 8. Banca <= pico*0.88 (DD 12%) => reduzir stake% automaticamente
    if (metrics.drawdownPercent >= 12) {
      alerts.push({
        id: 'drawdown_critical',
        status: 'pause',
        title: 'Drawdown crítico (12%+)',
        description: `DD atual: ${metrics.drawdownPercent.toFixed(1)}%`,
        action: 'Reduzir stake (3%→2% ou 2%→1.5%)',
      });
    }

    // Check for active pause
    if (settings.pause_until) {
      const pauseUntil = new Date(settings.pause_until);
      if (pauseUntil > new Date()) {
        alerts.push({
          id: 'pause_active',
          status: 'pause',
          title: 'Pausa ativa',
          description: `Até ${pauseUntil.toLocaleString('pt-BR')}`,
          action: 'Aguardar término da pausa',
        });
      }
    }

    // Check for stake reduction
    if (settings.stake_reduction_until && settings.stake_reduction_percent > 0) {
      const reductionUntil = new Date(settings.stake_reduction_until);
      if (reductionUntil > new Date()) {
        alerts.push({
          id: 'stake_reduction_active',
          status: 'caution',
          title: 'Redução de stake ativa',
          description: `-${settings.stake_reduction_percent}% até ${reductionUntil.toLocaleDateString('pt-BR')}`,
          action: 'Stake temporariamente reduzida',
        });
      }
    }

    return alerts;
  }, [metrics, settings]);
}

export function getOverallStatus(alerts: BttsAlert[]): 'ok' | 'caution' | 'pause' {
  if (alerts.some(a => a.status === 'pause')) return 'pause';
  if (alerts.some(a => a.status === 'caution')) return 'caution';
  return 'ok';
}
