import * as XLSX from 'xlsx';
import { Game, Method } from '@/types';
import { StatisticsFilters } from '@/components/StatisticsFilterBar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExcelExportOptions {
  games: Game[];
  methods: Method[];
  filters: StatisticsFilters;
  stats: {
    total: number;
    greens: number;
    reds: number;
    winRate: number;
    profitReais: number;
  };
}

interface OperationRow {
  Data: string;
  Hora: string;
  Liga: string;
  'Time Casa': string;
  'Time Fora': string;
  Método: string;
  Tipo: string;
  Stake: number;
  Odd: number;
  Resultado: 'GREEN' | 'RED' | 'VOID';
  Lucro: number;
}

const formatDateExcel = (dateStr: string): string => {
  const date = new Date(`${dateStr}T12:00:00`);
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
};

const getMethodName = (methodId: string, methods: Method[]): string => {
  const method = methods.find((m) => m.id === methodId);
  return method?.name || 'Desconhecido';
};

const calculateProfit = (
  result: 'Green' | 'Red' | 'Void',
  stakeValue: number,
  odd: number,
  operationType: 'Back' | 'Lay',
  existingProfit?: number,
  commissionRate: number = 0.045
): number => {
  // Use existing profit if available
  if (existingProfit !== undefined && existingProfit !== null) {
    return existingProfit;
  }

  if (result === 'Void') return 0;

  if (!stakeValue || !odd || stakeValue <= 0 || odd <= 1) {
    return 0;
  }

  if (operationType === 'Back') {
    if (result === 'Green') {
      return stakeValue * (odd - 1) * (1 - commissionRate);
    } else {
      return -stakeValue;
    }
  } else { // Lay - stakeValue = responsabilidade
    const stakeLay = stakeValue / (odd - 1);
    if (result === 'Green') {
      return +(stakeLay * (1 - commissionRate)).toFixed(2);
    } else {
      return -stakeValue;
    }
  }
};

const buildOperationsData = (
  games: Game[],
  methods: Method[],
  filters: StatisticsFilters
): OperationRow[] => {
  const rows: OperationRow[] = [];

  games.forEach((game) => {
    // Filter by date
    if (filters.dateFrom && filters.dateTo) {
      const gameDate = new Date(`${game.date}T12:00:00`);
      if (gameDate < filters.dateFrom || gameDate > filters.dateTo) {
        return;
      }
    }

    // Filter by league
    if (filters.selectedLeagues.length > 0 && !filters.selectedLeagues.includes(game.league)) {
      return;
    }

    game.methodOperations.forEach((op) => {
      // Only completed operations
      if (!op.result) return;

      // Filter by method
      if (filters.selectedMethods.length > 0 && !filters.selectedMethods.includes(op.methodId)) {
        return;
      }

      // Filter by result
      if (filters.result !== 'all' && op.result !== filters.result) {
        return;
      }

      const stakeValue = op.stakeValue || 0;
      const odd = op.odd || 0;
      const operationType = op.operationType || 'Back';
      const commissionRate = op.commissionRate || 0.045;

      const profit = calculateProfit(
        op.result,
        stakeValue,
        odd,
        operationType,
        op.profit,
        commissionRate
      );

      rows.push({
        Data: formatDateExcel(game.date),
        Hora: game.time || '--:--',
        Liga: game.league || 'Sem Liga',
        'Time Casa': game.homeTeam,
        'Time Fora': game.awayTeam,
        Método: getMethodName(op.methodId, methods),
        Tipo: operationType,
        Stake: stakeValue,
        Odd: odd,
        Resultado: op.result === 'Green' ? 'GREEN' : 'RED',
        Lucro: profit,
      });
    });
  });

  // Sort by date descending
  rows.sort((a, b) => {
    const dateA = a.Data.split('/').reverse().join('');
    const dateB = b.Data.split('/').reverse().join('');
    return dateB.localeCompare(dateA);
  });

  return rows;
};

const buildPeriodLabel = (filters: StatisticsFilters): string => {
  if (filters.period === 'all') return 'Todo período';
  if (filters.period === 'today') return 'Hoje';
  if (filters.period === '7days') return 'Últimos 7 dias';
  if (filters.period === '30days') return 'Últimos 30 dias';
  if (filters.period === 'thisMonth') return format(new Date(), 'MMMM yyyy', { locale: ptBR });
  if (filters.period === 'lastMonth') return 'Mês passado';
  if (filters.dateFrom && filters.dateTo) {
    return `${format(filters.dateFrom, 'dd/MM/yyyy', { locale: ptBR })} - ${format(filters.dateTo, 'dd/MM/yyyy', { locale: ptBR })}`;
  }
  return 'Período selecionado';
};

export function exportOperationsToExcel(options: ExcelExportOptions): void {
  const { games, methods, filters, stats } = options;

  // Build operations data
  const operations = buildOperationsData(games, methods, filters);
  const periodLabel = buildPeriodLabel(filters);

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['📊 ViniTrader - Relatório de Operações'],
    [''],
    ['Período:', periodLabel],
    ['Gerado em:', format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
    [''],
    ['RESUMO'],
    ['Total de Operações:', stats.total],
    ['Greens:', stats.greens],
    ['Reds:', stats.reds],
    ['Win Rate:', `${stats.winRate.toFixed(1)}%`],
    ['Lucro Total:', `R$ ${stats.profitReais.toFixed(2).replace('.', ',')}`],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  
  // Set column widths for summary
  summarySheet['!cols'] = [
    { wch: 25 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumo');

  // Operations sheet
  if (operations.length > 0) {
    const operationsSheet = XLSX.utils.json_to_sheet(operations);
    
    // Set column widths
    operationsSheet['!cols'] = [
      { wch: 12 }, // Data
      { wch: 8 },  // Hora
      { wch: 25 }, // Liga
      { wch: 18 }, // Time Casa
      { wch: 18 }, // Time Fora
      { wch: 18 }, // Método
      { wch: 8 },  // Tipo
      { wch: 12 }, // Stake
      { wch: 8 },  // Odd
      { wch: 10 }, // Resultado
      { wch: 14 }, // Lucro
    ];

    XLSX.utils.book_append_sheet(wb, operationsSheet, 'Operações');
  }

  // Save file
  const fileName = `relatorio_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
