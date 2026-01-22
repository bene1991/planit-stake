export type NotificationSoundType = 'success' | 'warning' | 'error' | 'info' | 'goal';

const soundMap: Record<NotificationSoundType, string> = {
  success: '/sounds/notification-success.mp3',
  warning: '/sounds/notification-warning.mp3',
  error: '/sounds/notification-error.mp3',
  info: '/sounds/notification-info.mp3',
  goal: '/sounds/goal-celebration.mp3',
};

export const playNotificationSound = (
  type: NotificationSoundType,
  enabled: boolean
): void => {
  if (!enabled) return;

  try {
    const audio = new Audio(soundMap[type]);
    // Volume mais alto para gol (comemoração épica!)
    audio.volume = type === 'goal' ? 0.8 : 0.5;
    audio.play().catch((err) => {
      console.warn('Could not play notification sound:', err);
    });
  } catch (error) {
    console.warn('Error creating audio element:', error);
  }
};

export const testSound = (type: NotificationSoundType): void => {
  playNotificationSound(type, true);
};

// Função específica para tocar som de gol
export const playGoalSound = (): void => {
  playNotificationSound('goal', true);
};
