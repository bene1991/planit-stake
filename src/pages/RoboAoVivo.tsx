import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyPlus, ShieldX, BellRing, BarChart3, ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import RoboVariations from './robo/RoboVariations';
import RoboBlockedLeagues from './robo/RoboBlockedLeagues';
import RoboAlerts from './robo/RoboAlerts';
import RoboPerformance from './robo/RoboPerformance';
import RoboLogs from './robo/RoboLogs';
import RoboReports from './robo/RoboReports';

export default function RoboAoVivo() {
    const [activeTab, setActiveTab] = useState("reports");

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Robô Ao Vivo</h2>
                    <p className="text-muted-foreground">Sistema de detecção nativa de pressão ofensiva e alertas automáticos.</p>
                </div>
            </div>

            <Tabs defaultValue="reports" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <div className="overflow-x-auto pb-1 max-w-full">
                    <TabsList className="bg-[#1e2333] w-max">
                        <TabsTrigger value="alerts" className="data-[state=active]:bg-[#2a3142]"><BellRing className="w-4 h-4 mr-2" /> Alertas</TabsTrigger>
                        <TabsTrigger value="performance" className="data-[state=active]:bg-[#2a3142]"><BarChart3 className="w-4 h-4 mr-2" /> Performance</TabsTrigger>
                        <TabsTrigger value="reports" className="data-[state=active]:bg-[#2a3142]"><BarChart3 className="w-4 h-4 mr-2" /> Relatório</TabsTrigger>
                        <TabsTrigger value="variations" className="data-[state=active]:bg-[#2a3142]"><CopyPlus className="w-4 h-4 mr-2" /> Variações</TabsTrigger>
                        <TabsTrigger value="leagues" className="data-[state=active]:bg-[#2a3142]"><ShieldX className="w-4 h-4 mr-2" /> Ligas Bloqueadas</TabsTrigger>
                        <TabsTrigger value="logs" className="data-[state=active]:bg-[#2a3142]"><ListFilter className="w-4 h-4 mr-2" /> Logs da Edge</TabsTrigger>
                    </TabsList>
                </div>

                <Card className="border-[#2a3142] bg-[#1a1f2d]">
                    <CardContent className="p-3 sm:p-6">
                        <TabsContent value="alerts" className="mt-0 border-0 outline-none">
                            <RoboAlerts />
                        </TabsContent>

                        <TabsContent value="performance" className="mt-0 border-0 outline-none">
                            <RoboPerformance />
                        </TabsContent>

                        <TabsContent value="reports" className="mt-0 border-0 outline-none">
                            <RoboReports />
                        </TabsContent>

                        <TabsContent value="variations" className="mt-0 border-0 outline-none">
                            <RoboVariations />
                        </TabsContent>

                        <TabsContent value="leagues" className="mt-0 border-0 outline-none">
                            <RoboBlockedLeagues />
                        </TabsContent>

                        <TabsContent value="logs" className="mt-0 border-0 outline-none">
                            <RoboLogs />
                        </TabsContent>
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    );
}
