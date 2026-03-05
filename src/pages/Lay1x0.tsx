import { Lay1x0Scanner } from '@/components/Lay1x0/Lay1x0Scanner';
import { Lay1x0Dashboard } from '@/components/Lay1x0/Lay1x0Dashboard';
import { Target, BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

const Lay1x0 = () => {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Target className="w-6 h-6 text-primary" />
                    Lay 1x0
                </h1>
                <p className="text-sm text-muted-foreground">
                    Scanner de jogos com visitante ofensivo e casa vulnerável
                </p>
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-[1fr_400px] gap-6 items-start">
                <div className="w-full space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Target className="w-5 h-5 text-primary" />
                                Scanner de Oportunidades
                            </CardTitle>
                        </CardHeader>
                        <Lay1x0Scanner />
                    </Card>
                </div>

                <div className="w-full sticky top-4">
                    <Card className="border-border">
                        <CardHeader className="pb-2 bg-muted/20 border-b">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-primary" />
                                Visão Geral (Dashboard)
                            </CardTitle>
                        </CardHeader>
                        <div className="p-4">
                            <Lay1x0Dashboard />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Lay1x0;
