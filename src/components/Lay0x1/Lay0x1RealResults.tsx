import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLay0x1Analyses, Lay0x1Analysis } from '@/hooks/useLay0x1Analyses';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Target, Edit2, Check, X, Trash2, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Lay0x1RealResults = () => {
    const { analyses, loading, updateOdd, deleteAnalysis } = useLay0x1Analyses();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editOdd, setEditOdd] = useState<string>('');
    const [filterPeriod, setFilterPeriod] = useState<'all' | 'month' | 'week'>('month');

    // Real operations are those with an ODD registered
    const operations = useMemo(() =>
        analyses.filter(a => a.odd_used !== null && a.odd_used !== undefined),
        [analyses]
    );

    const filteredOperations = useMemo(() => {
        const now = new Date();
        return operations.filter(op => {
            const opDate = parseISO(op.date);
            if (filterPeriod === 'month') {
                return isWithinInterval(opDate, { start: startOfMonth(now), end: endOfMonth(now) });
            }
            // Add weekly filter if needed
            return true;
        });
    }, [operations, filterPeriod]);

    const stats = useMemo(() => {
        const resolved = operations.filter(o => o.result !== null && o.result !== undefined);
        const totalProfit = resolved.reduce((sum, o) => sum + (o.profit || 0), 0);
        const greens = resolved.filter(o => o.result === 'Green').length;
        const reds = resolved.filter(o => o.result === 'Red').length;
        const totalLiability = resolved.length * 1000;
        const roi = totalLiability > 0 ? (totalProfit / totalLiability) * 100 : 0;

        return { totalProfit, greens, reds, roi, totalResolved: resolved.length };
    }, [operations]);

    const equityData = useMemo(() => {
        let currentEquity = 0;
        return operations
            .filter(o => o.result)
            .slice()
            .reverse()
            .map((op, i) => {
                currentEquity += (op.profit || 0);
                return {
                    name: format(parseISO(op.date), 'dd/MM'),
                    equity: currentEquity
                };
            });
    }, [operations]);

    const handleStartEdit = (op: Lay0x1Analysis) => {
        setEditingId(op.id);
        setEditOdd(op.odd_used?.toString() || '');
    };

    const handleSaveOdd = async (id: string) => {
        const val = parseFloat(editOdd);
        if (isNaN(val) || val <= 1) return;
        await updateOdd(id, val);
        setEditingId(null);
    };

    return (
        <div className="space-y-6">
            {/* Financial Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-emerald-500/10 border-emerald-500/20">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <DollarSign className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-semibold">Lucro Total</p>
                            <p className={`text-xl font-bold ${stats.totalProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                R$ {stats.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-blue-500/10 border-blue-500/20">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-semibold">ROI Geral</p>
                            <p className="text-xl font-bold text-blue-500">{stats.roi.toFixed(2)}%</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                            <Check className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-semibold">Greens / Reds</p>
                            <p className="text-xl font-bold">
                                <span className="text-emerald-500">{stats.greens}</span>
                                <span className="mx-1 text-muted-foreground">/</span>
                                <span className="text-red-500">{stats.reds}</span>
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                            <Filter className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground uppercase font-semibold">Período</p>
                            <select
                                className="bg-transparent text-sm font-bold focus:outline-none w-full"
                                value={filterPeriod}
                                onChange={(e) => setFilterPeriod(e.target.value as any)}
                            >
                                <option value="month">Este Mês</option>
                                <option value="all">Todo Histórico</option>
                            </select>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Equity Curve */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Curva de Lucro Acumulado (Real)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="h-[250px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={equityData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(val) => `R$ ${val}`} />
                                <RechartsTooltip
                                    formatter={(val: number) => [`R$ ${val.toFixed(2)}`, 'Equity']}
                                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="equity"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Operations Table */}
            <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Operações Manuais</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs text-center">Data</TableHead>
                                <TableHead className="text-xs">Jogo</TableHead>
                                <TableHead className="text-xs text-right">Odd</TableHead>
                                <TableHead className="text-xs text-right">Stake</TableHead>
                                <TableHead className="text-xs text-center">Res.</TableHead>
                                <TableHead className="text-xs text-center">Status</TableHead>
                                <TableHead className="text-xs text-right">Lucro/Prej.</TableHead>
                                <TableHead className="text-xs text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {operations.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        Nenhuma operação registrada ainda.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                operations.map((op) => (
                                    <TableRow key={op.id}>
                                        <TableCell className="text-xs text-center font-mono">
                                            {format(parseISO(op.date), 'dd/MM/yy')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold">{op.home_team} vs {op.away_team}</span>
                                                <span className="text-[10px] text-muted-foreground">{op.league}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {editingId === op.id ? (
                                                <Input
                                                    className="h-7 w-16 text-right text-xs"
                                                    value={editOdd}
                                                    onChange={(e) => setEditOdd(e.target.value)}
                                                    onBlur={() => handleSaveOdd(op.id)}
                                                    autoFocus
                                                />
                                            ) : (
                                                <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-primary transition-colors"
                                                    onClick={() => handleStartEdit(op)}>
                                                    <span className="text-xs font-mono">{op.odd_used.toFixed(2)}</span>
                                                    <Edit2 className="w-3 h-3 opacity-50" />
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs">
                                            R$ {op.stake?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                        </TableCell>
                                        <TableCell className="text-center text-xs font-bold">
                                            {op.final_score_home !== null ? `${op.final_score_home}-${op.final_score_away}` : '—'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={`text-[10px] h-5 ${op.result === 'Green' ? 'bg-emerald-500/20 text-emerald-400' :
                                                op.result === 'Red' ? 'bg-red-500/20 text-red-500' :
                                                    'bg-yellow-500/20 text-yellow-500'
                                                }`}>
                                                {op.result === 'Green' ? 'GREEN' : op.result === 'Red' ? 'RED' : 'PENDENTE'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`text-right font-bold text-xs ${(op.profit || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
                                            }`}>
                                            {op.profit !== null ? `R$ ${op.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteAnalysis(op.id)}>
                                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};
