 import { Card, CardContent } from '@/components/ui/card';
 import { TrendingUp, TrendingDown, Target, Calculator, BarChart3, Percent } from 'lucide-react';
 import type { BttsStats } from '@/hooks/useBttsEntries';
 
 interface BttsStatsCardProps {
   stats: BttsStats;
 }
 
 export function BttsStatsCard({ stats }: BttsStatsCardProps) {
   const isProfit = stats.profit >= 0;
   
   return (
     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
       <Card className="bg-card/50">
         <CardContent className="p-4">
           <div className="flex items-center gap-2 text-muted-foreground mb-1">
             <BarChart3 className="h-4 w-4" />
             <span className="text-xs">Operações</span>
           </div>
           <p className="text-2xl font-bold">{stats.total}</p>
         </CardContent>
       </Card>
       
       <Card className="bg-card/50">
         <CardContent className="p-4">
           <div className="flex items-center gap-2 text-muted-foreground mb-1">
             <Target className="h-4 w-4" />
             <span className="text-xs">Win Rate</span>
           </div>
           <p className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</p>
           <p className="text-xs text-muted-foreground">
             {stats.greens}G / {stats.reds}R
           </p>
         </CardContent>
       </Card>
       
       <Card className={`${isProfit ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
         <CardContent className="p-4">
           <div className="flex items-center gap-2 text-muted-foreground mb-1">
             {isProfit ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
             <span className="text-xs">Lucro</span>
           </div>
           <p className={`text-2xl font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
             {isProfit ? '+' : ''}R$ {stats.profit.toFixed(2)}
           </p>
         </CardContent>
       </Card>
       
       <Card className="bg-card/50">
         <CardContent className="p-4">
           <div className="flex items-center gap-2 text-muted-foreground mb-1">
             <Percent className="h-4 w-4" />
             <span className="text-xs">ROI</span>
           </div>
           <p className={`text-2xl font-bold ${stats.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
             {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
           </p>
         </CardContent>
       </Card>
       
       <Card className="bg-card/50">
         <CardContent className="p-4">
           <div className="flex items-center gap-2 text-muted-foreground mb-1">
             <Calculator className="h-4 w-4" />
             <span className="text-xs">Odd Média</span>
           </div>
           <p className="text-2xl font-bold">{stats.avgOdd.toFixed(2)}</p>
         </CardContent>
       </Card>
       
       <Card className="bg-card/50">
         <CardContent className="p-4">
           <div className="flex items-center gap-2 text-muted-foreground mb-1">
             <Target className="h-4 w-4" />
             <span className="text-xs">Breakeven</span>
           </div>
           <p className="text-2xl font-bold">
             {stats.avgOdd > 0 ? (100 / stats.avgOdd).toFixed(1) : 0}%
           </p>
         </CardContent>
       </Card>
     </div>
   );
 }