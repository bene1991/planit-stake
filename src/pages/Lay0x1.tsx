import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lay0x1Scanner } from '@/components/Lay0x1/Lay0x1Scanner';
import { Lay0x1Dashboard } from '@/components/Lay0x1/Lay0x1Dashboard';
import { Lay0x1Evolution } from '@/components/Lay0x1/Lay0x1Evolution';
import { Lay0x1History } from '@/components/Lay0x1/Lay0x1History';
import { Lay0x1RealResults } from '@/components/Lay0x1/Lay0x1RealResults';
import { Target, BarChart3, Settings2, History, DollarSign } from 'lucide-react';

const Lay0x1 = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" />
          IA Lay 0x1
        </h1>
        <p className="text-sm text-muted-foreground">
          Scanner inteligente com modelo evolutivo adaptativo
        </p>
      </div>

      <Tabs defaultValue="scanner" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="scanner" className="gap-1.5 text-xs sm:text-sm">
            <Target className="w-4 h-4" /> Scanner
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-1.5 text-xs sm:text-sm">
            <DollarSign className="w-4 h-4" /> Resultados
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5 text-xs sm:text-sm">
            <Settings2 className="w-4 h-4" /> Config
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
            <History className="w-4 h-4" /> Histórico IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scanner">
          <Lay0x1Scanner />
        </TabsContent>

        <TabsContent value="dashboard">
          <Lay0x1Dashboard />
        </TabsContent>

        <TabsContent value="results">
          <Lay0x1RealResults />
        </TabsContent>

        <TabsContent value="config">
          <Lay0x1Evolution />
        </TabsContent>

        <TabsContent value="history">
          <Lay0x1History />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Lay0x1;
