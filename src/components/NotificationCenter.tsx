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
import { playNotificationSound, NotificationSoundType } from '@/utils/soundManager';
import { supabase } from '@/integrations/supabase/client';
import { getNowInBrasilia } from '@/utils/timezone';

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

  // Send Telegram notification
  const sendTelegramNotification = async (
    title: string,
    body: string,
    type: NotificationSoundType
  ) => {
    console.log('🔔 Telegram notification attempt:', { 
      title, 
      type, 
      enabled: preferences.telegramEnabled,
      timestamp: new Date().toISOString()
    });

    if (!preferences.telegramEnabled) {
      console.log('⚠️ Telegram notifications disabled in preferences');
      return;
    }

    try {
      console.log('📤 Invoking Telegram edge function...');
      const { data, error } = await supabase.functions.invoke('send-telegram-notification', {
        body: {
          title,
          message: body,
          type,
        },
      });

      if (error) {
        console.error('❌ Telegram error:', error);
      } else {
        console.log('✅ Telegram sent successfully:', data);
      }
    } catch (error) {
      console.error('💥 Telegram exception:', error);
    }
  };

  // Show notification (toast, native, sound, and telegram)
  const showNotification = (
    title: string,
    body: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'info',
    action?: { label: string; onClick: () => void }
  ) => {
    // Play sound
    playNotificationSound(type, preferences.soundEnabled);

    // Send to Telegram (async, non-blocking)
    sendTelegramNotification(title, body, type);

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
      console.log('🔍 Checking notifications (UTC-3)...', {
        enabled: preferences.enabled,
        gamesCount: games.length,
        currentTimeBrasilia: getNowInBrasilia().toISOString(),
        timestamp: new Date().toISOString(),
        preferences: {
          gameProximity: preferences.gameProximity,
          gameLive: preferences.gameLive,
          gameFinished: preferences.gameFinished,
          telegramEnabled: preferences.telegramEnabled,
          soundEnabled: preferences.soundEnabled
        }
      });

      const previousGames = previousGamesRef.current;

      // 1. Check game proximity alerts (15min, 5min)
      if (preferences.gameProximity) {
        console.log('🎮 Total games to check:', games.length);
        games.forEach(game => {
          console.log(`📋 Game: ${formatGameName(game)}`, {
            status: game.status,
            date: game.date,
            time: game.time,
            willCheck: game.status === 'Not Started'
          });
          
          if (game.status !== 'Not Started') return;
          
          const minutesUntil = getMinutesUntilGameStart(game);
          const gameName = formatGameName(game);
          
          console.log(`⏰ Game "${gameName}": ${minutesUntil.toFixed(1)} minutes until start, Status: ${game.status}`);

          // 15 minutes warning - expanded window (14-16 min)
          if (minutesUntil <= 16 && minutesUntil >= 14) {
            const notifId = `game-${game.id}-15min`;
            if (canShowNotification(notifId)) {
              console.log(`📢 Triggering 15-min notification for ${gameName}`);
              showNotification(
                `⚠️ Jogo começa em 15 min: ${gameName}`,
                'Prepare-se para o início',
                'warning',
                { label: 'Ver jogo', onClick: () => navigate('/daily-planning') }
              );
              markAsShown(notifId);
            }
          }

          // 5 minutes critical alert - expanded window (4-6 min)
          if (minutesUntil <= 6 && minutesUntil >= 4) {
            const notifId = `game-${game.id}-5min`;
            if (canShowNotification(notifId)) {
              console.log(`📢 Triggering 5-min notification for ${gameName}`);
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

    // Check every 30 seconds for more precise timing
    const interval = setInterval(checkNotifications, 30000);

    return () => clearInterval(interval);
  }, [games, preferences, canShowNotification, markAsShown, navigate, isPageVisible, showNotification]);

  return <>{children}</>;
};
