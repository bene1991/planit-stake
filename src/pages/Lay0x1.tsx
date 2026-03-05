import { Lay0x1Scanner } from '@/components/Lay0x1/Lay0x1Scanner';
import { Lay0x1Dashboard } from '@/components/Lay0x1/Lay0x1Dashboard';
import { Target, BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

const Lay0x1 = () => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" />
          IA Lay 0x1
        </h1>
        <p className="text-sm text-muted-foreground">
          Scanner de jogos com casa ofensiva e visitante vulnerável
        </p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_400px] gap-6 items-start">
        {/* Left Column - Scanner */}
        <div className="w-full space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Scanner de Oportunidades
              </CardTitle>
            </CardHeader>
            <Lay0x1Scanner />
          </Card>
        </div>

        {/* Right Column - Dashboard & Config */}
        <div className="w-full sticky top-4">
          <Card className="border-border">
            <CardHeader className="pb-2 bg-muted/20 border-b p-4">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Visão Geral (Dashboard)
                </CardTitle>
              </div>
            </CardHeader>
            <div className="p-4 overflow-y-auto max-h-[80vh] custom-scrollbar">
              <Lay0x1Dashboard />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Lay0x1;
