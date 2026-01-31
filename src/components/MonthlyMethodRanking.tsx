import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MethodStats {
  name: string;
  profit: number;
  winRate: number;
  operations: number;
}

interface MonthlyMethodRankingProps {
  methods: MethodStats[];
}

export function MonthlyMethodRanking({ methods }: MonthlyMethodRankingProps) {
  if (methods.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma operação registrada neste mês</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Ranking de Métodos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Operações</TableHead>
              <TableHead className="text-right">Win Rate</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.map((method, index) => (
              <TableRow key={method.name}>
                <TableCell>
                  {index === 0 && <Medal className="h-5 w-5 text-yellow-500" />}
                  {index === 1 && <Medal className="h-5 w-5 text-gray-400" />}
                  {index === 2 && <Medal className="h-5 w-5 text-amber-600" />}
                  {index > 2 && <span className="text-muted-foreground">{index + 1}</span>}
                </TableCell>
                <TableCell className="font-medium">{method.name}</TableCell>
                <TableCell className="text-right">{method.operations}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={method.winRate >= 60 ? 'default' : method.winRate >= 50 ? 'secondary' : 'destructive'}>
                    {method.winRate.toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell className={cn(
                  "text-right font-medium",
                  method.profit >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {method.profit >= 0 ? '+' : ''}
                  {method.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
