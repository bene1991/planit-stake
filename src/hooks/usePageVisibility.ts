import { useState, useEffect } from 'react';

/**
 * Hook to detect page visibility using the Page Visibility API.
 * Returns true when the page/tab is visible, false when hidden.
 * 
 * Used to pause API polling when the user is not looking at the page,
 * significantly reducing API credit consumption.
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      console.log(`[usePageVisibility] Page is now ${visible ? 'VISIBLE' : 'HIDDEN'}`);
      setIsVisible(visible);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
