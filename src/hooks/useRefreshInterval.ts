import { useState, useEffect, useCallback } from 'react';

export type RefreshInterval = 10 | 20 | 30 | 60 | 120;

const STORAGE_KEY = 'vt-refresh-interval';
const DEFAULT_INTERVAL: RefreshInterval = 10;

export const REFRESH_INTERVAL_OPTIONS: { value: RefreshInterval; label: string; credits: string }[] = [
  { value: 10, label: '10 segundos', credits: '~360/hora' },
  { value: 20, label: '20 segundos', credits: '~180/hora' },
  { value: 30, label: '30 segundos', credits: '~120/hora' },
  { value: 60, label: '60 segundos', credits: '~60/hora' },
  { value: 120, label: '2 minutos', credits: '~30/hora' },
];

export function useRefreshInterval() {
  const [interval, setIntervalState] = useState<RefreshInterval>(() => {
    if (typeof window === 'undefined') return DEFAULT_INTERVAL;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if ([10, 20, 30, 60, 120].includes(parsed)) {
        return parsed as RefreshInterval;
      }
    }
    return DEFAULT_INTERVAL;
  });

  const updateInterval = useCallback((newInterval: RefreshInterval) => {
    setIntervalState(newInterval);
    localStorage.setItem(STORAGE_KEY, String(newInterval));
  }, []);

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const parsed = parseInt(e.newValue, 10);
        if ([10, 20, 30, 60, 120].includes(parsed)) {
          setIntervalState(parsed as RefreshInterval);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return {
    interval,
    intervalMs: interval * 1000,
    updateInterval,
  };
}
