import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BankrollSummaryCard } from "@/components/dashboard/BankrollSummaryCard";
import { ListTodo, Filter, Zap, Target, History } from "lucide-react";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ProfitTrendChart } from "@/components/dashboard/ProfitTrendChart";
import { MethodPerformanceList } from "@/components/dashboard/MethodPerformanceList";
import { StakeCalculator } from "@/components/dashboard/StakeCalculator";

export default function Dashboard() {
  const navigate = useNavigate();
  const { games, loading: isLoading } = useSupabaseGames();

  // Simple stats for the demo
  const pendingGames = games.filter(g => g.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30">
      {/* Dynamic background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px]" />
      </div>

      <div className="container px-4 py-8 space-y-8 sm:px-6 relative z-10 animate-in fade-in duration-700">
        {/* ViniTrader Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-slate-900 border border-white/5 p-8 shadow-2xl">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest">
                <Zap className="h-3 w-3 fill-current" />
                ViniAnalytics AI Active
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
                Bom dia, <span className="bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent italic">Vini</span>.
              </h1>
              <p className="text-slate-400 max-w-md">
                O mercado está aberto e as oportunidades analisadas. {pendingGames > 0 ? `Temos ${pendingGames} análises mapeadas para hoje.` : "Monitorando janelas de valor nas próximas horas."}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
              <Button size="lg" className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 group transition-all" onClick={() => navigate('/')}>
                <Target className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                Nova Análise
              </Button>
              <Button size="lg" variant="outline" className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 font-bold backdrop-blur-sm group transition-all">
                <History className="mr-2 h-5 w-5 group-hover:-rotate-12 transition-transform" />
                Relatório
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Bankroll Card */}
          <div className="md:col-span-2 space-y-6">
            <BankrollSummaryCard />
            <div className="grid grid-cols-1 gap-6">
              <ProfitTrendChart />
            </div>
          </div>

          {/* Stake Calculator & Stats */}
          <div className="space-y-6">
            <StakeCalculator />
            
            <Card className="bg-slate-900/40 border-white/5 shadow-xl backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListTodo className="h-5 w-5 text-indigo-400" />
                  Agenda de Análises
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingGames > 0 ? (
                  <div className="space-y-3">
                    {games.filter(g => g.status === 'pending').slice(0, 4).map(game => (
                      <div key={game.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer group" onClick={() => navigate('/')}>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold group-hover:text-indigo-300 transition-colors">{game.homeTeam} x {game.awayTeam}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{game.league}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold bg-slate-800 px-2 py-0.5 rounded text-slate-400">{game.time}</span>
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="w-full text-xs text-slate-500 hover:text-white" onClick={() => navigate('/')}>Ver lista completa</Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                    <History className="h-10 w-10 text-slate-700" />
                    <p className="text-slate-500 text-sm italic">Nenhum evento no radar agora.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6">
          <MethodPerformanceList />
        </div>
      </div>
    </div>
  );
}
