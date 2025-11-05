import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Game } from '@/hooks/useSupabaseGames';
import { useNotifications } from '@/hooks/useNotifications';
import {
  getMinutesUntilGameStart,
  hasPendingOperations,
  getDailyStats,
  detectStreak,
  getPendingOperationsCount,
  formatGameName,
} from '@/utils/notificationHelpers';

interface NotificationCenterProps {
  children: React.ReactNode;
  games: Game[];
}

export const NotificationCenter = ({ children, games }: NotificationCenterProps) => {
  const { preferences, canShowNotification, markAsShown, requestNativePermission } = useNotifications();
  const navigate = useNavigate();
  const previousGamesRef = useRef<Game[]>([]);
  const [isPageVisible, setIsPageVisible] = useState(true);

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

  // Show notification (toast or native)
  const showNotification = (
    title: string,
    body: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'info',
    action?: { label: string; onClick: () => void }
  ) => {
    const useNative = preferences.nativeEnabled && !isPageVisible && 'Notification' in window && Notification.permission === 'granted';

    if (useNative) {
      // Native browser notification
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
      // Internal toast (sonner)
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
  };

  useEffect(() => {
    if (!preferences.enabled) return;

    const checkNotifications = () => {
      const previousGames = previousGamesRef.current;

      // 1. Check game proximity alerts (15min, 5min)
      if (preferences.gameProximity) {
        games.forEach(game => {
          if (game.status !== 'Not Started') return;
          
          const minutesUntil = getMinutesUntilGameStart(game);
          const gameName = formatGameName(game);

          // 15 minutes warning
          if (minutesUntil <= 15 && minutesUntil > 13) {
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
          if (minutesUntil <= 5 && minutesUntil > 3) {
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
      games.forEach(game => {
        const previousGame = previousGames.find(g => g.id === game.id);
        if (!previousGame) return;

        const gameName = formatGameName(game);

        // Game went Live
        if (preferences.gameLive && previousGame.status !== 'Live' && game.status === 'Live') {
          const notifId = `game-${game.id}-live`;
          if (canShowNotification(notifId, 120)) { // 2h cooldown
            showNotification(
              `🟢 LIVE AGORA: ${gameName}`,
              'O jogo começou!',
              'success',
              { label: 'Acompanhar', onClick: () => navigate('/daily-planning') }
            );
            markAsShown(notifId);
          }
        }

        // Game finished
        if (preferences.gameFinished && previousGame.status !== 'Finished' && game.status === 'Finished') {
          const notifId = `game-${game.id}-finished`;
          if (canShowNotification(notifId, 180)) { // 3h cooldown
            showNotification(
              `✅ Jogo finalizado: ${gameName}`,
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
        const pendingCount = getPendingOperationsCount(games);
        
        if (pendingCount > 0) {
          const notifId = `pending-ops-${new Date().toISOString().split('T')[0]}`;
          if (canShowNotification(notifId, 120)) { // 2h cooldown
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
      const dailyStats = getDailyStats(games);
      const today = new Date().toISOString().split('T')[0];

      // Daily goals achievement
      if (preferences.dailyGoals && dailyStats.greens >= 5) {
        const notifId = `daily-goal-${today}`;
        if (canShowNotification(notifId, 1440)) { // Once per day
          showNotification(
            '🎉 Parabéns! Meta de 5 greens alcançada!',
            'Excelente performance hoje!',
            'success',
            { label: 'Ver estatísticas', onClick: () => navigate('/statistics') }
          );
          markAsShown(notifId);
        }
      }

      // Win rate alerts
      if (preferences.winRateAlerts && dailyStats.total >= 3 && dailyStats.winRate < 50) {
        const notifId = `winrate-low-${today}`;
        if (canShowNotification(notifId, 240)) { // 4h cooldown
          showNotification(
            `⚠️ Win rate abaixo de 50% (${dailyStats.winRate.toFixed(1)}%)`,
            'Revise sua estratégia',
            'warning',
            { label: 'Analisar', onClick: () => navigate('/statistics') }
          );
          markAsShown(notifId);
        }
      }

      // 5. Check streaks
      if (preferences.streakAlerts) {
        const { streak, type } = detectStreak(games);
        
        if (type === 'green' && streak >= 5) {
          const notifId = `streak-green-${streak}`;
          if (canShowNotification(notifId, 180)) { // 3h cooldown
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
          if (canShowNotification(notifId, 180)) { // 3h cooldown
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

      // 6. Check ROI alerts
      if (preferences.roiAlerts && dailyStats.total > 0) {
        const roi = dailyStats.roi;
        
        if (roi > 300) {
          const notifId = `roi-profit-${today}`;
          if (canShowNotification(notifId, 360)) { // 6h cooldown
            showNotification(
              `💵 +R$ ${roi.toFixed(2)} de lucro hoje!`,
              'Ótimo trabalho!',
              'success',
              { label: 'Ver bankroll', onClick: () => navigate('/bankroll') }
            );
            markAsShown(notifId);
          }
        }
        
        if (roi < -200) {
          const notifId = `roi-loss-${today}`;
          if (canShowNotification(notifId, 360)) { // 6h cooldown
            showNotification(
              `⚠️ R$ ${roi.toFixed(2)} de prejuízo hoje`,
              'Considere encerrar o dia',
              'error',
              { label: 'Revisar', onClick: () => navigate('/statistics') }
            );
            markAsShown(notifId);
          }
        }
      }

      // Update previous games state
      previousGamesRef.current = games;
    };

    // Initial check
    checkNotifications();

    // Check every minute
    const interval = setInterval(checkNotifications, 60000);

    return () => clearInterval(interval);
  }, [games, preferences, canShowNotification, markAsShown, navigate, isPageVisible, showNotification]);

  return <>{children}</>;
};
