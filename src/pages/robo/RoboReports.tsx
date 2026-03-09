import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, ReferenceArea, ReferenceLine, ReferenceDot, Cell
} from 'recharts';
import { Loader2, Plus, Trash2, RotateCcw, TrendingUp, Info, BarChart3, List, Zap, Save, FileSpreadsheet, Check, ChevronDown, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO } from 'date-fns';
import GoalHazardChart from './components/GoalHazardChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStrategySimulations, StrategySimulation } from "@/hooks/useStrategySimulations";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

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
    const [selectedVariations, setSelectedVariations] = useState<string[]>(() => {
        const saved = localStorage.getItem('robo_reports_selected_variations');
        return saved ? JSON.parse(saved) : [];
    });
    const [dateFilter, setDateFilter] = useState<string>("all");

    // Simulation states
    const [entryMin, setEntryMin] = useState<number>(30);
    const [exitMin, setExitMin] = useState<number>(70);
    const [greenStake, setGreenStake] = useState<number>(1.0);
    const [redStake, setRedStake] = useState<number>(2.0);
    const [simName, setSimName] = useState<string>("");

    const { simulations, saveSimulation, deleteSimulation } = useStrategySimulations();

    useEffect(() => {
        localStorage.setItem('robo_reports_selected_variations', JSON.stringify(selectedVariations));
    }, [selectedVariations]);

    // Fetch all historic alerts, active variations and game statuses
    const { data, isLoading } = useQuery({
        queryKey: ['robo-reports-data'],
        queryFn: async () => {
            const [alertsRes, variationsRes, gamesRes] = await Promise.all([
                supabase.from('live_alerts').select('*'),
                supabase.from('robot_variations').select('name').eq('active', true),
                supabase.from('games').select('api_fixture_id, status')
            ]);

            if (alertsRes.error) throw alertsRes.error;
            if (variationsRes.error) throw variationsRes.error;
            if (gamesRes.error) throw gamesRes.error;

            const gamesMap = new Map(gamesRes.data?.map(g => [String(g.api_fixture_id), g.status]) || []);

            return {
                alerts: alertsRes.data,
                activeVariations: variationsRes.data.map(v => v.name),
                gamesMap
            };
        }
    });

    const validRawAlerts = useMemo(() => {
        if (!data) return [];
        const { alerts, activeVariations } = data;

        // Filtramos por variações ativas, mas incluímos variações que tiveram alertas históricos 
        // mesmo que não estejam mais no array de 'activeVariations' se o modo for "all"
        let filtered = alerts;

        // Se quisermos apenas variações que POSSUEM alertas
        // filtered = alerts.filter(a => activeVariations.includes(a.variation_name));

        if (selectedLeague !== "all") {
            filtered = filtered.filter(a => a.league_name === selectedLeague);
        }

        if (selectedVariations.length > 0) {
            filtered = filtered.filter(a => {
                if (!a.variation_name) return false;
                // Se o nome no banco é "Estratégia A, Estratégia B", 
                // e o usuário selecionou "Estratégia A", este alerta deve ser incluído.
                const alertVars = a.variation_name.split(',').map((v: string) => v.trim());
                return alertVars.some((v: string) => selectedVariations.includes(v));
            });
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
    }, [data, selectedLeague, selectedVariations, dateFilter]);

    // Unique leagues and variations for filters
    const leagues = useMemo(() => [...new Set(data?.alerts?.map(a => a.league_name).filter(Boolean))], [data?.alerts]);
    const variations = useMemo(() => {
        if (!data) return [];
        const fromAlerts: string[] = [];
        data.alerts?.forEach(a => {
            if (a.variation_name) {
                // Se o nome contiver vírgula (ex: "Var A, Var B"), separamos
                if (a.variation_name.includes(',')) {
                    a.variation_name.split(',').forEach((v: string) => fromAlerts.push(v.trim()));
                } else {
                    fromAlerts.push(a.variation_name);
                }
            }
        });
        const fromActive = data.activeVariations || [];
        return [...new Set([...fromAlerts, ...fromActive])].sort((a, b) => a.localeCompare(b));
    }, [data]);

    // Deduplicate fixtures: keep only the alert with the lowest minute_at_alert for each fixture
    // 1. Deduplicação por JOGO (para análise de distribuição de gols e hazard rate)
    // Se um jogo teve 3 alertas, ele conta como 1 jogo para saber quando sai o primeiro gol no geral.
    const processedFixtures = useMemo(() => {
        const fixtureMap = new Map();

        validRawAlerts.forEach(alert => {
            const alertMinute = alert.minute_at_alert || 0;
            const existing = fixtureMap.get(alert.fixture_id);
            if (!existing || alertMinute < existing.minute_at_alert) {
                fixtureMap.set(alert.fixture_id, alert);
            }
        });

        return Array.from(fixtureMap.values()).map(alert => {
            const allGoalEvents: any[] = typeof alert.goal_events === 'string' ? JSON.parse(alert.goal_events) : (alert.goal_events || []);
            const fixtureStatus = data?.gamesMap.get(String(alert.fixture_id));
            const alertMinute = alert.minute_at_alert || 0;

            const validGoals = allGoalEvents.filter(e => (e.minute + (e.extra || 0)) > alertMinute);
            const firstGoal = validGoals.sort((a, b) => (a.minute + (a.extra || 0)) - (b.minute + (b.extra || 0)))[0] || null;
            const timeToFirstGoal = firstGoal ? ((firstGoal.minute + (firstGoal.extra || 0)) - alertMinute) : null;

            return { ...alert, allGoalEvents, fixtureStatus, timeToFirstGoal };
        });
    }, [validRawAlerts, data?.gamesMap]);

    // 2. Deduplicação por VARIAÇÃO + JOGO (para Backtest/Simulação Real)
    // Se a Variação A deu 2 alertas no jogo 1, a simulação deve considerar apenas a primeira entrada.
    // Mas se a Variação B também deu alerta no jogo 1, ela deve ter sua própria entrada na simulação.
    const simulationBase = useMemo(() => {
        const varFixtureMap = new Map();

        validRawAlerts.forEach(alert => {
            const key = `${alert.variation_name}-${alert.fixture_id}`;
            const alertMinute = alert.minute_at_alert || 0;
            const existing = varFixtureMap.get(key);

            if (!existing || alertMinute < existing.minute_at_alert) {
                varFixtureMap.set(key, alert);
            }
        });

        return Array.from(varFixtureMap.values()).map(alert => {
            const allGoalEvents: any[] = typeof alert.goal_events === 'string' ? JSON.parse(alert.goal_events) : (alert.goal_events || []);
            const fixtureStatus = data?.gamesMap.get(String(alert.fixture_id));
            const alertMinute = alert.minute_at_alert || 0;

            const validGoals = allGoalEvents.filter(e => {
                const realMin = e.minute + (e.extra || 0);
                return realMin > alertMinute;
            }).sort((a, b) => (a.minute + (a.extra || 0)) - (b.minute + (b.extra || 0)));

            const firstGoal = validGoals[0] || null;
            const secondGoal = validGoals[1] || null;

            return {
                ...alert,
                allGoalEvents,
                validGoals,
                fixtureStatus,
                firstGoalMinute: firstGoal ? (firstGoal.minute + (firstGoal.extra || 0)) : undefined,
                secondGoalMinute: secondGoal ? (secondGoal.minute + (secondGoal.extra || 0)) : undefined,
                timeToFirstGoal: firstGoal ? ((firstGoal.minute + (firstGoal.extra || 0)) - alertMinute) : null,
                timeToSecondGoal: secondGoal ? ((secondGoal.minute + (secondGoal.extra || 0)) - alertMinute) : null,
                htGreen: alert.goal_ht_result === 'green' || (firstGoal && (firstGoal.minute + (firstGoal.extra || 0)) <= 45),
                over15Green: alert.over15_result === 'green' || allGoalEvents.length >= 2
            };
        });
    }, [validRawAlerts, data?.gamesMap]);

    // Lógica da Simulação de Estratégia
    const simulationResult = useMemo(() => {
        if (!simulationBase.length) return null;

        const datasetSize = simulationBase.length;
        // Jogos que atingiram o exit_minute ou são FT/Finished
        const analyzableGames = simulationBase.filter(f => {
            const finishedStatuses = ['Finished', 'FT', 'AET', 'PEN'];
            const isFinishedInMap = finishedStatuses.includes(f.fixtureStatus);

            // Fallback: se não estiver no gamesMap, mas tiver final_score no alerta
            // Ou se o jogo for "antigo" (assumimos que acabou após o tempo de saída escolhido)
            const hasFinalScore = f.final_score && f.final_score !== 'pending' && f.final_score !== null;

            // Se o jogo é antigo o suficiente (> 4 horas), assumimos que está encerrado
            const isOld = f.created_at ? (new Date().getTime() - new Date(f.created_at).getTime() > 4 * 60 * 60 * 1000) : false;

            return isFinishedInMap || hasFinalScore || isOld;
        });

        const actuallyAnalyzed = analyzableGames.length;
        let greens = 0;
        let reds = 0;
        let totalGoalsInWindow = 0;
        let cumulativeStakes = 0;
        const equityCurveData: any[] = [];

        analyzableGames.forEach((game, index) => {
            const goalsInWindow = game.allGoalEvents.filter((g: any) => {
                const realMin = g.minute + (g.extra || 0);
                return realMin >= entryMin && realMin <= exitMin;
            });

            totalGoalsInWindow += goalsInWindow.length;

            if (goalsInWindow.length > 0) {
                greens++;
                cumulativeStakes += greenStake;
            } else {
                reds++;
                cumulativeStakes -= redStake;
            }

            equityCurveData.push({
                index: index + 1,
                profit: parseFloat(cumulativeStakes.toFixed(2)),
                game: `${game.home_team} vs ${game.away_team}`
            });
        });

        const winRate = actuallyAnalyzed > 0 ? (greens / actuallyAnalyzed) * 100 : 0;
        const totalStakes = parseFloat(cumulativeStakes.toFixed(2));
        // Investimento total: cada jogo "custa" redStake se perdermos ou greenStake se ganharmos? 
        // Na verdade, o ROI em apostas geralmente é baseado na stake de entrada. Assumimos stake 1 por jogo para simplificar.
        const roi = actuallyAnalyzed > 0 ? (totalStakes / actuallyAnalyzed) * 100 : 0;
        const avgProfit = actuallyAnalyzed > 0 ? (totalStakes / actuallyAnalyzed) : 0;

        return {
            datasetSize,
            actuallyAnalyzed,
            greens,
            reds,
            totalGoalsInWindow,
            winRate: Math.round(winRate * 10) / 10,
            totalStakes: parseFloat(cumulativeStakes.toFixed(2)),
            roi: parseFloat(roi.toFixed(1)),
            avgProfit: parseFloat(avgProfit.toFixed(3)),
            equityCurveData,
            analyzedGames: analyzableGames.map(game => {
                const goalsInWindow = game.allGoalEvents.filter((g: any) => {
                    const realMin = g.minute + (g.extra || 0);
                    return realMin >= entryMin && realMin <= exitMin;
                });
                return {
                    fixture_id: game.fixture_id,
                    date: game.created_at,
                    home_team: game.home_team,
                    away_team: game.away_team,
                    league: game.league_name,
                    variation: game.variation_name,
                    minute_at_alert: game.minute_at_alert,
                    result: goalsInWindow.length > 0 ? 'green' : 'red',
                    goals: goalsInWindow.map((g: any) => `${g.minute}${g.extra ? '+' + g.extra : ''}'`).join(', '),
                    final_score: game.final_score || 'N/A'
                };
            })
        };
    }, [processedFixtures, entryMin, exitMin, greenStake, redStake]);

    // Cálculo da performance por variação dentro da simulação
    const simulationByVariation = useMemo(() => {
        if (!simulationResult) return [];

        const stats: Record<string, { total: number, greens: number, reds: number, profit: number }> = {};

        simulationResult.analyzedGames.forEach(game => {
            const varNames = game.variation ? game.variation.split(',').map((v: string) => v.trim()) : ['Desconhecida'];

            varNames.forEach((name: string) => {
                // Se o usuário selecionou variações específicas, só contamos as selecionadas
                if (selectedVariations.length > 0 && !selectedVariations.includes(name)) return;

                if (!stats[name]) stats[name] = { total: 0, greens: 0, reds: 0, profit: 0 };

                stats[name].total++;
                if (game.result === 'green') {
                    stats[name].greens++;
                    stats[name].profit += greenStake;
                } else {
                    stats[name].reds++;
                    stats[name].profit -= redStake;
                }
            });
        });

        return Object.entries(stats)
            .map(([name, data]) => ({
                name: name.length > 15 ? name.substring(0, 13) + '...' : name,
                fullName: name,
                total: data.total,
                greens: data.greens,
                reds: data.reds,
                profit: parseFloat(data.profit.toFixed(2)),
                winRate: Math.round((data.greens / data.total) * 100),
                roi: parseFloat(((data.profit / data.total) * 100).toFixed(1))
            }))
            .sort((a, b) => b.profit - a.profit);
    }, [simulationResult, greenStake, redStake, selectedVariations]);

    const handleSaveSim = () => {
        if (!simName) {
            toast.error("Dê um nome para a simulação");
            return;
        }

        if (!simulationResult) return;

        saveSimulation.mutate({
            name: simName,
            entry_minute: entryMin,
            exit_minute: exitMin,
            green_stake: greenStake,
            red_stake: redStake,
            dataset_size: simulationResult.datasetSize,
            games_analyzed: simulationResult.actuallyAnalyzed,
            greens: simulationResult.greens,
            reds: simulationResult.reds,
            goals_in_window: simulationResult.totalGoalsInWindow,
            win_rate: simulationResult.winRate,
            total_stakes: simulationResult.totalStakes,
            avg_profit: simulationResult.avgProfit,
            roi: simulationResult.roi,
            filters_snapshot: {
                league: selectedLeague,
                variation: selectedVariations.join(','),
                date: dateFilter
            },
            simulation_version: 'v2'
        });
        setSimName("");
    };

    const handleRecalculate = (sim: StrategySimulation) => {
        setEntryMin(sim.entry_minute);
        setExitMin(sim.exit_minute);
        setGreenStake(sim.green_stake || 1.0);
        setRedStake(sim.red_stake || 1.5);
        // Os filtros precisam ser aplicados manualmente pelo usuário para refletir o snapshot se desejar,
        // mas o Recalcular usa os filtros ATUAIS da tela conforme pedido.
        toast.info(`Recalculando ${sim.name} com base nos filtros atuais.`);
    };

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

    const exportToExcel = () => {
        if (!simulationResult || !simulationResult.analyzedGames.length) {
            toast.error("Nenhuma simulação para exportar");
            return;
        }

        const worksheetData = simulationResult.analyzedGames.map((game, idx) => {
            const profit = game.result === 'green' ? greenStake : -redStake;
            return {
                "Data": game.date ? format(parseISO(game.date), 'dd/MM/yy HH:mm') : '-',
                "Partida": `${game.home_team} vs ${game.away_team}`,
                "Liga": game.league,
                "Método": game.variation,
                "Min. Alerta": game.minute_at_alert,
                "Gols no Intervalo": game.goals || '-',
                "Placar Final": game.final_score,
                "Resultado": game.result.toUpperCase(),
                "Profit/Loss (Units)": profit,
                "Cumulative Profit": simulationResult.equityCurveData[idx]?.profit || 0
            };
        });

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Simulação");

        // Auto-sizing
        const maxWidths = worksheetData.reduce((acc, row: any) => {
            Object.keys(row).forEach((key, i) => {
                const val = String(row[key]);
                acc[i] = Math.max(acc[i] || 0, val.length, key.length);
            });
            return acc;
        }, [] as number[]);
        ws["!cols"] = maxWidths.map(w => ({ wch: w + 2 }));

        XLSX.writeFile(wb, `Simulacao_Estrategia_${format(new Date(), 'dd_MM_yy_HHmm')}.xlsx`);
        toast.success("Simulação exportada com sucesso!");
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-4" />
                <p className="text-gray-400">Carregando relatório...</p>
            </div>
        );
    }

    return (
        <Tabs defaultValue="charts" className="space-y-6">
            <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-[#1e2333]/50 p-4 rounded-lg border border-[#2a3142]">
                <div className="flex flex-col md:flex-row gap-4 flex-1">
                    <TabsList className="bg-[#1e2333] border border-[#2a3142]">
                        <TabsTrigger value="charts" className="data-[state=active]:bg-[#2a3142]">
                            <BarChart3 className="w-4 h-4 mr-2" /> Análise Geral
                        </TabsTrigger>
                        <TabsTrigger value="simulation" className="data-[state=active]:bg-[#2a3142]">
                            <TrendingUp className="w-4 h-4 mr-2" /> Simulação de Estratégia
                        </TabsTrigger>
                    </TabsList>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Select value={selectedLeague} onValueChange={setSelectedLeague}>
                            <SelectTrigger className="w-[180px] bg-[#2a3142] border-[#3b4256]">
                                <SelectValue placeholder="Todas as Ligas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Ligas</SelectItem>
                                {leagues.map(l => l && <SelectItem key={l} value={l}>{l.length > 20 ? l.substring(0, 20) + '...' : l}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2 px-3 py-2 bg-[#2a3142] border border-[#3b4256] rounded-md">
                            <Filter className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs text-gray-300 font-medium whitespace-nowrap">
                                {selectedVariations.length === 0 ? "Todas as Variações" :
                                    selectedVariations.length === 1 ? selectedVariations[0] :
                                        `${selectedVariations.length} Variações selecionadas`}
                            </span>
                        </div>

                        <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger className="w-[180px] bg-[#2a3142] border-[#3b4256]">
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
                </div>

                <div className="text-sm text-gray-400 bg-[#2a3142] px-4 py-2 rounded-md font-medium border border-[#3b4256] shadow-sm">
                    Jogos Únicos: <span className="text-white ml-1 text-base">{processedFixtures.length}</span>
                </div>
            </div>

            <TabsContent value="charts" className="space-y-6 mt-0">
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
            </TabsContent>

            <TabsContent value="simulation" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <Card className="bg-[#1e2333] border-[#2a3142] lg:col-span-1">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center">
                                <TrendingUp className="w-5 h-5 mr-2 text-emerald-400" /> Configuração
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Minuto de Entrada</Label>
                                    <Input
                                        type="number"
                                        value={entryMin}
                                        onChange={(e) => setEntryMin(Number(e.target.value))}
                                        className="bg-[#2a3142] border-[#3b4256]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Minuto de Saída</Label>
                                    <Input
                                        type="number"
                                        value={exitMin}
                                        onChange={(e) => setExitMin(Number(e.target.value))}
                                        className="bg-[#2a3142] border-[#3b4256]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Ganho no Green</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={greenStake}
                                        onChange={(e) => setGreenStake(Number(e.target.value))}
                                        className="bg-[#2a3142] border-[#3b4256]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Perda no Red</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={redStake}
                                        onChange={(e) => setRedStake(Number(e.target.value))}
                                        className="bg-[#2a3142] border-[#3b4256]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <Label className="text-gray-400 flex justify-between">
                                    <span>Variações para Simular</span>
                                    <Button
                                        variant="link"
                                        className="h-auto p-0 text-[10px] text-blue-400 hover:text-blue-300"
                                        onClick={() => setSelectedVariations([])}
                                    >
                                        Limpar Todos
                                    </Button>
                                </Label>
                                <div className="bg-[#2a3142] border border-[#3b4256] rounded-md p-2 space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                                    <div
                                        className="flex items-center space-x-2 p-1.5 hover:bg-white/5 rounded cursor-pointer transition-colors"
                                        onClick={() => setSelectedVariations([])}
                                    >
                                        <Checkbox checked={selectedVariations.length === 0} id="var-all" />
                                        <label htmlFor="var-all" className="text-[11px] font-medium text-white cursor-pointer">Todas as Variações</label>
                                    </div>
                                    <div className="h-px bg-[#3b4256] my-1" />
                                    {variations.map(v => (
                                        <div
                                            key={v}
                                            className="flex items-center space-x-2 p-1.5 hover:bg-white/5 rounded cursor-pointer transition-colors"
                                            onClick={() => {
                                                setSelectedVariations(prev =>
                                                    prev.includes(v) ? prev.filter(i => i !== v) : [...prev, v]
                                                );
                                            }}
                                        >
                                            <Checkbox checked={selectedVariations.includes(v)} id={`var-${v}`} />
                                            <label htmlFor={`var-${v}`} className="text-[11px] text-gray-300 cursor-pointer truncate">{v}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 border-t border-[#2a3142] space-y-4">
                                <Label className="text-gray-400">Salvar Simulação</Label>
                                <Input
                                    placeholder="Nome da simulação..."
                                    value={simName}
                                    onChange={(e) => setSimName(e.target.value)}
                                    className="bg-[#2a3142] border-[#3b4256]"
                                />
                                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveSim}>
                                    <Plus className="w-4 h-4 mr-2" /> Salvar Resultados
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                    onClick={exportToExcel}
                                >
                                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Baixar Planilha (.xlsx)
                                </Button>
                            </div>

                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                                <p className="text-[10px] text-blue-400 flex items-start">
                                    <Info className="w-3 h-3 mr-1 mt-0.5 shrink-0" />
                                    A simulação utiliza os filtros de Liga e Variação ativos no topo da tela. Jogos que não atingiram o minuto de saída são ignorados.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="lg:col-span-3 space-y-6">
                        {simulationResult && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <Card className="bg-[#1e2333] border-[#2a3142] p-4">
                                        <p className="text-xs text-gray-400 uppercase font-medium">Amostragem</p>
                                        <p className="text-2xl font-bold text-white mt-1">{simulationResult.actuallyAnalyzed}</p>
                                        <p className="text-[10px] text-gray-500 mt-1">de {simulationResult.datasetSize} jogos filtrados</p>
                                    </Card>
                                    <Card className="bg-[#1e2333] border-[#2a3142] p-4">
                                        <p className="text-xs text-gray-400 uppercase font-medium">Win Rate</p>
                                        <p className="text-2xl font-bold text-emerald-400 mt-1">{simulationResult.winRate}%</p>
                                        <p className="text-[10px] text-gray-500 mt-1">{simulationResult.greens} Greens / {simulationResult.reds} Reds</p>
                                    </Card>
                                    <Card className="bg-[#1e2333] border-[#2a3142] p-4">
                                        <p className="text-xs text-gray-400 uppercase font-medium">Lucro em Stakes</p>
                                        <p className={`text-2xl font-bold mt-1 ${simulationResult.totalStakes >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {simulationResult.totalStakes > 0 ? '+' : ''}{simulationResult.totalStakes}
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-1">ROI: {simulationResult.roi.toFixed(1)}%</p>
                                    </Card>
                                    <Card className="bg-[#1e2333] border-[#2a3142] p-4">
                                        <p className="text-xs text-gray-400 uppercase font-medium">Gols na Janela</p>
                                        <p className="text-2xl font-bold text-blue-400 mt-1">{simulationResult.totalGoalsInWindow}</p>
                                        <p className="text-[10px] text-gray-500 mt-1">total no intervalo</p>
                                    </Card>
                                </div>

                                <Card className="bg-[#1e2333] border-[#2a3142]">
                                    <CardHeader className="py-4">
                                        <CardTitle className="text-base flex items-center">
                                            <List className="w-4 h-4 mr-2 text-blue-400" /> Detalhes dos Jogos Analisados
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto max-h-[400px]">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-[#2a3142]/50 text-gray-400 text-[10px] uppercase sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-3 font-medium">Partida</th>
                                                        <th className="px-4 py-3 font-medium">Liga</th>
                                                        <th className="px-4 py-3 font-medium">Alerta</th>
                                                        <th className="px-4 py-3 font-medium">Gols ({entryMin}'-{exitMin}')</th>
                                                        <th className="px-4 py-2 font-medium text-right">Fim</th>
                                                        <th className="px-4 py-3 font-medium text-right">Resultado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#2a3142]">
                                                    {simulationResult.analyzedGames.map((game: any, idx: number) => (
                                                        <tr key={`${game.fixture_id}-${idx}`} className="hover:bg-white/5 transition-colors border-b border-[#2a3142]/50">
                                                            <td className="px-4 py-3 font-medium text-gray-200">
                                                                <div className="flex flex-col">
                                                                    <span className="truncate max-w-[150px] sm:max-w-none">{game.home_team} vs {game.away_team}</span>
                                                                    <span className="text-[9px] text-gray-500">ID: {game.fixture_id}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[100px]">{game.league}</td>
                                                            <td className="px-4 py-3 text-gray-400">{game.minute_at_alert}'</td>
                                                            <td className="px-4 py-3">
                                                                {game.goals ? (
                                                                    <span className="text-emerald-400 font-medium">{game.goals}</span>
                                                                ) : (
                                                                    <span className="text-gray-600">-</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-400 text-right text-xs">{game.final_score}</td>
                                                            <td className="px-4 py-3 text-right">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${game.result === 'green' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                                                    }`}>
                                                                    {game.result === 'green' ? `+${greenStake}` : `-${redStake}`}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        <Card className="bg-[#1e2333] border-[#2a3142]">
                            <CardHeader className="pb-0">
                                <CardTitle className="text-base font-semibold">Evolução Patrimonial (Equity Curve)</CardTitle>
                                <CardDescription className="text-xs">Saldo acumulativo de stakes ao longo da série.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px] pt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={simulationResult?.equityCurveData || []}>
                                        <defs>
                                            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" vertical={false} opacity={0.5} />
                                        <XAxis dataKey="index" hide />
                                        <YAxis stroke="#8b949e" tick={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1f2d', border: '1px solid #2a3142', color: '#fff' }}
                                            labelStyle={{ color: '#8b949e' }}
                                        />
                                        <ReferenceLine y={0} stroke="#4b5563" />
                                        <Area
                                            type="monotone"
                                            dataKey="profit"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorEquity)"
                                            animationDuration={1000}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Performance por Variação dentro da Simulação */}
                        <Card className="bg-[#1e2333] border-[#2a3142]">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center">
                                    <Zap className="w-4 h-4 mr-2 text-purple-400" /> Resultado por Variação
                                </CardTitle>
                                <CardDescription className="text-xs">Lucro líquido (stakes) acumulado por cada estratégia configurada.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={simulationByVariation} margin={{ top: 10, right: 10, left: -25, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" vertical={false} opacity={0.4} />
                                            <XAxis dataKey="name" stroke="#8b949e" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={50} />
                                            <YAxis stroke="#8b949e" tick={{ fontSize: 10 }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1a1f2d', border: '1px solid #2a3142', color: '#fff' }}
                                                formatter={(value: number) => [`${value} u`, 'Lucro']}
                                            />
                                            <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                                                {simulationByVariation.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#f43f5e'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {simulationByVariation.map((stat) => (
                                        <div key={stat.fullName} className="p-3 bg-[#2a3142]/40 rounded-lg border border-[#3b4256] flex flex-col justify-between">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-sm text-gray-200 truncate pr-2" title={stat.fullName}>{stat.fullName}</span>
                                                <Badge variant="outline" className={cn(
                                                    "text-[9px] uppercase",
                                                    stat.profit >= 0 ? "text-emerald-400 border-emerald-500/30" : "text-rose-400 border-rose-500/30"
                                                )}>
                                                    {stat.profit > 0 ? '+' : ''}{stat.profit}u
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] text-gray-500 uppercase">Amostra</span>
                                                    <span className="text-xs font-mono text-gray-300">{stat.total}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] text-gray-500 uppercase">Winrate</span>
                                                    <span className="text-xs font-mono text-gray-300">{stat.winRate}%</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] text-gray-500 uppercase">ROI</span>
                                                    <span className={cn("text-xs font-mono", stat.roi >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                                        {stat.roi}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-white font-semibold flex items-center">
                        <RotateCcw className="w-4 h-4 mr-2 text-indigo-400" /> Simulações Salvas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {simulations?.map((sim) => (
                            <Card key={sim.id} className="bg-[#1e2333] border-[#2a3142] hover:border-emerald-500/30 transition-colors">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-white">{sim.name}</p>
                                            <p className="text-[10px] text-gray-400">{new Date(sim.created_at).toLocaleDateString()} • v.{sim.simulation_version}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:bg-rose-400/10" onClick={() => deleteSimulation.mutate(sim.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-[#2a3142]">
                                        <div className="flex flex-col">
                                            <span className="text-gray-400">Janela</span>
                                            <span className="text-white font-medium">{sim.entry_minute}' → {sim.exit_minute}'</span>
                                            <span className="text-[10px] text-gray-500">Stakes: +{sim.green_stake} / -{sim.red_stake}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-400">Win Rate</span>
                                            <span className="text-emerald-400 font-bold">{sim.win_rate}%</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-400">Amostragem</span>
                                            <span className="text-white font-medium">{sim.games_analyzed} /{sim.dataset_size}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-400">ROI</span>
                                            <span className={`font-bold ${sim.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{sim.roi}%</span>
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        className="w-full bg-transparent border-[#3b4256] text-gray-300 hover:text-white"
                                        onClick={() => handleRecalculate(sim)}
                                    >
                                        <RotateCcw className="w-3 h-3 mr-2" /> Recalcular com Filtros Atuais
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                        {simulations?.length === 0 && (
                            <div className="col-span-full py-8 text-center bg-[#2a3142]/20 rounded-lg border border-dashed border-[#2a3142]">
                                <p className="text-gray-500 text-sm italic">Nenhuma simulação salva ainda.</p>
                            </div>
                        )}
                    </div>
                </div>
            </TabsContent>
        </Tabs>
    );
}
