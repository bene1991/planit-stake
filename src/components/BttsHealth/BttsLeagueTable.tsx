import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LeagueStats } from '@/types/btts';
import { cn } from '@/lib/utils';
import { Trophy, AlertTriangle } from 'lucide-react';

interface BttsLeagueTableProps {
  leagueStats: LeagueStats[];
}

export function BttsLeagueTable({ leagueStats }: BttsLeagueTableProps) {
  if (leagueStats.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6 text-center">
          <Trophy className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Adicione entradas para ver estatísticas por liga
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" />
          Performance por Liga
          <span className="text-xs text-muted-foreground font-normal">
            (últimas 80 entradas)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Liga</TableHead>
                <TableHead className="text-xs text-center">Ent.</TableHead>
                <TableHead className="text-xs text-center">WR%</TableHead>
                <TableHead className="text-xs text-center">Odd</TableHead>
                <TableHead className="text-xs text-center">Profit</TableHead>
                <TableHead className="text-xs text-center">Bad Run</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leagueStats.map((league) => (
                <TableRow 
                  key={league.league}
                  className={cn(
                    league.status === 'quarantine' && "bg-destructive/5"
                  )}
                >
                  <TableCell className="font-medium text-sm max-w-[150px] truncate">
                    {league.league}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {league.entries}
                  </TableCell>
                  <TableCell className={cn(
                    "text-center text-sm font-medium",
                    league.winRate >= 50 ? "text-green-500" : "text-red-500"
                  )}>
                    {league.winRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {league.oddAvg.toFixed(2)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-center text-sm font-medium",
                    league.profitStakes >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {league.profitStakes >= 0 ? '+' : ''}{league.profitStakes.toFixed(2)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-center text-sm",
                    league.badRun >= 6 && "text-red-500 font-medium"
                  )}>
                    {league.badRun}
                  </TableCell>
                  <TableCell className="text-center">
                    {league.status === 'ok' ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-[10px]">
                        ✅ OK
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Quarentena
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
