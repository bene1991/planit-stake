import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';

interface TeamStats {
  team: string;
  gamesCount: number;
  operations: number;
  greens: number;
  reds: number;
  winRate: number;
}

interface TeamStatsTableProps {
  data: TeamStats[];
}

type SortField = 'team' | 'gamesCount' | 'operations' | 'winRate';

export function TeamStatsTable({ data }: TeamStatsTableProps) {
  const [sortField, setSortField] = useState<SortField>('winRate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    if (sortField === 'team') {
      return multiplier * a.team.localeCompare(b.team);
    }
    
    return multiplier * (a[sortField] - b[sortField]);
  });

  const getWinRateBadgeVariant = (winRate: number) => {
    if (winRate >= 60) return 'default'; // Verde
    if (winRate >= 50) return 'secondary'; // Amarelo
    return 'destructive'; // Vermelho
  };

  return (
    <Card className="p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">Estatísticas por Time</h3>
        <p className="text-sm text-muted-foreground">
          Mostrando times com 2+ jogos
        </p>
      </div>
      
      {sortedData.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Nenhuma estatística disponível
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <button
                    onClick={() => handleSort('team')}
                    className="flex items-center gap-1 font-semibold hover:text-foreground"
                  >
                    Time
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    onClick={() => handleSort('gamesCount')}
                    className="flex items-center gap-1 font-semibold hover:text-foreground"
                  >
                    Jogos
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    onClick={() => handleSort('operations')}
                    className="flex items-center gap-1 font-semibold hover:text-foreground"
                  >
                    Operações
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                </TableHead>
                <TableHead className="text-center">Resultados</TableHead>
                <TableHead className="text-center">
                  <button
                    onClick={() => handleSort('winRate')}
                    className="flex items-center gap-1 font-semibold hover:text-foreground"
                  >
                    Win Rate
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((stat) => (
                <TableRow key={stat.team}>
                  <TableCell className="font-medium">{stat.team}</TableCell>
                  <TableCell className="text-center">{stat.gamesCount}</TableCell>
                  <TableCell className="text-center">{stat.operations}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <span className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="h-3 w-3" />
                        {stat.greens}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className="flex items-center gap-1 text-red-600">
                        <TrendingDown className="h-3 w-3" />
                        {stat.reds}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getWinRateBadgeVariant(stat.winRate)}>
                      {stat.winRate}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
