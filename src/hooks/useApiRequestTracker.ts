import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'api_football_requests';
const DAILY_LIMIT = 7500;

interface RequestLog {
  date: string;
  count: number;
}

export function useApiRequestTracker() {
  const [requestCount, setRequestCount] = useState(0);

  // Get today's date in YYYY-MM-DD format
  const getToday = () => new Date().toISOString().split('T')[0];

  // Load count from localStorage
  const loadCount = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const log: RequestLog = JSON.parse(stored);
        if (log.date === getToday()) {
          return log.count;
        }
      }
    } catch (e) {
      console.error('Error loading request count:', e);
    }
    return 0;
  }, []);

  // Save count to localStorage
  const saveCount = useCallback((count: number) => {
    try {
      const log: RequestLog = {
        date: getToday(),
        count,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch (e) {
      console.error('Error saving request count:', e);
    }
  }, []);

  // Initialize count on mount
  useEffect(() => {
    setRequestCount(loadCount());
  }, [loadCount]);

  // Increment request count
  const trackRequest = useCallback((count: number = 1) => {
    setRequestCount(prev => {
      const newCount = prev + count;
      saveCount(newCount);
      return newCount;
    });
  }, [saveCount]);

  // Reset count (for testing)
  const resetCount = useCallback(() => {
    setRequestCount(0);
    saveCount(0);
  }, [saveCount]);

  // Informativo apenas - não bloqueia mais (a própria API retorna erro quando limite é atingido)
  const canMakeRequest = true;
  const remaining = Math.max(0, DAILY_LIMIT - requestCount);
  const percentage = (requestCount / DAILY_LIMIT) * 100;

  return {
    requestCount,
    remaining,
    percentage,
    dailyLimit: DAILY_LIMIT,
    canMakeRequest,
    trackRequest,
    resetCount,
  };
}
