import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'api_football_requests';
const DAILY_LIMIT = 7500;

interface RequestLog {
  date: string;
  count: number;
  fromApi: boolean; // true if synced from API headers
}

// Custom event for API usage updates
export const API_USAGE_EVENT = 'api-usage-update';

export interface ApiUsageEventDetail {
  used: number;
  limit: number;
  remaining: number;
}

export function useApiRequestTracker() {
  const [requestCount, setRequestCount] = useState(0);
  const [isFromApi, setIsFromApi] = useState(false);

  // Get today's date in YYYY-MM-DD format
  const getToday = () => new Date().toISOString().split('T')[0];

  // Load count from localStorage
  const loadCount = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const log: RequestLog = JSON.parse(stored);
        if (log.date === getToday()) {
          return { count: log.count, fromApi: log.fromApi || false };
        }
      }
    } catch (e) {
      console.error('Error loading request count:', e);
    }
    return { count: 0, fromApi: false };
  }, []);

  // Save count to localStorage
  const saveCount = useCallback((count: number, fromApi: boolean = false) => {
    try {
      const log: RequestLog = {
        date: getToday(),
        count,
        fromApi,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch (e) {
      console.error('Error saving request count:', e);
    }
  }, []);

  // Initialize count on mount
  useEffect(() => {
    const { count, fromApi } = loadCount();
    setRequestCount(count);
    setIsFromApi(fromApi);
  }, [loadCount]);

  // Increment request count (fallback for local tracking)
  const trackRequest = useCallback((count: number = 1) => {
    setRequestCount(prev => {
      const newCount = prev + count;
      saveCount(newCount, false);
      return newCount;
    });
    setIsFromApi(false);
  }, [saveCount]);

  // Sync from API headers (preferred method - accurate data)
  const syncFromApi = useCallback((used: number, limit: number) => {
    if (used >= 0 && limit > 0) {
      console.log(`[Tracker] Syncing from API: ${used}/${limit}`);
      setRequestCount(used);
      setIsFromApi(true);
      saveCount(used, true);
    }
  }, [saveCount]);

  // Reset count (for testing)
  const resetCount = useCallback(() => {
    setRequestCount(0);
    setIsFromApi(false);
    saveCount(0, false);
  }, [saveCount]);

  // Listen for global API usage events
  useEffect(() => {
    const handleApiUsageUpdate = (event: CustomEvent<ApiUsageEventDetail>) => {
      const { used, limit } = event.detail;
      if (used >= 0 && limit > 0) {
        syncFromApi(used, limit);
      }
    };

    window.addEventListener(API_USAGE_EVENT, handleApiUsageUpdate as EventListener);
    return () => {
      window.removeEventListener(API_USAGE_EVENT, handleApiUsageUpdate as EventListener);
    };
  }, [syncFromApi]);

  // Calculated values
  const remaining = Math.max(0, DAILY_LIMIT - requestCount);
  const percentage = (requestCount / DAILY_LIMIT) * 100;

  return {
    requestCount,
    remaining,
    percentage,
    dailyLimit: DAILY_LIMIT,
    canMakeRequest: true, // Informative only - API handles limits
    isFromApi, // true if data comes from real API headers
    trackRequest,
    syncFromApi,
    resetCount,
  };
}

// Helper to emit API usage event from any hook
export function emitApiUsageUpdate(used: number, limit: number, remaining: number) {
  if (typeof window !== 'undefined' && used >= 0 && limit > 0) {
    window.dispatchEvent(new CustomEvent<ApiUsageEventDetail>(API_USAGE_EVENT, {
      detail: { used, limit, remaining }
    }));
  }
}
