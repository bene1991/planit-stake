import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface ProfitDonutChartsProps {
  profitDays: number;
  lossDays: number;
  totalDays: number;
  avgDailyProfit: number;
  avgOperationProfit: number;
  totalOperations: number;
  maxProfit: number;
  maxLoss: number;
  totalProfit: number;
}

export function ProfitDonutCharts({
  profitDays,
  lossDays,
  totalDays,
  avgDailyProfit,
  avgOperationProfit,
  totalOperations,
  maxProfit,
  maxLoss,
  totalProfit,
}: ProfitDonutChartsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Days donut data
  const daysData = [
    { name: "Dias Positivos", value: profitDays, color: "#10b981" },
    { name: "Dias Negativos", value: lossDays, color: "#ef4444" },
    { name: "Dias Neutros", value: Math.max(0, totalDays - profitDays - lossDays), color: "#6b7280" },
  ].filter(d => d.value > 0);

  // Profit distribution (max profit as percentage of total positive)
  const profitPercentage = totalProfit > 0 ? (maxProfit / totalProfit) * 100 : 0;
  const profitDonutData = [
    { name: "Maior Lucro", value: profitPercentage, color: "#10b981" },
    { name: "Outros Lucros", value: 100 - profitPercentage, color: "#065f46" },
  ];

  // Loss distribution
  const lossPercentage = maxLoss > 0 ? (maxLoss / (maxLoss + (totalProfit < 0 ? Math.abs(totalProfit) : 0))) * 100 : 0;
  const lossDonutData = [
    { name: "Maior Prejuízo", value: Math.min(100, lossPercentage), color: "#ef4444" },
    { name: "Outros Prejuízos", value: Math.max(0, 100 - lossPercentage), color: "#7f1d1d" },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-card p-2 shadow-lg">
          <p className="text-sm font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">{payload[0].value.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Maior Lucro Donut */}
      <Card className="p-4 bg-card border border-border/30">
        <h4 className="text-sm font-semibold text-center mb-2 text-emerald-500">
          Maior Lucro
        </h4>
        <div className="h-32 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={profitDonutData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={50}
                dataKey="value"
                strokeWidth={0}
              >
                {profitDonutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-emerald-500">
              {profitPercentage.toFixed(0)}%
            </span>
          </div>
        </div>
        <p className="text-center text-sm font-medium mt-2">
          {formatCurrency(maxProfit)}
        </p>
        <p className="text-center text-xs text-muted-foreground">
          do lucro total
        </p>
      </Card>

      {/* Summary Stats */}
      <Card className="p-4 bg-card border border-border/30">
        <h4 className="text-sm font-semibold text-center mb-4">Resumo</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Dias</span>
            <span className="font-semibold">{totalDays}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Operações</span>
            <span className="font-semibold">{totalOperations}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Média/Dia</span>
            <span className={`font-semibold ${avgDailyProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {formatCurrency(avgDailyProfit)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Média/Op</span>
            <span className={`font-semibold ${avgOperationProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {formatCurrency(avgOperationProfit)}
            </span>
          </div>
        </div>
      </Card>

      {/* Maior Prejuízo Donut */}
      <Card className="p-4 bg-card border border-border/30">
        <h4 className="text-sm font-semibold text-center mb-2 text-red-500">
          Maior Prejuízo
        </h4>
        <div className="h-32 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={lossDonutData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={50}
                dataKey="value"
                strokeWidth={0}
              >
                {lossDonutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-red-500">
              {lossPercentage.toFixed(0)}%
            </span>
          </div>
        </div>
        <p className="text-center text-sm font-medium mt-2 text-red-500">
          -{formatCurrency(maxLoss)}
        </p>
        <p className="text-center text-xs text-muted-foreground">
          do prejuízo total
        </p>
      </Card>
    </div>
  );
}
