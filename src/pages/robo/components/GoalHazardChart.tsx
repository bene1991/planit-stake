import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceDot, ReferenceLine } from 'recharts';

interface GoalHazardChartProps {
    processedFixtures: any[];
}

const CustomHazardTooltip = ({ active, payload, averageGoalTime }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const isAverageMinute = averageGoalTime && data.minute === Math.round(averageGoalTime);

        return (
            <div className="bg-[#1e2333] border border-[#2a3142] p-3 rounded-md shadow-lg">
                <p className="text-white font-medium text-sm mb-1">{`Minuto ${data.minute} (após alerta)`}</p>
                <p className="text-[#ef4444] text-sm font-bold">{`Hazard Rate: ${data.hazardRate.toFixed(2)}%`}</p>
                {isAverageMinute && (
                    <p className="text-[#0ea5e9] text-xs font-semibold mt-1 mb-1 border-b border-[#2a3142] pb-1">
                        📍 Tempo médio até o 1º gol
                    </p>
                )}
                <div className="text-gray-400 text-xs mt-2 space-y-1">
                    <p>{`Gols neste minuto: ${data.goalsAtMinute}`}</p>
                    <p>{`Jogos em risco: ${data.atRisk}`}</p>
                </div>
            </div>
        );
    }
    return null;
};

export default function GoalHazardChart({ processedFixtures }: GoalHazardChartProps) {
    const { chartData, peakMinute, idealZone, averageHazard, averageGoalTime } = useMemo(() => {
        const totalFixtures = processedFixtures.length;
        if (totalFixtures === 0) return { chartData: [], peakMinute: null, idealZone: null, averageHazard: 0, averageGoalTime: null };

        // Encontrar o limite de tempo considerando o máximo que levou para sair um primeiro gol
        let maxMinutes = 0;
        let sumGoalTimes = 0;
        let countGoals = 0;

        processedFixtures.forEach(fix => {
            if (fix.timeToFirstGoal !== null) {
                if (fix.timeToFirstGoal > maxMinutes) {
                    maxMinutes = fix.timeToFirstGoal;
                }
                sumGoalTimes += fix.timeToFirstGoal;
                countGoals++;
            }
        });

        const averageGoalTime = countGoals > 0 ? (sumGoalTimes / countGoals) : null;

        // Limita a até 60 minutos na frente ou até o max registrado
        const cappedMax = Math.min(Math.max(maxMinutes, 45), 60);

        const rawHazard = [];
        let totalHazardSum = 0;
        let validMinutesCount = 0;

        // Loop minuto a minuto para calcular o Risco Instantâneo (Hazard Rate)
        for (let minute = 1; minute <= cappedMax; minute++) {
            // "Em risco" são os jogos que AINDA não tiveram gols ANTES deste exato minuto
            // ou seja, se o timeToFirstGoal é null (nunca teve gol) ou >= minute.
            const atRisk = processedFixtures.filter(f => f.timeToFirstGoal === null || f.timeToFirstGoal >= minute).length;

            // Jogos que tiveram seu PRIMEIRO gol exato neste minuto
            const goalsAtMinute = processedFixtures.filter(f => f.timeToFirstGoal === minute).length;

            let hazardRate = 0;
            if (atRisk > 0) {
                hazardRate = (goalsAtMinute / atRisk) * 100;
            }

            rawHazard.push({
                minute,
                atRisk,
                goalsAtMinute,
                hazardRate
            });

            if (atRisk >= 10) { // Considera para a média apenas quando há volume razoável para evitar ruído extremo no fim do jogo
                totalHazardSum += hazardRate;
                validMinutesCount++;
            }
        }

        const averageHazard = validMinutesCount > 0 ? (totalHazardSum / validMinutesCount) : 0;

        // Aplicar Suavização (Média Móvel de 3 minutos) para diminuir ruído visual das pontas
        const smoothedData = [];
        let peakVal = 0;
        let peakMin = null;

        for (let i = 0; i < rawHazard.length; i++) {
            let prev = i > 0 ? rawHazard[i - 1].hazardRate : rawHazard[i].hazardRate;
            let curr = rawHazard[i].hazardRate;
            let next = i < rawHazard.length - 1 ? rawHazard[i + 1].hazardRate : rawHazard[i].hazardRate;

            const smoothedValue = (prev + curr + next) / 3;

            // Identificar o pico de Hazard
            if (smoothedValue > peakVal && rawHazard[i].atRisk >= 5) {
                peakVal = smoothedValue;
                peakMin = rawHazard[i].minute;
            }

            smoothedData.push({
                ...rawHazard[i],
                smoothedHazard: smoothedValue,
            });
        }

        // Identificar a Zona Ideal de Entrada (janela contínua onde Hazard > Average e atRisk relevante)
        let idealZoneStart = null;
        let idealZoneEnd = null;

        for (let i = 0; i < smoothedData.length; i++) {
            const data = smoothedData[i];
            if (data.smoothedHazard > averageHazard * 1.2 && data.atRisk >= 5) { // 20% acima da média para garantir relevância
                if (idealZoneStart === null) idealZoneStart = data.minute;
                idealZoneEnd = data.minute;
            }
            // Se cair da zona ou acabar a array, consolidamos se for largo o suficiente
            if (idealZoneStart !== null && data.smoothedHazard <= averageHazard * 1.2 && (idealZoneEnd! - idealZoneStart >= 3)) {
                break; // Encontrou o bloco principal
            }
            if (idealZoneStart !== null && data.smoothedHazard <= averageHazard * 1.2 && (idealZoneEnd! - idealZoneStart < 3)) {
                idealZoneStart = null; // Muito curto, descarta
            }
        }

        // Se checamos tudo e ficou aberto pro final
        if (idealZoneStart !== null && idealZoneEnd !== null && (idealZoneEnd - idealZoneStart < 3)) {
            idealZoneStart = null;
            idealZoneEnd = null;
        }

        return {
            chartData: smoothedData.map(d => ({ ...d, hazardRate: d.smoothedHazard })), // Subprimeira smooth visual
            peakMinute: peakMin !== null ? { minute: peakMin, value: peakVal } : null,
            idealZone: idealZoneStart !== null ? { start: idealZoneStart, end: idealZoneEnd } : null,
            averageHazard,
            averageGoalTime
        };

    }, [processedFixtures]);

    if (chartData.length === 0) return null;

    return (
        <Card className="bg-[#1e2333] border-[#2a3142] md:col-span-2 lg:col-span-3 mt-6">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2">
                <div>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                        Hazard Rate de Gol <span className="text-xs font-normal bg-[#ef4444]/20 text-[#ef4444] px-2 py-0.5 rounded ml-2">Avançado</span>
                    </CardTitle>
                    <CardDescription className="text-gray-400 mt-1 max-w-[800px]">
                        O <b>Hazard Rate</b> mostra o risco de ocorrer o primeiro gol do jogo no exato minuto selecionado após o alerta, dentre os jogos que continuaram até ali sem gol.
                        A <b>Linha Média</b> azul contrasta esse pico matemático reportando o tempo prático em que os gols costumam ser materializados caso o evento saia.
                    </CardDescription>
                </div>
                <div className="text-[10px] sm:text-xs flex flex-col items-start sm:items-end gap-1 font-semibold text-gray-500 mt-3 sm:mt-0 whitespace-nowrap">
                    <span className="bg-[#2a3142] px-3 py-1.5 rounded-md border border-[#3b4256]">Base analisada: {processedFixtures.length} partidas</span>
                    {averageGoalTime && (
                        <span className="text-[#0ea5e9]">Tempo médio até gol: {Math.round(averageGoalTime)} minutos</span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[380px] p-2 sm:p-6 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorHazardLine" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                                <stop offset="40%" stopColor="#eab308" stopOpacity={1} />
                                <stop offset="80%" stopColor="#ef4444" stopOpacity={1} />
                            </linearGradient>
                            <linearGradient id="colorHazardFill" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} />
                                <stop offset="40%" stopColor="#eab308" stopOpacity={0.15} />
                                <stop offset="80%" stopColor="#ef4444" stopOpacity={0.3} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" opacity={0.4} vertical={false} />
                        <XAxis
                            dataKey="minute"
                            stroke="#8b949e"
                            tick={{ fontSize: 10 }}
                            unit="'"
                        />
                        <YAxis
                            stroke="#8b949e"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(val) => `${val}%`}
                        />
                        <Tooltip content={<CustomHazardTooltip averageGoalTime={averageGoalTime} />} />

                        {averageGoalTime && (
                            <ReferenceLine
                                x={Math.round(averageGoalTime)}
                                stroke="#0ea5e9"
                                strokeDasharray="4 4"
                                strokeWidth={2}
                                label={{
                                    value: `Média (${Math.round(averageGoalTime)}m)`,
                                    position: 'insideTopRight',
                                    fill: '#0ea5e9',
                                    fontSize: 10,
                                    fontWeight: 'bold',
                                    offset: 10
                                }}
                            />
                        )}

                        {idealZone && (
                            <ReferenceArea
                                x1={idealZone.start}
                                x2={idealZone.end}
                                fill="#ef4444"
                                fillOpacity={0.1}
                                label={{ value: '🎯 Zona Quente', position: 'insideTop', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }}
                            />
                        )}

                        {peakMinute && (
                            <ReferenceDot
                                x={peakMinute.minute}
                                y={peakMinute.value}
                                r={5}
                                fill="#ef4444"
                                stroke="#fff"
                                strokeWidth={2}
                                label={{ value: 'Pico', position: 'top', fill: '#fff', fontSize: 10, offset: 8 }}
                            />
                        )}

                        <Area
                            type="monotone"
                            dataKey="hazardRate"
                            stroke="url(#colorHazardLine)"
                            strokeWidth={3}
                            fill="url(#colorHazardFill)"
                            activeDot={{ r: 7, fill: '#fff', stroke: '#ef4444', strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
