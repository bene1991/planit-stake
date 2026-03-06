import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ScatterChart, Scatter, ZAxis, AreaChart, Area, ReferenceArea, ReferenceLine, ReferenceDot, Cell
} from 'recharts';
import { Loader2 } from "lucide-react";
import GoalHazardChart from './components/GoalHazardChart';

// Tooltip customizado para o gráfico de probabilidade acumulada
const CustomProbabilityTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-[#1e2333] border border-[#2a3142] p-3 rounded-md shadow-lg">
                <p className="text-white font-medium text-sm mb-1">{`Tempo: ${data.minutesAfter} min após o alerta`}</p>
                <p className="text-[#f59e0b] text-sm font-semibold">{`Probabilidade: ${data.probability}%`}</p>
                <p className="text-gray-400 text-xs mt-1">{`Jogos com gol até agora: ${data.accumulatedCount}`}</p>
            </div>
        );
    }
    return null;
};

// Tooltip customizado para os gráficos de barra
const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-[#1e2333] border border-[#2a3142] p-3 rounded-md shadow-lg">
                <p className="text-white font-medium text-sm mb-1">{label}</p>
                <p className="text-white text-sm font-semibold">
                    {`Ocorrências: `} <span className="text-[#3b82f6]">{data.gols ?? data.total ?? data.winRate ?? 0}{data.winRate !== undefined ? '%' : ''}</span>
                </p>
                {data.percentage !== undefined && (
                    <p className="text-gray-400 text-xs mt-1">
                        {`Frequência: ${data.percentage}% da base`}
                    </p>
                )}
            </div>
        );
    }
    return null;
};

const getHeatmapColor = (value: number, max: number) => {
    if (value === 0 || max === 0) return '#2a3142'; // Vazios
    const ratio = value / max;
    if (ratio >= 0.75) return '#ef4444'; // Hot (Vermelho)
    if (ratio >= 0.50) return '#f97316'; // Laranja
    if (ratio >= 0.25) return '#eab308'; // Amarelo
    return '#22c55e'; // Frio (Verde)
};

// Tooltip customizado para o gráfico de Variação
const CustomVariationTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-[#1e2333] border border-[#2a3142] p-3 rounded-md shadow-lg">
                <p className="text-white font-medium text-sm mb-2">{data.fullName}</p>
                <div className="flex flex-col gap-1 text-sm">
                    <p className="text-gray-300">Total de Alertas: <span className="font-bold text-white">{data.total}</span></p>
                    <p className="text-emerald-400">Greens: <span className="font-bold">{data.greens}</span></p>
                    <p className="text-red-400">Reds: <span className="font-bold">{data.reds}</span></p>
                    <p className="text-blue-400 mt-1">Taxa de Acerto: <span className="font-bold">{data.winRate}%</span></p>
                </div>
            </div>
        );
    }
    return null;
};

// Tooltip customizado para o gráfico de Ligas
const CustomLeagueTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-[#1e2333] border border-[#2a3142] p-3 rounded-md shadow-lg min-w-[200px]">
                <p className="text-white font-medium text-sm mb-2 pb-2 border-b border-[#2a3142] flex justify-between">
                    <span>{data.fullName}</span>
                    <span className="text-gray-400 ml-4 font-normal">Amostra: {data.total}</span>
                </p>
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <p className="text-xs text-gray-400 font-medium">Mercado HT</p>
                            <span className="text-sm font-bold text-[#3b82f6]">{data.htWinRate}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-xs text-emerald-400">Greens: {data.htGreens}</span>
                            <span className="text-xs text-rose-400">Reds: {data.total - data.htGreens}</span>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <p className="text-xs text-gray-400 font-medium">Mercado Over 1.5</p>
                            <span className="text-sm font-bold text-[#14b8a6]">{data.over15WinRate}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-xs text-emerald-400">Greens: {data.over15Greens}</span>
                            <span className="text-xs text-rose-400">Reds: {data.total - data.over15Greens}</span>
                        </div>
                    </div>
                    <div className="pt-2 border-t border-[#2a3142]">
                        <div className="flex justify-between">
                            <span className="text-xs text-gray-300">Teve pelo menos 1 Gol:</span>
                            <span className="text-xs font-bold text-[#f59e0b]">{data.anyGoalRate}%</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export default function RoboReports() {
    const [selectedLeague, setSelectedLeague] = useState<string>("all");
    const [selectedVariation, setSelectedVariation] = useState<string>("all");
    const [dateFilter, setDateFilter] = useState<string>("all");

    // Fetch all historic alerts and active variations
    const { data, isLoading } = useQuery({
        queryKey: ['robo-reports-data'],
        queryFn: async () => {
            const [alertsRes, variationsRes] = await Promise.all([
                supabase.from('live_alerts').select('*'),
                supabase.from('robot_variations').select('name').eq('active', true)
            ]);

            if (alertsRes.error) throw alertsRes.error;
            if (variationsRes.error) throw variationsRes.error;

            return {
                alerts: alertsRes.data,
                activeVariations: variationsRes.data.map(v => v.name)
            };
        }
    });

    const validRawAlerts = useMemo(() => {
        if (!data) return [];
        const { alerts, activeVariations } = data;

        let filtered = alerts.filter(a => a.is_discarded !== true && activeVariations.includes(a.variation_name));

        if (selectedLeague !== "all") {
            filtered = filtered.filter(a => a.league_name === selectedLeague);
        }

        if (selectedVariation !== "all") {
            filtered = filtered.filter(a => a.variation_name === selectedVariation);
        }

        if (dateFilter === "today") {
            const today = new Date().toISOString().split('T')[0];
            filtered = filtered.filter(a => a.created_at?.startsWith(today));
        } else if (dateFilter === "this_week") {
            const date = new Date();
            date.setDate(date.getDate() - 7);
            filtered = filtered.filter(a => new Date(a.created_at!) >= date);
        } else if (dateFilter === "this_month") {
            const date = new Date();
            date.setMonth(date.getMonth() - 1);
            filtered = filtered.filter(a => new Date(a.created_at!) >= date);
        }

        return filtered;
    }, [data, selectedLeague, selectedVariation, dateFilter]);

    // Unique leagues and variations for filters
    const leagues = useMemo(() => [...new Set(data?.alerts?.filter(a => !a.is_discarded).map(a => a.league_name).filter(Boolean))], [data?.alerts]);
    const variations = useMemo(() => [...new Set(data?.alerts?.filter(a => !a.is_discarded && data.activeVariations.includes(a.variation_name)).map(a => a.variation_name).filter(Boolean))], [data]);

    // Deduplicate fixtures: keep only the alert with the lowest minute_at_alert for each fixture
    const processedFixtures = useMemo(() => {
        const fixtureMap = new Map();

        validRawAlerts.forEach(alert => {
            const alertMinute = alert.minute_at_alert || 0;
            const existing = fixtureMap.get(alert.fixture_id);
            if (!existing || alertMinute < existing.minute_at_alert) {
                fixtureMap.set(alert.fixture_id, alert);
            }
        });

        const deduplicated = Array.from(fixtureMap.values());

        return deduplicated.map(alert => {
            const alertMinute = alert.minute_at_alert || 0;
            const allGoalEvents: any[] = typeof alert.goal_events === 'string' ? JSON.parse(alert.goal_events) : (alert.goal_events || []);

            // Only consider goals strictly after the alert
            const validGoals = allGoalEvents.filter(e => e.minute > alertMinute).sort((a, b) => a.minute - b.minute);

            const firstGoal = validGoals[0] || null;
            const secondGoal = validGoals[1] || null;

            const timeToFirstGoal = firstGoal ? (firstGoal.minute - alertMinute) : null;
            const timeToSecondGoal = secondGoal ? (secondGoal.minute - alertMinute) : null;

            // Definition of Green/HT Green per the request
            const htGreen = alert.goal_ht_result === 'green' || (firstGoal && firstGoal.minute <= 45);
            const over15Green = alert.over15_result === 'green' || allGoalEvents.length >= 2;

            return {
                ...alert,
                allGoalEvents,
                validGoals,
                firstGoalMinute: firstGoal?.minute,
                secondGoalMinute: secondGoal?.minute,
                timeToFirstGoal,
                timeToSecondGoal,
                htGreen,
                over15Green
            };
        });
    }, [validRawAlerts]);

    // Data Processing for Charts

    // 1. Distribuição de gols por período (Unique goals of deduplicated fixtures)
    const goalPeriodsData = useMemo(() => {
        const periods = { "0-15": 0, "16-30": 0, "31-45": 0, "46-60": 0, "61-75": 0, "76-90+": 0 };
        processedFixtures.forEach(fix => {
            fix.allGoalEvents.forEach(e => {
                if (e.minute <= 15) periods["0-15"]++;
                else if (e.minute <= 30) periods["16-30"]++;
                else if (e.minute <= 45) periods["31-45"]++;
                else if (e.minute <= 60) periods["46-60"]++;
                else if (e.minute <= 75) periods["61-75"]++;
                else periods["76-90+"]++;
            });
        });
        return Object.entries(periods).map(([name, gols]) => ({ name, gols }));
    }, [processedFixtures]);

    // 2. Tempo até o 1o gol após o alerta
    const timeToFirstGoalData = useMemo(() => {
        const total = processedFixtures.length;
        const bins = { "0-5 m": 0, "6-10 m": 0, "11-15 m": 0, "16-20 m": 0, "21-25 m": 0, "26-30 m": 0, "31-40 m": 0, "41-50 m": 0, "51+ m": 0 };
        processedFixtures.forEach(fix => {
            if (fix.timeToFirstGoal !== null) {
                const diff = fix.timeToFirstGoal;
                if (diff <= 5) bins["0-5 m"]++;
                else if (diff <= 10) bins["6-10 m"]++;
                else if (diff <= 15) bins["11-15 m"]++;
                else if (diff <= 20) bins["16-20 m"]++;
                else if (diff <= 25) bins["21-25 m"]++;
                else if (diff <= 30) bins["26-30 m"]++;
                else if (diff <= 40) bins["31-40 m"]++;
                else if (diff <= 50) bins["41-50 m"]++;
                else bins["51+ m"]++;
            }
        });
        return Object.entries(bins).map(([name, gols]) => ({
            name,
            gols,
            percentage: total > 0 ? Math.round((gols / total) * 100) : 0
        }));
    }, [processedFixtures]);

    // 3. Tempo até o 2o gol após o alerta
    const timeToSecondGoalData = useMemo(() => {
        const total = processedFixtures.length;
        const bins = { "0-10 m": 0, "11-20 m": 0, "21-30 m": 0, "31-40 m": 0, "41-50 m": 0, "51-60 m": 0, "60+ m": 0 };
        processedFixtures.forEach(fix => {
            if (fix.timeToSecondGoal !== null) {
                const diff = fix.timeToSecondGoal;
                if (diff <= 10) bins["0-10 m"]++;
                else if (diff <= 20) bins["11-20 m"]++;
                else if (diff <= 30) bins["21-30 m"]++;
                else if (diff <= 40) bins["31-40 m"]++;
                else if (diff <= 50) bins["41-50 m"]++;
                else if (diff <= 60) bins["51-60 m"]++;
                else bins["60+ m"]++;
            }
        });
        return Object.entries(bins).map(([name, gols]) => ({
            name,
            gols,
            percentage: total > 0 ? Math.round((gols / total) * 100) : 0
        }));
    }, [processedFixtures]);

    // 4. Performance por Variação (ESTA É A EXCEÇÃO: Usa validRawAlerts)
    const variationPerformanceData = useMemo(() => {
        const stats: Record<string, { total: number, greens: number, reds: number }> = {};
        validRawAlerts.forEach(a => {
            const varName = a.variation_name || 'Desconhecida';
            if (!stats[varName]) stats[varName] = { total: 0, greens: 0, reds: 0 };

            const alertMinute = a.minute_at_alert || 0;
            const rawEvents: any[] = typeof a.goal_events === 'string' ? JSON.parse(a.goal_events) : (a.goal_events || []);
            const validGoals = rawEvents.filter(e => e.minute > alertMinute);

            const isGreen = a.goal_ht_result === 'green' || a.over15_result === 'green' || validGoals.length > 0;

            stats[varName].total++;
            if (isGreen) {
                stats[varName].greens++;
            } else {
                stats[varName].reds++;
            }
        });

        return Object.entries(stats)
            .filter(([_, data]) => data.total >= 3)
            .map(([name, data]) => ({
                name: name.length > 18 ? name.substring(0, 16) + '...' : name,
                fullName: name,
                total: data.total,
                greens: data.greens,
                reds: data.reds,
                winRate: Math.round((data.greens / data.total) * 100)
            })).sort((a, b) => b.winRate - a.winRate);
    }, [validRawAlerts]);

    // 5. Performance por Liga (Baseado em Fixtures)
    const leaguePerformanceData = useMemo(() => {
        const stats: Record<string, { total: number, htGreens: number, over15Greens: number, anyGoalGreens: number }> = {};
        processedFixtures.forEach(fix => {
            const lName = fix.league_name || 'Desconhecida';
            if (!stats[lName]) stats[lName] = { total: 0, htGreens: 0, over15Greens: 0, anyGoalGreens: 0 };

            stats[lName].total++;
            if (fix.htGreen) stats[lName].htGreens++;
            if (fix.over15Green) stats[lName].over15Greens++;
            if (fix.timeToFirstGoal !== null) stats[lName].anyGoalGreens++; // Ou seja, existiu gol DEPOIS do alerta
        });

        return Object.entries(stats)
            .filter(([_, data]) => data.total >= 3)
            .map(([name, data]) => ({
                name: `${name.length > 18 ? name.substring(0, 16) + '...' : name} (${data.total})`,
                fullName: name,
                total: data.total,
                htGreens: data.htGreens,
                over15Greens: data.over15Greens,
                anyGoalGreens: data.anyGoalGreens,
                htWinRate: Math.round((data.htGreens / data.total) * 100),
                over15WinRate: Math.round((data.over15Greens / data.total) * 100),
                anyGoalRate: Math.round((data.anyGoalGreens / data.total) * 100),
            }))
            .sort((a, b) => {
                // Ordenar por Amostra descendente, depois Win Rate HT
                if (b.total !== a.total) {
                    return b.total - a.total;
                }
                return b.htWinRate - a.htWinRate;
            })
            .slice(0, 20);
    }, [processedFixtures]);

    // 6. Curva Acumulada de Probabilidade (1o Gol) com percentis e zonas quentes
    const cumulativeChartData = useMemo(() => {
        const totalFixtures = processedFixtures.length;
        if (totalFixtures === 0) return { data: [], hotZone: null, percentiles: { p25: null, p50: null, p75: null } as { p25: number | null, p50: number | null, p75: number | null } };

        let maxMinutes = 0;
        processedFixtures.forEach(fix => {
            if (fix.timeToFirstGoal !== null && fix.timeToFirstGoal > maxMinutes) {
                maxMinutes = fix.timeToFirstGoal;
            }
        });

        const cappedMax = Math.min(maxMinutes, 80); // Extende até os acréscimos se houver

        const data = [];
        const percentiles = { p25: null as number | null, p50: null as number | null, p75: null as number | null };

        for (let minute = 0; minute <= cappedMax; minute += 1) { // 1 min resolution
            const countForThisBin = processedFixtures.filter(f => f.timeToFirstGoal !== null && f.timeToFirstGoal <= minute).length;
            const prob = totalFixtures > 0 ? (countForThisBin / totalFixtures) * 100 : 0;
            const roundedProb = parseFloat(prob.toFixed(1));

            data.push({
                minutesAfter: minute,
                probability: roundedProb,
                accumulatedCount: countForThisBin
            });

            if (percentiles.p25 === null && roundedProb >= 25) percentiles.p25 = minute;
            if (percentiles.p50 === null && roundedProb >= 50) percentiles.p50 = minute;
            if (percentiles.p75 === null && roundedProb >= 75) percentiles.p75 = minute;
        }

        // Find Hot Zone (15 minute window with the highest increase in probability)
        let maxDelta = 0;
        let hotZoneStart = 0;
        let hotZoneEnd = 0;
        const windowSize = 15;

        for (let i = 0; i <= data.length - windowSize; i++) {
            if (i + windowSize - 1 >= data.length) break;
            const startProb = data[i].probability;
            const endProb = data[i + windowSize - 1].probability;
            const delta = endProb - startProb;
            if (delta > maxDelta) {
                maxDelta = delta;
                hotZoneStart = data[i].minutesAfter;
                hotZoneEnd = data[i + windowSize - 1].minutesAfter;
            }
        }

        return {
            data,
            hotZone: maxDelta > 0 ? { start: hotZoneStart, end: hotZoneEnd, delta: maxDelta } : null,
            percentiles
        };
    }, [processedFixtures]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-4" />
                <p className="text-gray-400">Carregando relatório...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:w-auto">
                    <Select value={selectedLeague} onValueChange={setSelectedLeague}>
                        <SelectTrigger className="w-[200px] bg-[#2a3142] border-[#2a3142]">
                            <SelectValue placeholder="Todas as Ligas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as Ligas</SelectItem>
                            {leagues.map(l => l && <SelectItem key={l} value={l}>{l.length > 20 ? l.substring(0, 20) + '...' : l}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={selectedVariation} onValueChange={setSelectedVariation}>
                        <SelectTrigger className="w-[200px] bg-[#2a3142] border-[#2a3142]">
                            <SelectValue placeholder="Todas as Variações" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as Variações</SelectItem>
                            {variations.map(v => v && <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-full xl:w-[200px] bg-[#2a3142] border-[#2a3142]">
                            <SelectValue placeholder="Período" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Desde o Início</SelectItem>
                            <SelectItem value="today">Hoje</SelectItem>
                            <SelectItem value="this_week">Últimos 7 dias</SelectItem>
                            <SelectItem value="this_month">Últimos 30 dias</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="text-sm w-full xl:w-auto text-gray-400 bg-[#2a3142] px-4 py-2 rounded-md font-medium border border-[#3b4256] text-center xl:text-left shadow-sm">
                    Total de Jogos Únicos: <span className="text-white ml-2 text-base">{processedFixtures.length}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. Curva Acumulada de Probabilidade */}
                <Card className="bg-[#1e2333] border-[#2a3142] md:col-span-2 lg:col-span-3">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base sm:text-lg">Curva Acumulada de Probabilidade (1º Gol após alerta)</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Acompanhe a zona de maior aceleração (onde o gráfico sobe mais rápido) para identificar o momento ideal de entrada no mercado. <br />
                            <span className="font-semibold text-gray-500 mt-1 inline-block">Base de dados: {processedFixtures.length} jogos únicos analisados</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] sm:h-[380px] p-2 sm:p-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cumulativeChartData.data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorProb" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.7} />
                                        <stop offset="50%" stopColor="#eab308" stopOpacity={0.7} />
                                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.7} />
                                    </linearGradient>
                                    <linearGradient id="colorProbFill" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                                        <stop offset="50%" stopColor="#eab308" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" opacity={0.5} vertical={false} />
                                <XAxis dataKey="minutesAfter" stroke="#8b949e" tick={{ fontSize: 10 }} unit="'" />
                                <YAxis stroke="#8b949e" domain={[0, 100]} tickFormatter={(val) => `${val}%`} tick={{ fontSize: 10 }} />
                                <Tooltip content={<CustomProbabilityTooltip />} />

                                {cumulativeChartData.hotZone && (
                                    <ReferenceArea
                                        x1={cumulativeChartData.hotZone.start}
                                        x2={cumulativeChartData.hotZone.end}
                                        fill="#f59e0b"
                                        fillOpacity={0.15}
                                        label={{ value: '🔥 Zona Quente', position: 'insideTop', fill: '#f59e0b', fontSize: 13, fontWeight: 'bold' }}
                                    />
                                )}

                                <ReferenceLine x={0} stroke="#9ca3af" strokeDasharray="3 3" label={{ position: 'top', value: 'Alerta', fill: '#9ca3af', fontSize: 12 }} />

                                {cumulativeChartData.percentiles.p25 !== null && (
                                    <ReferenceDot x={cumulativeChartData.percentiles.p25} y={25} r={5} fill="#22c55e" stroke="none" />
                                )}
                                {cumulativeChartData.percentiles.p50 !== null && (
                                    <ReferenceDot x={cumulativeChartData.percentiles.p50} y={50} r={5} fill="#eab308" stroke="none" />
                                )}
                                {cumulativeChartData.percentiles.p75 !== null && (
                                    <ReferenceDot x={cumulativeChartData.percentiles.p75} y={75} r={5} fill="#ef4444" stroke="none" />
                                )}

                                <Area type="monotone" dataKey="probability" stroke="url(#colorProb)" strokeWidth={4} fill="url(#colorProbFill)" activeDot={{ r: 6, fill: '#fff', stroke: '#ef4444', strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="text-[10px] sm:text-xs text-gray-400 text-center mt-3 mx-auto w-full md:w-3/4">
                            <span className="font-semibold text-gray-300">Como ler?</span> O gráfico demonstra a chance acumulada de ocorrer o primeiro gol do jogo <b>após</b> o alerta. A <b>Zona Quente</b> destaca o período de 15 minutos onde a chance cresce mais rápido.
                        </div>
                    </CardContent>
                </Card>

                {/* Hazard Rate de Gol */}
                <GoalHazardChart processedFixtures={processedFixtures} />

                {/* 2. Gols por Período */}
                <Card className="bg-[#1e2333] border-[#2a3142]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base sm:text-lg">Gols por Período (Todos os Gols)</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Distribuição dos minutos no placar <br />
                            <span className="font-semibold text-gray-500 inline-block mt-1">Base: {processedFixtures.length} jogos únicos</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px] sm:h-[300px] p-2 sm:p-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={goalPeriodsData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" vertical={false} />
                                <XAxis dataKey="name" stroke="#8b949e" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                                <YAxis stroke="#8b949e" tick={{ fontSize: 10 }} />
                                <Tooltip content={<CustomBarTooltip />} />
                                <Bar dataKey="gols" radius={[4, 4, 0, 0]} name="Gols">
                                    {
                                        goalPeriodsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getHeatmapColor(entry.gols, Math.max(...goalPeriodsData.map(d => d.gols)))} />
                                        ))
                                    }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 3. Tempo até o 1o gol */}
                <Card className="bg-[#1e2333] border-[#2a3142]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base sm:text-lg">Tempo até 1º Gol</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Minutos passados do alerta até o gol <br />
                            <span className="font-semibold text-gray-500 mt-1 inline-block">Base: {processedFixtures.length} jogos únicos</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px] sm:h-[300px] p-2 sm:p-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timeToFirstGoalData} margin={{ top: 20, right: 10, left: -20, bottom: 15 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" vertical={false} />
                                <XAxis dataKey="name" stroke="#8b949e" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={40} />
                                <YAxis stroke="#8b949e" tick={{ fontSize: 10 }} />
                                <Tooltip content={<CustomBarTooltip />} />
                                <Bar dataKey="gols" radius={[4, 4, 0, 0]} name="Jogos">
                                    {
                                        timeToFirstGoalData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getHeatmapColor(entry.gols, Math.max(...timeToFirstGoalData.map(d => d.gols)))} />
                                        ))
                                    }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 4. Tempo até o 2o gol */}
                <Card className="bg-[#1e2333] border-[#2a3142]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base sm:text-lg">Tempo até 2º Gol</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Minutos passados do alerta até o 2º gol <br />
                            <span className="font-semibold text-gray-500 mt-1 inline-block">Base: {processedFixtures.length} jogos únicos</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px] sm:h-[300px] p-2 sm:p-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timeToSecondGoalData} margin={{ top: 20, right: 10, left: -20, bottom: 15 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" vertical={false} />
                                <XAxis dataKey="name" stroke="#8b949e" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={40} />
                                <YAxis stroke="#8b949e" tick={{ fontSize: 10 }} />
                                <Tooltip content={<CustomBarTooltip />} />
                                <Bar dataKey="gols" radius={[4, 4, 0, 0]} name="Jogos">
                                    {
                                        timeToSecondGoalData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getHeatmapColor(entry.gols, Math.max(...timeToSecondGoalData.map(d => d.gols)))} />
                                        ))
                                    }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 5. Performance por Variação */}
                <Card className="bg-[#1e2333] border-[#2a3142]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base sm:text-lg">Performance por Variação</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Taxa de acerto (Green) por variação <br />
                            <span className="font-semibold text-gray-500 mt-1 inline-block">Base: {validRawAlerts.length} alertas</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px] sm:h-[300px] p-2 sm:p-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={variationPerformanceData} margin={{ top: 20, right: 10, left: -25, bottom: 45 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" opacity={0.4} vertical={false} />
                                <XAxis dataKey="name" stroke="#8b949e" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 8 }} interval={0} />
                                <YAxis stroke="#8b949e" domain={[0, 100]} tickFormatter={(val) => `${val}%`} tick={{ fontSize: 10 }} />
                                <Tooltip content={<CustomVariationTooltip />} />
                                <Bar dataKey="winRate" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Win Rate" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 6. Performance por Liga (Deduplicada) */}
                <Card className="bg-[#1e2333] border-[#2a3142] md:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base sm:text-lg">Top Ligas (Min. 3 jogos)</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Win Rate filtrado por jogo único <br />
                            <span className="font-semibold text-gray-500 mt-1 inline-block">Base: {processedFixtures.length} jogos únicos</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[320px] sm:h-[300px] p-2 sm:p-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={leaguePerformanceData} margin={{ top: 10, right: 10, left: -25, bottom: 45 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" opacity={0.4} vertical={false} />
                                <XAxis dataKey="name" stroke="#8b949e" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 8 }} interval={0} />
                                <YAxis stroke="#8b949e" domain={[0, 100]} tickFormatter={(val) => `${val}%`} tick={{ fontSize: 10 }} />
                                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />
                                <Tooltip content={<CustomLeagueTooltip />} cursor={{ fill: '#2a3142', opacity: 0.4 }} />
                                <Bar dataKey="htWinRate" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Win Rate HT" />
                                <Bar dataKey="over15WinRate" fill="#14b8a6" radius={[2, 2, 0, 0]} name="Win Rate Over 1.5" />
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="text-[10px] sm:text-xs text-gray-400 text-center mt-3 mx-auto w-full md:w-3/4">
                            Gráfico mapeia desempenho consolidado por campeonato, isolando <b>partidas únicas</b>. Ligas c/ menos de 3 jogos não são exibidas.
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
