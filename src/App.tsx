import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useState, useCallback, lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { LogoProvider } from "@/contexts/LogoContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { Layout } from "./components/Layout";
import { toast } from "sonner";
import { LiveScoresProvider } from "@/contexts/LiveScoresContext";
import { Lay1x0Provider } from "@/contexts/Lay1x0Context";
import { sendTelegramNotification } from "@/utils/telegramNotification";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { GoalDetectedCallback, RedCardEvent } from "@/hooks/useLiveScores";
import { playGoalSound, playNotificationSound, playRedCardVoice } from "./utils/soundManager";

// Helper to retry lazy loading if it fails (common for stale chunks after deploy)
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      return await componentImport();
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        return window.location.reload();
      }
      throw error;
    }
  });

// Lazy-loaded pages
const BankrollManagement = lazyWithRetry(() => import("./pages/BankrollManagement"));
const DailyPlanning = lazyWithRetry(() => import("./pages/DailyPlanning"));
const Performance = lazyWithRetry(() => import("./pages/Performance"));
const MonthlyReport = lazyWithRetry(() => import("./pages/MonthlyReport"));
const MethodAnalysis = lazyWithRetry(() => import("./pages/MethodAnalysis"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Account = lazyWithRetry(() => import("./pages/Account"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const MatchbookOdds = lazyWithRetry(() => import("./pages/MatchbookOdds"));
const Lay0x1 = lazyWithRetry(() => import("./pages/Lay0x1"));
const Lay1x0 = lazyWithRetry(() => import("./pages/Lay1x0"));
const RoboAoVivo = lazyWithRetry(() => import("./pages/RoboAoVivo"));

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const AppContent = () => {
  const { games } = useSupabaseGames();
  const { preferences: notifPrefs } = useNotifications();
  const { user } = useAuth();
  const [highlightedGameId, setHighlightedGameId] = useState<string | null>(null);

  const handleGoalDetected = useCallback<GoalDetectedCallback>((gameId, team, homeScore, awayScore, game, playerName, minute, apiHome, apiAway, apiLeague) => {
    if (!game) return;
    const hTeam = game?.homeTeam || apiHome || 'Home';
    const aTeam = game?.awayTeam || apiAway || 'Away';
    const league = game?.league || apiLeague || 'League';
    const isPending = game.methodOperations.length === 0 || game.methodOperations.some(op => !op.result);
    if (!isPending) return;
    if (game.id) setHighlightedGameId(game.id);
    if (notifPrefs.enabled) {
      const scoringTeamName = team === 'home' ? hTeam : aTeam;
      const message = `⚽ GOL! ${scoringTeamName} (${minute}')\n${hTeam} ${homeScore} - ${awayScore} ${aTeam}`;
      toast.success(message, { duration: 8000 });
      if (notifPrefs.soundEnabled) playGoalSound();
    }
    if (notifPrefs.telegramEnabled) {
      const scoringTeamName = team === 'home' ? hTeam : aTeam;
      const playerLine = playerName ? `\n⚽ Jogador: ${playerName} (${scoringTeamName})` : '';
      const msg = `⚽ <b>GOL!</b> ${scoringTeamName}${playerLine}\n${hTeam} ${homeScore} - ${awayScore} ${aTeam}\n🏟 ${league} | ⏱ ${minute || '??'}'`;
      sendTelegramNotification(msg).catch(err => console.error('[App] Telegram goal error:', err));
    }
    if (user && document.hidden) {
      const scoringTeamName = team === 'home' ? hTeam : aTeam;
      supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          payload: {
            title: '⚽ GOL!',
            body: `${scoringTeamName}${playerName ? ` (${playerName})` : ''} marca! ${hTeam} ${homeScore} x ${awayScore} ${aTeam}`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: { type: 'goal', homeTeam: hTeam, awayTeam: aTeam, homeScore, awayScore }
          }
        }
      }).catch(err => console.error('[App] Push goal error:', err));
    }
  }, [user, notifPrefs, setHighlightedGameId]);

  const handleRedCardDetected = useCallback((event: RedCardEvent) => {
    if (!notifPrefs.redCardAlerts || !notifPrefs.enabled) return;
    const game = games.find(g => g.api_fixture_id === event.fixtureId.toString());
    if (!game) return;
    const isPending = game.methodOperations.length === 0 || game.methodOperations.some(op => !op.result);
    if (!isPending) return;
    const hTeam = game.homeTeam;
    const aTeam = game.awayTeam;
    const scoringTeamName = event.team === 'home' ? hTeam : aTeam;
    const playerName = event.player || 'Jogador';
    const message = `🟥 Cartão Vermelho! ${playerName} - ${scoringTeamName} (${event.minute}')`;
    toast.error(message, { duration: 8000 });
    if (notifPrefs.soundEnabled) playNotificationSound('error', true);
    if (notifPrefs.voiceAlerts) playRedCardVoice();
    if (game && user && document.hidden) {
      supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          payload: {
            title: '🟥 Cartão Vermelho!',
            body: `Jogador: ${playerName} (${scoringTeamName})\n${game.homeTeam} vs ${game.awayTeam} | ⏱ ${event.minute}'`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: { type: 'red_card', fixtureId: event.fixtureId }
          }
        }
      }).catch(err => console.error('[App] Push red card error:', err));
    }
    if (notifPrefs.telegramEnabled) {
      const msg = `🟥 <b>CARTÃO VERMELHO!</b>\nJogador: ${playerName} (${scoringTeamName})\n${hTeam} vs ${aTeam}\n🏟 ${game.league} | ⏱ ${event.minute}'`;
      sendTelegramNotification(msg).catch(err => console.error('[App] Telegram red card error:', err));
    }
  }, [user, notifPrefs, games]);

  return (
    <NotificationCenter games={games}>
      <LiveScoresProvider
        onGoalDetected={handleGoalDetected}
        onRedCardDetected={handleRedCardDetected}
        monitorAllLive={true}
        highlightedGameId={highlightedGameId}
        setHighlightedGameId={setHighlightedGameId}
      >
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Layout><DailyPlanning /></Layout></ProtectedRoute>} />
            <Route path="/daily-planning" element={<Navigate to="/" replace />} />
            <Route path="/bankroll" element={<ProtectedRoute><Layout><BankrollManagement /></Layout></ProtectedRoute>} />
            <Route path="/robo" element={<ProtectedRoute><Layout><RoboAoVivo /></Layout></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute><Layout><Performance /></Layout></ProtectedRoute>} />
            <Route path="/monthly-report" element={<ProtectedRoute><Layout><MonthlyReport /></Layout></ProtectedRoute>} />
            <Route path="/method-analysis" element={<ProtectedRoute><Layout><MethodAnalysis /></Layout></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><Layout><Account /></Layout></ProtectedRoute>} />
            <Route path="/matchbook" element={<ProtectedRoute><Layout><MatchbookOdds /></Layout></ProtectedRoute>} />
            <Route path="/lay-0x1" element={<ProtectedRoute><Layout><Lay0x1 /></Layout></ProtectedRoute>} />
            <Route path="/lay-1x0" element={<ProtectedRoute><Layout><Lay1x0 /></Layout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </LiveScoresProvider>
    </NotificationCenter>
  );
};

const App = () => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false, retry: 2, gcTime: 1000 * 60 * 30 },
      mutations: { onError: (error) => { console.error('[Mutation Error]', error); toast.error('Erro ao salvar dados. Tente novamente.'); } },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <ErrorBoundary>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <Lay1x0Provider>
                  <LogoProvider>
                    <AppContent />
                  </LogoProvider>
                </Lay1x0Provider>
              </AuthProvider>
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
