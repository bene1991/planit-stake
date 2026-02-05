 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Badge } from '@/components/ui/badge';
 import { AlertTriangle, Plus, X, Calendar } from 'lucide-react';
 import { format, parseISO, isAfter } from 'date-fns';
 import { ptBR } from 'date-fns/locale';
 import type { LeagueQuarantine } from '@/hooks/useBttsEntries';
 
 interface BttsQuarantineManagerProps {
   quarantine: LeagueQuarantine[];
   onAdd: (league: string, days: number, reason: string) => Promise<void>;
   onRemove: (id: string) => Promise<void>;
 }
 
 export function BttsQuarantineManager({ quarantine, onAdd, onRemove }: BttsQuarantineManagerProps) {
   const [showForm, setShowForm] = useState(false);
   const [form, setForm] = useState({
     league: '',
     days: '7',
     reason: '',
   });
 
   const activeQuarantine = quarantine.filter(q => 
     isAfter(parseISO(q.quarantineUntil), new Date())
   );
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!form.league) return;
     
     await onAdd(form.league, parseInt(form.days), form.reason);
     setForm({ league: '', days: '7', reason: '' });
     setShowForm(false);
   };
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <CardTitle className="text-lg flex items-center gap-2">
             <AlertTriangle className="h-5 w-5 text-yellow-500" />
             Ligas em Quarentena
             {activeQuarantine.length > 0 && (
               <Badge variant="secondary">{activeQuarantine.length}</Badge>
             )}
           </CardTitle>
           <Button
             variant="ghost"
             size="sm"
             onClick={() => setShowForm(!showForm)}
           >
             <Plus className="h-4 w-4 mr-1" />
             Adicionar
           </Button>
         </div>
       </CardHeader>
       <CardContent className="space-y-3">
         {showForm && (
           <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-muted/50 rounded-lg">
             <div className="space-y-2">
               <Label htmlFor="q-league">Liga</Label>
               <Input
                 id="q-league"
                 placeholder="Ex: Serie B Brasil"
                 value={form.league}
                 onChange={e => setForm(prev => ({ ...prev, league: e.target.value }))}
                 required
               />
             </div>
             <div className="grid grid-cols-2 gap-3">
               <div className="space-y-2">
                 <Label htmlFor="q-days">Dias</Label>
                 <Input
                   id="q-days"
                   type="number"
                   min="1"
                   max="90"
                   value={form.days}
                   onChange={e => setForm(prev => ({ ...prev, days: e.target.value }))}
                   required
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="q-reason">Motivo</Label>
                 <Input
                   id="q-reason"
                   placeholder="3 reds seguidos"
                   value={form.reason}
                   onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
                 />
               </div>
             </div>
             <div className="flex gap-2">
               <Button type="submit" size="sm" className="flex-1">
                 Adicionar Quarentena
               </Button>
               <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                 Cancelar
               </Button>
             </div>
           </form>
         )}
         
         {activeQuarantine.length === 0 ? (
           <p className="text-sm text-muted-foreground text-center py-4">
             Nenhuma liga em quarentena
           </p>
         ) : (
           <div className="space-y-2">
             {activeQuarantine.map(q => (
               <div
                 key={q.id}
                 className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
               >
                 <div>
                   <p className="font-medium">{q.league}</p>
                   <div className="flex items-center gap-2 text-xs text-muted-foreground">
                     <Calendar className="h-3 w-3" />
                     <span>Até {format(parseISO(q.quarantineUntil), "dd 'de' MMMM", { locale: ptBR })}</span>
                     {q.reason && <span>• {q.reason}</span>}
                   </div>
                 </div>
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={() => onRemove(q.id)}
                   className="h-8 w-8 text-muted-foreground hover:text-destructive"
                 >
                   <X className="h-4 w-4" />
                 </Button>
               </div>
             ))}
           </div>
         )}
       </CardContent>
     </Card>
   );
 }