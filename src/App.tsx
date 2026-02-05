import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { LogoProvider } from "@/contexts/LogoContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { Layout } from "./components/Layout";
import BankrollManagement from "./pages/BankrollManagement";
import DailyPlanning from "./pages/DailyPlanning";
import Performance from "./pages/Performance";
import MonthlyReport from "./pages/MonthlyReport";
import BttsTracker from "./pages/BttsTracker";
import Auth from "./pages/Auth";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";

const AppContent = () => {
  const { games } = useSupabaseGames();

  return (
    <NotificationCenter games={games}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout><DailyPlanning /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/daily-planning"
          element={
            <ProtectedRoute>
              <Layout><DailyPlanning /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankroll"
          element={
            <ProtectedRoute>
              <Layout><BankrollManagement /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/performance"
          element={
            <ProtectedRoute>
              <Layout><Performance /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/monthly-report"
          element={
            <ProtectedRoute>
              <Layout><MonthlyReport /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/btts"
          element={
            <ProtectedRoute>
              <Layout><BttsTracker /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Layout><Account /></Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </NotificationCenter>
  );
};

const App = () => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <LogoProvider>
                <AppContent />
              </LogoProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
