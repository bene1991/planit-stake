import { useState, useEffect } from 'react';

export interface NotificationPreferences {
  enabled: boolean;
  nativeEnabled: boolean;      // Native browser notifications
  telegramEnabled: boolean;    // Telegram notifications
  soundEnabled: boolean;       // Sound notifications
  gameProximity: boolean;      // 15min, 5min alerts
  gameLive: boolean;           // Game started
  gameFinished: boolean;       // Game ended
  pendingOperations: boolean;  // Unfinalized operations
  dailyGoals: boolean;         // Daily targets
  winRateAlerts: boolean;      // Critical win rate
  streakAlerts: boolean;       // Green/red streaks
  roiAlerts: boolean;          // Profit/loss alerts
  voiceAlerts: boolean;        // Voice announcement on game start
}

export interface NotificationState {
  lastChecked: string;
  shownNotifications: Array<{
    id: string;
    timestamp: number;
  }>;
}

const PREFERENCES_KEY = 'vt-notification-preferences';
const STATE_KEY = 'vt-notification-state';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  nativeEnabled: false,
  telegramEnabled: false,
  soundEnabled: true,
  gameProximity: true,
  gameLive: true,
  gameFinished: true,
  pendingOperations: true,
  dailyGoals: true,
  winRateAlerts: true,
  streakAlerts: true,
  roiAlerts: true,
  voiceAlerts: true,
};

const DEFAULT_STATE: NotificationState = {
  lastChecked: new Date().toISOString(),
  shownNotifications: [],
};

export const useNotifications = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
  });

  const [state, setState] = useState<NotificationState>(() => {
    const stored = localStorage.getItem(STATE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_STATE;
  });

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [state]);

  // Reset daily notifications at midnight
  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      const lastCheck = new Date(state.lastChecked);
      
      if (now.getDate() !== lastCheck.getDate()) {
        setState(prev => ({
          ...prev,
          lastChecked: now.toISOString(),
          shownNotifications: prev.shownNotifications.filter(n => {
            // Keep game-specific notifications for 24h, clear daily ones
            return !n.id.includes('daily-') && !n.id.includes('roi-');
          }),
        }));
      }
    };

    const interval = setInterval(checkMidnight, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [state.lastChecked]);

  const updatePreferences = (updates: Partial<NotificationPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  const canShowNotification = (
    notificationId: string,
    cooldownMinutes: number = 60
  ): boolean => {
    const shown = state.shownNotifications.find(n => n.id === notificationId);
    
    if (!shown) return true;
    
    const timeSince = Date.now() - shown.timestamp;
    return timeSince > (cooldownMinutes * 60 * 1000);
  };

  const markAsShown = (notificationId: string) => {
    setState(prev => ({
      ...prev,
      shownNotifications: [
        ...prev.shownNotifications.filter(n => n.id !== notificationId),
        { id: notificationId, timestamp: Date.now() }
      ],
    }));
  };

  const requestNativePermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações nativas');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  return {
    preferences,
    updatePreferences,
    canShowNotification,
    markAsShown,
    requestNativePermission,
  };
};
