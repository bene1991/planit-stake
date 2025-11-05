export type NotificationSoundType = 'success' | 'warning' | 'error' | 'info';

const soundMap: Record<NotificationSoundType, string> = {
  success: '/sounds/notification-success.mp3',
  warning: '/sounds/notification-warning.mp3',
  error: '/sounds/notification-error.mp3',
  info: '/sounds/notification-info.mp3',
};

export const playNotificationSound = (
  type: NotificationSoundType,
  enabled: boolean
): void => {
  if (!enabled) return;

  try {
    const audio = new Audio(soundMap[type]);
    audio.volume = 0.5;
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
