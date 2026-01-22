import { useEffect } from 'react';
import { playGoalSound } from '@/utils/soundManager';

/**
 * Hook that listens for goal notification events from Service Worker
 * and plays the celebration sound when triggered
 */
export function useGoalSoundTrigger() {
  useEffect(() => {
    // Handler for messages from Service Worker
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOAL_NOTIFICATION_CLICKED') {
        console.log('[GoalSoundTrigger] Received goal notification click, playing sound!');
        playGoalSound();
      }
    };

    // Handler for when app loads with goal query param
    const checkGoalQueryParam = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('goal_alert') === 'true') {
        console.log('[GoalSoundTrigger] Goal alert query param detected, playing sound!');
        playGoalSound();
        // Clean up query param
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }
    };

    // Check on mount
    checkGoalQueryParam();

    // Listen for SW messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);
}
