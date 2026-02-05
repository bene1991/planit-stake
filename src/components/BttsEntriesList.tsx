 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { List, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
 import { format, parseISO } from 'date-fns';
 import { ptBR } from 'date-fns/locale';
 import type { BttsEntry } from '@/hooks/useBttsEntries';
 
 interface BttsEntriesListProps {
   entries: BttsEntry[];
   onDelete: (id: string) => Promise<void>;
 }
 
 export function BttsEntriesList({ entries, onDelete }: BttsEntriesListProps) {
   const [expanded, setExpanded] = useState(true);
   const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
 
   const handleDelete = async (id: string) => {
     if (deleteConfirm === id) {
       await onDelete(id);
       setDeleteConfirm(null);
     } else {
       setDeleteConfirm(id);
       setTimeout(() => setDeleteConfirm(null), 3000);
     }
   };
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <CardTitle className="text-lg flex items-center gap-2">
             <List className="h-5 w-5" />
             Histórico
             <Badge variant="secondary">{entries.length}</Badge>
           </CardTitle>
           <Button
             variant="ghost"
             size="icon"
             onClick={() => setExpanded(!expanded)}
           >
             {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
           </Button>
         </div>
       </CardHeader>
       {expanded && (
         <CardContent className="pt-0">
           {entries.length === 0 ? (
             <p className="text-sm text-muted-foreground text-center py-4">
               Nenhuma entrada registrada
             </p>
           ) : (
             <ScrollArea className="h-[400px] pr-4">
               <div className="space-y-2">
                 {entries.map(entry => (
                   <div
                     key={entry.id}
                     className={`flex items-center justify-between p-3 rounded-lg border ${
                       entry.result === 'Green' 
                         ? 'bg-green-500/5 border-green-500/20' 
                         : 'bg-red-500/5 border-red-500/20'
                     }`}
                   >
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2">
                         <span className="text-xs text-muted-foreground">
                           {format(parseISO(entry.date), 'dd/MM', { locale: ptBR })}
                         </span>
                         <span className="text-xs text-muted-foreground">•</span>
                         <span className="text-xs text-muted-foreground truncate">
                           {entry.league}
                         </span>
                       </div>
                       <p className="font-medium truncate">
                         {entry.homeTeam} x {entry.awayTeam}
                       </p>
                       <div className="flex items-center gap-2 text-xs text-muted-foreground">
                         <span>Odd: {entry.odd.toFixed(2)}</span>
                         <span>•</span>
                         <span>R$ {entry.stakeValue.toFixed(0)}</span>
                       </div>
                     </div>
                     
                     <div className="flex items-center gap-2">
                       <div className="text-right">
                         <p className={`font-bold ${
                           entry.result === 'Green' ? 'text-green-500' : 'text-red-500'
                         }`}>
                           {entry.result === 'Green' ? '+' : ''}R$ {entry.profit.toFixed(2)}
                         </p>
                         <Badge variant={entry.result === 'Green' ? 'default' : 'destructive'} className="text-xs">
                           {entry.result}
                         </Badge>
                       </div>
                       
                       <Button
                         variant="ghost"
                         size="icon"
                         onClick={() => handleDelete(entry.id)}
                         className={`h-8 w-8 ${deleteConfirm === entry.id ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     </div>
                   </div>
                 ))}
               </div>
             </ScrollArea>
           )}
         </CardContent>
       )}
     </Card>
   );
 }