import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Game, Method } from '@/types';
import { StatisticsFilters } from '@/components/StatisticsFilterBar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PDFExportOptions {
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
  date: string;
  time: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  methodName: string;
  operationType: string;
  stake: string;
  odd: string;
  result: 'Green' | 'Red' | 'Void';
  profit: number;
}

const formatCurrencyPDF = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDatePDF = (dateStr: string): string => {
  const date = new Date(`${dateStr}T12:00:00`);
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
};

const getMethodName = (methodId: string, methods: Method[]): string => {
  const method = methods.find((m) => m.id === methodId);
  return method?.name || 'Desconhecido';
};

const calculateProfitForPDF = (
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

const buildOperationsData = (games: Game[], methods: Method[], filters: StatisticsFilters): OperationRow[] => {
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

      const profit = calculateProfitForPDF(
        op.result,
        stakeValue,
        odd,
        operationType,
        op.profit,
        commissionRate
      );

      rows.push({
        date: formatDatePDF(game.date),
        time: game.time || '--:--',
        league: game.league || 'Sem Liga',
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        methodName: getMethodName(op.methodId, methods),
        operationType: operationType,
        stake: stakeValue ? formatCurrencyPDF(stakeValue) : '-',
        odd: odd?.toFixed(2) || '-',
        result: op.result,
        profit: profit,
      });
    });
  });

  // Sort by date descending
  rows.sort((a, b) => {
    const dateA = a.date.split('/').reverse().join('');
    const dateB = b.date.split('/').reverse().join('');
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

const buildFilterLabel = (filters: StatisticsFilters, methods: Method[]): string => {
  const parts: string[] = [];

  if (filters.selectedMethods.length > 0) {
    const methodNames = filters.selectedMethods
      .map((id) => methods.find((m) => m.id === id)?.name || id)
      .join(', ');
    parts.push(`Método: ${methodNames}`);
  }

  if (filters.selectedLeagues.length > 0) {
    const leagueNames = filters.selectedLeagues.slice(0, 3).join(', ');
    const suffix = filters.selectedLeagues.length > 3 ? ` +${filters.selectedLeagues.length - 3}` : '';
    parts.push(`Liga: ${leagueNames}${suffix}`);
  }

  if (filters.result !== 'all') {
    parts.push(`Resultado: ${filters.result}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'Todos os dados';
};

export function exportOperationsToPDF(options: PDFExportOptions): void {
  const { games, methods, filters, stats } = options;

  // Build data
  const operations = buildOperationsData(games, methods, filters);
  const periodLabel = buildPeriodLabel(filters);
  const filterLabel = buildFilterLabel(filters, methods);

  // Create document (A4 landscape)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Colors
  const primaryColor: [number, number, number] = [139, 92, 246]; // Purple
  const greenColor: [number, number, number] = [34, 197, 94];
  const redColor: [number, number, number] = [239, 68, 68];
  const grayColor: [number, number, number] = [107, 114, 128];

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('📊 ViniTrader - Relatório de Operações', margin, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${periodLabel}`, margin, 20);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - margin, 20, { align: 'right' });

  // Filter info
  doc.setTextColor(...grayColor);
  doc.setFontSize(9);
  doc.text(filterLabel, margin, 35);

  // Summary Cards
  const summaryY = 42;
  const cardWidth = (pageWidth - margin * 2 - 15) / 5;
  const cardHeight = 18;

  const summaryData = [
    { label: 'Total', value: stats.total.toString(), color: grayColor },
    { label: 'Greens', value: stats.greens.toString(), color: greenColor },
    { label: 'Reds', value: stats.reds.toString(), color: redColor },
    { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? greenColor : redColor },
    { label: 'Lucro', value: formatCurrencyPDF(stats.profitReais), color: stats.profitReais >= 0 ? greenColor : redColor },
  ];

  summaryData.forEach((card, index) => {
    const x = margin + index * (cardWidth + 3);

    // Card background
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(x, summaryY, cardWidth, cardHeight, 2, 2, 'F');

    // Label
    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(card.label, x + cardWidth / 2, summaryY + 5, { align: 'center' });

    // Value
    doc.setTextColor(...card.color);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, x + cardWidth / 2, summaryY + 13, { align: 'center' });
  });

  // Table
  const tableStartY = summaryY + cardHeight + 8;

  if (operations.length === 0) {
    doc.setTextColor(...grayColor);
    doc.setFontSize(12);
    doc.text('Nenhuma operação encontrada para os filtros selecionados.', pageWidth / 2, tableStartY + 20, { align: 'center' });
  } else {
    autoTable(doc, {
      startY: tableStartY,
      head: [['Data', 'Hora', 'Liga', 'Time Casa', 'Time Fora', 'Método', 'Tipo', 'Stake', 'Odd', 'Resultado', 'Lucro']],
      body: operations.map((op) => [
        op.date,
        op.time,
        op.league.length > 20 ? op.league.substring(0, 18) + '...' : op.league,
        op.homeTeam.length > 15 ? op.homeTeam.substring(0, 13) + '...' : op.homeTeam,
        op.awayTeam.length > 15 ? op.awayTeam.substring(0, 13) + '...' : op.awayTeam,
        op.methodName,
        op.operationType,
        op.stake,
        op.odd,
        op.result === 'Green' ? 'GREEN' : 'RED',
        formatCurrencyPDF(op.profit),
      ]),
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 22 }, // Data
        1: { cellWidth: 14 }, // Hora
        2: { cellWidth: 32 }, // Liga
        3: { cellWidth: 28 }, // Time Casa
        4: { cellWidth: 28 }, // Time Fora
        5: { cellWidth: 22 }, // Método
        6: { cellWidth: 12 }, // Tipo
        7: { cellWidth: 20 }, // Stake
        8: { cellWidth: 12 }, // Odd
        9: { cellWidth: 16 }, // Resultado
        10: { cellWidth: 22 }, // Lucro
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        // Color result column
        if (data.section === 'body' && data.column.index === 9) {
          const result = operations[data.row.index]?.result;
          if (result === 'Green') {
            data.cell.styles.textColor = greenColor;
            data.cell.styles.fontStyle = 'bold';
          } else if (result === 'Red') {
            data.cell.styles.textColor = redColor;
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Color profit column
        if (data.section === 'body' && data.column.index === 10) {
          const profit = operations[data.row.index]?.profit || 0;
          if (profit >= 0) {
            data.cell.styles.textColor = greenColor;
          } else {
            data.cell.styles.textColor = redColor;
          }
        }
      },
    });
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text('ViniTrader © 2026', margin, pageHeight - 8);
  }

  // Save
  const fileName = `relatorio_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
  doc.save(fileName);
}
