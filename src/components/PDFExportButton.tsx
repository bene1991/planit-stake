import { useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportOperationsToPDF } from '@/utils/exportToPDF';
import { Game, Method } from '@/types';
import { StatisticsFilters } from '@/components/StatisticsFilterBar';
import { toast } from 'sonner';

interface PDFExportButtonProps {
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
  variant?: 'default' | 'simple';
}

export function PDFExportButton({
  games,
  methods,
  filters,
  stats,
  variant = 'simple',
}: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (type: 'full' | 'summary' = 'full') => {
    if (stats.total === 0) {
      toast.error('Nenhuma operação para exportar');
      return;
    }

    setIsExporting(true);

    try {
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 100));

      exportOperationsToPDF({
        games,
        methods,
        filters,
        stats,
      });

      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  if (variant === 'simple') {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleExport('full')}
        disabled={isExporting || stats.total === 0}
      >
        {isExporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        <span className="hidden sm:inline">PDF</span>
      </Button>
    );
  }

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
            <FileText className="mr-2 h-4 w-4" />
          )}
          <span className="hidden sm:inline">PDF</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('full')}>
          <Download className="mr-2 h-4 w-4" />
          Relatório Completo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('summary')}>
          <FileText className="mr-2 h-4 w-4" />
          Apenas Resumo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
