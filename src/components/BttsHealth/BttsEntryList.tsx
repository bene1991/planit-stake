import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BttsEntry, getOddZone } from '@/types/btts';
import { cn } from '@/lib/utils';
import { List, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface BttsEntryListProps {
  entries: BttsEntry[];
  onDelete: (id: string) => Promise<boolean>;
}

export function BttsEntryList({ entries, onDelete }: BttsEntryListProps) {
  const [expanded, setExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const displayedEntries = expanded ? entries : entries.slice(0, 10);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  if (entries.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6 text-center">
          <List className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nenhuma entrada registrada ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <List className="h-4 w-4" />
          Entradas Recentes
          <span className="text-xs text-muted-foreground font-normal">
            ({entries.length} total)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {displayedEntries.map((entry) => {
          const oddZone = getOddZone(entry.odd);
          
          return (
            <div
              key={entry.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                entry.result === 'Green' && "border-green-500/20 bg-green-500/5",
                entry.result === 'Red' && "border-red-500/20 bg-red-500/5",
                entry.result === 'Void' && "border-border/30 bg-muted/5"
              )}
            >
              {/* Result indicator */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                entry.result === 'Green' && "bg-green-500 text-white",
                entry.result === 'Red' && "bg-red-500 text-white",
                entry.result === 'Void' && "bg-muted text-muted-foreground"
              )}>
                {entry.result === 'Green' && '✓'}
                {entry.result === 'Red' && '✗'}
                {entry.result === 'Void' && '○'}
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {entry.home_team} vs {entry.away_team}
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {entry.league}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{format(parseISO(entry.date), 'dd/MM/yy')}</span>
                  <span>@{entry.odd.toFixed(2)}</span>
                  <span>R${entry.stake_value}</span>
                  {entry.profit !== null && (
                    <span className={cn(
                      "font-medium",
                      entry.profit >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {entry.profit >= 0 ? '+' : ''}R${entry.profit.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Odd zone indicator */}
              {oddZone !== 'ok' && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] shrink-0",
                    oddZone === 'warning' && "border-yellow-500/30 text-yellow-500",
                    oddZone === 'blocked' && "border-red-500/30 text-red-500"
                  )}
                >
                  {oddZone === 'warning' ? '⚠️' : '🚫'}
                </Badge>
              )}

              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(entry.id)}
                disabled={deletingId === entry.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        {entries.length > 10 && (
          <Button
            variant="ghost"
            className="w-full text-sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Mostrar menos
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Ver todas ({entries.length - 10} mais)
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
