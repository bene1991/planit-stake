import { useState } from 'react';
import { FileText, FileSpreadsheet, Download, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportOperationsToPDF } from '@/utils/exportToPDF';
import { exportOperationsToExcel } from '@/utils/exportToExcel';
import { Game, Method } from '@/types';
import { StatisticsFilters } from '@/components/StatisticsFilterBar';
import { toast } from 'sonner';

interface ReportExportButtonProps {
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

export function ReportExportButton({
  games,
  methods,
  filters,
  stats,
}: ReportExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (type: 'pdf' | 'excel') => {
    if (stats.total === 0) {
      toast.error('Nenhuma operação para exportar');
      return;
    }

    setIsExporting(true);

    try {
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (type === 'pdf') {
        exportOperationsToPDF({
          games,
          methods,
          filters,
          stats,
        });
        toast.success('PDF gerado com sucesso!');
      } else {
        exportOperationsToExcel({
          games,
          methods,
          filters,
          stats,
        });
        toast.success('Excel gerado com sucesso!');
      }
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error(`Erro ao gerar ${type === 'pdf' ? 'PDF' : 'Excel'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={isExporting || stats.total === 0}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          <span className="hidden sm:inline">Relatório</span>
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="mr-2 h-4 w-4 text-destructive" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileSpreadsheet className="mr-2 h-4 w-4 text-success" />
          Exportar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
