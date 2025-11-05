import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { LogoProvider } from "@/contexts/LogoContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { Layout } from "./components/Layout";
import BankrollManagement from "./pages/BankrollManagement";
import DailyPlanning from "./pages/DailyPlanning";
import Statistics from "./pages/Statistics";
import Estrategias from "./pages/Estrategias";
import Simulador from "./pages/Simulador";
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
          path="/bankroll"
          element={
            <ProtectedRoute>
              <Layout><BankrollManagement /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/statistics"
          element={
            <ProtectedRoute>
              <Layout><Statistics /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estrategias"
          element={
            <ProtectedRoute>
              <Layout><Estrategias /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/simulador"
          element={
            <ProtectedRoute>
              <Layout><Simulador /></Layout>
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

const queryClient = new QueryClient();

const App = () => (
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

export default App;
