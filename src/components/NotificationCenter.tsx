import { useEffect, useRef } from 'react';
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
  const { preferences, canShowNotification, markAsShown } = useNotifications();
  const navigate = useNavigate();
  const previousGamesRef = useRef<Game[]>([]);

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
              toast.warning(`⚠️ Jogo começa em 15 min: ${gameName}`, {
                duration: 8000,
                action: {
                  label: 'Ver jogo',
                  onClick: () => navigate('/daily-planning'),
                },
              });
              markAsShown(notifId);
            }
          }

          // 5 minutes critical alert
          if (minutesUntil <= 5 && minutesUntil > 3) {
            const notifId = `game-${game.id}-5min`;
            if (canShowNotification(notifId)) {
              toast.error(`🔴 ATENÇÃO! Jogo começa em 5 min: ${gameName}`, {
                duration: 10000,
                action: {
                  label: 'Ver jogo',
                  onClick: () => navigate('/daily-planning'),
                },
              });
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
            toast.success(`🟢 LIVE AGORA: ${gameName}`, {
              duration: 10000,
              action: {
                label: 'Acompanhar',
                onClick: () => navigate('/daily-planning'),
              },
            });
            markAsShown(notifId);
          }
        }

        // Game finished
        if (preferences.gameFinished && previousGame.status !== 'Finished' && game.status === 'Finished') {
          const notifId = `game-${game.id}-finished`;
          if (canShowNotification(notifId, 180)) { // 3h cooldown
            toast.info(`✅ Jogo finalizado: ${gameName}`, {
              duration: 6000,
              action: {
                label: 'Ver resultado',
                onClick: () => navigate('/daily-planning'),
              },
            });
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
            toast.info(`⚡ ${pendingCount} operação${pendingCount > 1 ? 'ões' : ''} pendente${pendingCount > 1 ? 's' : ''} de finalização`, {
              duration: 8000,
              action: {
                label: 'Finalizar',
                onClick: () => navigate('/daily-planning'),
              },
            });
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
          toast.success(`🎉 Parabéns! Meta de 5 greens alcançada hoje!`, {
            duration: 10000,
            action: {
              label: 'Ver estatísticas',
              onClick: () => navigate('/statistics'),
            },
          });
          markAsShown(notifId);
        }
      }

      // Win rate alerts
      if (preferences.winRateAlerts && dailyStats.total >= 3 && dailyStats.winRate < 50) {
        const notifId = `winrate-low-${today}`;
        if (canShowNotification(notifId, 240)) { // 4h cooldown
          toast.warning(`⚠️ Win rate abaixo de 50% (${dailyStats.winRate.toFixed(1)}%)`, {
            duration: 8000,
            action: {
              label: 'Analisar',
              onClick: () => navigate('/statistics'),
            },
          });
          markAsShown(notifId);
        }
      }

      // 5. Check streaks
      if (preferences.streakAlerts) {
        const { streak, type } = detectStreak(games);
        
        if (type === 'green' && streak >= 5) {
          const notifId = `streak-green-${streak}`;
          if (canShowNotification(notifId, 180)) { // 3h cooldown
            toast.success(`🔥 Streak de ${streak} greens consecutivos!`, {
              duration: 10000,
              action: {
                label: 'Ver progresso',
                onClick: () => navigate('/statistics'),
              },
            });
            markAsShown(notifId);
          }
        }
        
        if (type === 'red' && streak >= 3) {
          const notifId = `streak-red-${streak}`;
          if (canShowNotification(notifId, 180)) { // 3h cooldown
            toast.error(`🚨 Atenção: ${streak} reds seguidos - revisar estratégia`, {
              duration: 12000,
              action: {
                label: 'Analisar',
                onClick: () => navigate('/statistics'),
              },
            });
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
            toast.success(`💵 +R$ ${roi.toFixed(2)} de lucro hoje!`, {
              duration: 10000,
              action: {
                label: 'Ver bankroll',
                onClick: () => navigate('/bankroll'),
              },
            });
            markAsShown(notifId);
          }
        }
        
        if (roi < -200) {
          const notifId = `roi-loss-${today}`;
          if (canShowNotification(notifId, 360)) { // 6h cooldown
            toast.error(`⚠️ R$ ${roi.toFixed(2)} de prejuízo hoje - cuidado!`, {
              duration: 12000,
              action: {
                label: 'Revisar',
                onClick: () => navigate('/statistics'),
              },
            });
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
  }, [games, preferences, canShowNotification, markAsShown, navigate]);

  return <>{children}</>;
};
