import { useState, useCallback } from 'react';

const STORAGE_KEY = 'apiPaused';

export function useApiPause() {
  const [isPaused, setIsPaused] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setIsPaused(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      console.log(`[useApiPause] API requests ${next ? 'PAUSED' : 'RESUMED'} by user`);
      return next;
    });
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
    localStorage.setItem(STORAGE_KEY, 'false');
  }, []);

  return { isPaused, toggle, pause, resume };
}
