import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, Target, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useSupabaseBankroll } from "@/hooks/useSupabaseBankroll";
import { Progress } from "@/components/ui/progress";

export const BankrollSummaryCard = () => {
  const { currentCapital, initialCapital, profit, profitPercentage, isLoading } = useSupabaseBankroll();
  
  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardContent className="h-[200px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground animate-pulse">Carregando banca...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isProfit = profit >= 0;
  // Meta fixa para exemplo, futuramente pode vir do banco
  const targetValue = 15000;
  const progressValue = Math.min((currentCapital / targetValue) * 100, 100);
  const remainingToTarget = Math.max(targetValue - currentCapital, 0);

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-background shadow-2xl group transition-all duration-300 hover:shadow-primary/5">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors duration-500" />
      <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
      
      <CardHeader className="pb-2 space-y-0 relative z-10">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            Portfólio Atual
          </CardTitle>
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${isProfit ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
            {isProfit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {isProfit ? '+' : ''}{profitPercentage.toFixed(1)}%
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 relative z-10">
        <div>
          <div className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            R$ {currentCapital.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <span className={isProfit ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
              {isProfit ? 'Ganho' : 'Variação'} de R$ {Math.abs(profit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="opacity-50">•</span>
            <span>Inicial: R$ {initialCapital.toLocaleString('pt-BR')}</span>
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-end text-xs">
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Target className="w-3 h-3 text-primary/70" />
                Progresso do Objetivo
              </span>
            </div>
            <div className="text-right">
              <span className="font-bold text-foreground">{progressValue.toFixed(0)}%</span>
              <span className="text-muted-foreground ml-1">concluído</span>
            </div>
          </div>
          
          <div className="relative pt-1">
            <Progress 
              value={progressValue} 
              className="h-2.5 bg-muted/40 border border-white/5" 
              indicatorClassName="bg-gradient-to-r from-primary via-primary to-primary/60 shadow-[0_0_10px_rgba(var(--primary),0.3)] transition-all duration-1000 ease-out"
            />
          </div>

          <div className="flex justify-between items-center text-[10px] uppercase tracking-tighter font-semibold text-muted-foreground pt-1">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
              <span>R$ {currentCapital.toLocaleString('pt-BR', { notation: 'compact' })}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Alvo: R$ {targetValue.toLocaleString('pt-BR', { notation: 'compact' })}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            </div>
          </div>
        </div>

        {remainingToTarget > 0 ? (
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between group-hover:bg-primary/10 transition-colors duration-300">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-medium text-muted-foreground">Faltam p/ Meta:</span>
            </div>
            <span className="text-[11px] font-bold text-primary">
              R$ {remainingToTarget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-green-500" />
            <span className="text-[11px] font-bold text-green-500">META ATINGIDA! 🚀</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
