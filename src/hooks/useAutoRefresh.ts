import { useEffect, useRef, useState, useCallback } from 'react';

interface UseAutoRefreshOptions {
  intervalMs?: number;
  enabled?: boolean;
}

interface UseAutoRefreshResult {
  secondsUntilRefresh: number;
  isRefreshing: boolean;
}

export function useAutoRefresh(
  onRefresh: () => Promise<void> | void,
  options: UseAutoRefreshOptions = {}
): UseAutoRefreshResult {
  const { intervalMs = 60000, enabled = true } = options;
  
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(Math.floor(intervalMs / 1000));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const onRefreshRef = useRef(onRefresh);

  // Keep onRefresh reference up to date
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefreshRef.current();
    } catch (error) {
      console.error('[useAutoRefresh] Erro ao atualizar:', error);
    } finally {
      setIsRefreshing(false);
      setSecondsUntilRefresh(Math.floor(intervalMs / 1000));
    }
  }, [intervalMs]);

  useEffect(() => {
    // Clear existing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (!enabled) {
      return;
    }

    console.log('[useAutoRefresh] Ativado - atualizando a cada', intervalMs / 1000, 'segundos');
    
    // Reset countdown
    setSecondsUntilRefresh(Math.floor(intervalMs / 1000));

    // Countdown timer (every second)
    countdownRef.current = setInterval(() => {
      setSecondsUntilRefresh(prev => {
        if (prev <= 1) {
          return Math.floor(intervalMs / 1000);
        }
        return prev - 1;
      });
    }, 1000);

    // Main refresh interval
    intervalRef.current = setInterval(() => {
      console.log('[useAutoRefresh] Executando refresh automático...');
      doRefresh();
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [enabled, intervalMs, doRefresh]);

  return { secondsUntilRefresh, isRefreshing };
}
