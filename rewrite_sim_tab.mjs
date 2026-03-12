import fs from 'fs';

let content = fs.readFileSync('src/pages/robo/RoboSimulationTab.tsx', 'utf8');

// 1. Remove GoalHazardChart import
content = content.replace(/import GoalHazardChart from '\.\/components\/GoalHazardChart';\n/, '');

// 2. Remove charts from recharts
content = content.replace(/AreaChart, Area, ReferenceArea, ReferenceLine, ReferenceDot, Cell\n} from 'recharts';/, "} from 'recharts';");

// 3. Remove Tooltips
content = content.replace(/\/\/ Tooltip customizado para o gráfico de probabilidade acumulada[\s\S]*?(?=export default function RoboSimulationTab)/, '');

// 4. Remove chart data computations
const toRemove = [
    'cumulativeChartData',
    'goalPeriodsData',
    'timeToFirstGoalData',
    'timeToSecondGoalData',
    'variationPerformanceData',
    'leaguePerformanceData'
];

for (const name of toRemove) {
    const regex = new RegExp(`    \\/\\/ [0-9]+\\. (?:Gols por Período|Curva Acumulada|Tempo até|Performance por).*?\\n    const ${name} = useMemo[\\s\\S]*?\\n    }, \\[[^\\]]+\\]\\);\\n\\n`, 'g');
    content = content.replace(regex, '');
}

// 5. Replace the return UI
const returnRegex = /    return \([\s\S]*?(?=                <div className="text-sm text-gray-400)/;
const replacementUI = `    return (
        <div className="space-y-6">
            <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-[#1e2333]/50 p-4 rounded-lg border border-[#2a3142]">
                <div className="flex flex-col md:flex-row gap-4 flex-1">
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
                                        \`\${selectedVariations.length} Variações selecionadas\`}
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
`;

content = content.replace(returnRegex, replacementUI);

// Remove the end of the old Tabs block and the TabsContent simulation block
// Looking from <TabsContent value="charts" ... until <TabsContent value="simulation"
const chartsTabContentRegex = /            <TabsContent value="charts"[^>]*>[\s\S]*?<\/TabsContent>\n\n            <TabsContent value="simulation" className="space-y-6 mt-0">/;
content = content.replace(chartsTabContentRegex, '            <div className="space-y-6 mt-0">');

// Finally replace the closing tags of Tabs
content = content.replace(/            <\/TabsContent>\n        <\/Tabs>\n    \);\n}/, '            </div>\n        </div>\n    );\n}');

fs.writeFileSync('src/pages/robo/RoboSimulationTab.tsx', content);

