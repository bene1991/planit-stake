import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Game } from '@/hooks/useSupabaseGames';
import { useNotifications } from '@/hooks/useNotifications';
import {
  getMinutesUntilGameStart,
  getDailyStats,
  detectStreak,
  getPendingOperationsCount,
  formatGameName,
} from '@/utils/notificationHelpers';
import { playNotificationSound, NotificationSoundType, playGameStartVoice } from '@/utils/soundManager';
import { sendTelegramNotification } from '@/utils/telegramNotification';
import { getNowInBrasilia } from '@/utils/timezone';

interface NotificationCenterProps {
  children: React.ReactNode;
  games: Game[];
}

export const NotificationCenter = ({ children, games }: NotificationCenterProps) => {
  const { preferences, canShowNotification, markAsShown, requestNativePermission } = useNotifications();
  const navigate = useNavigate();
  const previousGamesRef = useRef<Game[]>([]);
  const gamesRef = useRef<Game[]>(games);
  const [isPageVisible, setIsPageVisible] = useState(true);

  // Sync games ref
  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

  // Detect page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Request native permission when enabled
  useEffect(() => {
    if (preferences.nativeEnabled && 'Notification' in window) {
      if (Notification.permission === 'default') {
        requestNativePermission();
      }
    }
  }, [preferences.nativeEnabled, requestNativePermission]);

  // Send Telegram notification
  const sendTelegramMsg = async (
    title: string,
    body: string,
    type: NotificationSoundType
  ) => {
    if (!preferences.telegramEnabled) return;
    const message = `${title}\n${body}`;
    await sendTelegramNotification(message);
  };

  // Show notification (toast, native, sound, and telegram)
  const showNotification = useCallback((
    title: string,
    body: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'info',
    action?: { label: string; onClick: () => void },
    skipSound: boolean = false
  ) => {
    if (!skipSound) {
      playNotificationSound(type, preferences.soundEnabled);
    }

    sendTelegramMsg(title, body, type);

    const useNative = preferences.nativeEnabled && !isPageVisible && 'Notification' in window && Notification.permission === 'granted';

    if (useNative) {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: `vt-${Date.now()}`,
        requireInteraction: type === 'error' || type === 'warning',
      });

      if (action) {
        notification.onclick = () => {
          window.focus();
          action.onClick();
          notification.close();
        };
      }
    } else {
      const toastFn = toast[type] || toast;
      toastFn(title, {
        description: body,
        duration: type === 'error' ? 10000 : type === 'warning' ? 8000 : 5000,
        action: action ? {
          label: action.label,
          onClick: action.onClick,
        } : undefined,
      });
    }
  }, [preferences.nativeEnabled, preferences.soundEnabled, preferences.telegramEnabled, isPageVisible]);

  const checkNotifications = useCallback(() => {
    if (!preferences.enabled) return;

    const currentGames = gamesRef.current;
    const previousGames = previousGamesRef.current;

    // 1. Check game proximity alerts (15min, 5min)
    if (preferences.gameProximity) {
      currentGames.forEach(game => {
        if (game.status !== 'Not Started') return;

        const minutesUntil = getMinutesUntilGameStart(game);
        const gameName = formatGameName(game);

        // 15 minutes warning
        if (minutesUntil <= 16 && minutesUntil >= 14) {
          const notifId = `game-${game.id}-15min`;
          if (canShowNotification(notifId)) {
            showNotification(
              `⚠️ Jogo começa em 15 min: ${gameName}`,
              'Prepare-se para o início',
              'warning',
              { label: 'Ver jogo', onClick: () => navigate('/daily-planning') }
            );
            markAsShown(notifId);
          }
        }

        // 5 minutes critical alert
        if (minutesUntil <= 6 && minutesUntil >= 4) {
          const notifId = `game-${game.id}-5min`;
          if (canShowNotification(notifId)) {
            showNotification(
              `🔴 ATENÇÃO! Jogo começa em 5 min: ${gameName}`,
              'Últimos minutos antes do início!',
              'error',
              { label: 'Ver jogo', onClick: () => navigate('/daily-planning') }
            );
            markAsShown(notifId);
          }
        }
      });
    }

    // 2. Check game status changes (Live, Finished)
    currentGames.forEach(game => {
      const previousGame = previousGames.find(g => g.id === game.id);
      if (!previousGame) return;

      const gameName = formatGameName(game);

      // Game went Live
      if (preferences.gameLive && previousGame.status !== 'Live' && previousGame.status !== 'Finished' && game.status === 'Live') {
        const notifId = `game-${game.id}-live`;
        if (canShowNotification(notifId, 120)) {
          showNotification(
            `⚽ Jogo AO VIVO: ${game.homeTeam} x ${game.awayTeam} (${game.league})`,
            'O jogo começou!',
            'success',
            { label: 'Acompanhar', onClick: () => navigate('/daily-planning') },
            true
          );
          markAsShown(notifId);

          const hasGoals = (game.finalScoreHome ?? 0) > 0 || (game.finalScoreAway ?? 0) > 0;
          if (preferences.voiceAlerts && !hasGoals) {
            playGameStartVoice();
          }
        }
      }

      // Game finished
      if (preferences.gameFinished && previousGame.status !== 'Finished' && game.status === 'Finished') {
        const notifId = `game-${game.id}-finished`;
        if (canShowNotification(notifId, 180)) {
          showNotification(
            `🏁 Jogo finalizado: ${game.homeTeam} x ${game.awayTeam}`,
            'Hora de finalizar as operações',
            'info',
            { label: 'Ver resultado', onClick: () => navigate('/daily-planning') }
          );
          markAsShown(notifId);
        }
      }
    });

    // 3. Check pending operations
    if (preferences.pendingOperations) {
      const pendingCount = getPendingOperationsCount(currentGames);
      if (pendingCount > 0) {
        const notifId = `pending-ops-${new Date().toISOString().split('T')[0]}`;
        if (canShowNotification(notifId, 120)) {
          showNotification(
            `⚡ ${pendingCount} operação${pendingCount > 1 ? 'ões' : ''} pendente${pendingCount > 1 ? 's' : ''}`,
            'Não esqueça de finalizar',
            'info',
            { label: 'Finalizar', onClick: () => navigate('/daily-planning') }
          );
          markAsShown(notifId);
        }
      }
    }

    // 4. Check daily goals and stats
    const dailyStats = getDailyStats(currentGames);
    const today = new Date().toISOString().split('T')[0];

    // Daily goals achievement
    if (preferences.dailyGoals && dailyStats.greens >= 5) {
      const notifId = `daily-goal-${today}`;
      if (canShowNotification(notifId, 1440)) {
        showNotification(
          '🎉 Parabéns! Meta de 5 greens alcançada!',
          'Excelente performance hoje!',
          'success',
          { label: 'Ver estatísticas', onClick: () => navigate('/statistics') }
        );
        markAsShown(notifId);
      }
    }

    // 5. Check streaks
    if (preferences.streakAlerts) {
      const { streak, type } = detectStreak(currentGames);
      if (type === 'green' && streak >= 5) {
        const notifId = `streak-green-${streak}`;
        if (canShowNotification(notifId, 180)) {
          showNotification(
            `🔥 Streak de ${streak} greens consecutivos!`,
            'Você está em fogo!',
            'success',
            { label: 'Ver progresso', onClick: () => navigate('/statistics') }
          );
          markAsShown(notifId);
        }
      }

      if (type === 'red' && streak >= 3) {
        const notifId = `streak-red-${streak}`;
        if (canShowNotification(notifId, 180)) {
          showNotification(
            `🚨 Atenção: ${streak} reds seguidos`,
            'Hora de revisar a estratégia',
            'error',
            { label: 'Analisar', onClick: () => navigate('/statistics') }
          );
          markAsShown(notifId);
        }
      }
    }

    previousGamesRef.current = currentGames;
  }, [preferences, canShowNotification, markAsShown, navigate, showNotification]);

  // Main interval
  useEffect(() => {
    if (!preferences.enabled) return;

    // Small random delay for initial check to avoid multi-tab race
    const initialTimer = setTimeout(checkNotifications, Math.random() * 2000);
    const interval = setInterval(checkNotifications, 30000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [preferences.enabled, checkNotifications]);

  return <>{children}</>;
};
