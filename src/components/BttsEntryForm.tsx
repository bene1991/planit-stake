 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
 import { Plus, Loader2 } from 'lucide-react';
 import { format } from 'date-fns';
 
 interface BttsEntryFormProps {
   onSubmit: (entry: {
     date: string;
     time: string;
     league: string;
     homeTeam: string;
     awayTeam: string;
     odd: number;
     stakeValue: number;
     result: 'Green' | 'Red';
     method: string;
   }) => Promise<void>;
   isQuarantined?: (league: string) => boolean;
 }
 
 export function BttsEntryForm({ onSubmit, isQuarantined }: BttsEntryFormProps) {
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [form, setForm] = useState({
     date: format(new Date(), 'yyyy-MM-dd'),
     time: format(new Date(), 'HH:mm'),
     league: '',
     homeTeam: '',
     awayTeam: '',
     odd: '',
     stakeValue: '100',
     result: 'Green' as 'Green' | 'Red',
   });
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (!form.league || !form.homeTeam || !form.awayTeam || !form.odd) {
       return;
     }
     
     if (isQuarantined && isQuarantined(form.league)) {
       alert('Esta liga está em quarentena!');
       return;
     }
     
     setIsSubmitting(true);
     try {
       await onSubmit({
         date: form.date,
         time: form.time,
         league: form.league,
         homeTeam: form.homeTeam,
         awayTeam: form.awayTeam,
         odd: parseFloat(form.odd),
         stakeValue: parseFloat(form.stakeValue),
         result: form.result,
         method: 'BTTS',
       });
       
       // Reset form
       setForm(prev => ({
         ...prev,
         league: '',
         homeTeam: '',
         awayTeam: '',
         odd: '',
         result: 'Green',
       }));
     } finally {
       setIsSubmitting(false);
     }
   };
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <CardTitle className="text-lg flex items-center gap-2">
           <Plus className="h-5 w-5" />
           Nova Entrada BTTS
         </CardTitle>
       </CardHeader>
       <CardContent>
         <form onSubmit={handleSubmit} className="space-y-4">
           <div className="grid grid-cols-2 gap-3">
             <div className="space-y-2">
               <Label htmlFor="date">Data</Label>
               <Input
                 id="date"
                 type="date"
                 value={form.date}
                 onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                 required
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="time">Hora</Label>
               <Input
                 id="time"
                 type="time"
                 value={form.time}
                 onChange={e => setForm(prev => ({ ...prev, time: e.target.value }))}
                 required
               />
             </div>
           </div>
           
           <div className="space-y-2">
             <Label htmlFor="league">Liga</Label>
             <Input
               id="league"
               placeholder="Ex: Premier League"
               value={form.league}
               onChange={e => setForm(prev => ({ ...prev, league: e.target.value }))}
               required
             />
             {isQuarantined && form.league && isQuarantined(form.league) && (
               <p className="text-xs text-destructive">⚠️ Esta liga está em quarentena!</p>
             )}
           </div>
           
           <div className="grid grid-cols-2 gap-3">
             <div className="space-y-2">
               <Label htmlFor="homeTeam">Time Casa</Label>
               <Input
                 id="homeTeam"
                 placeholder="Ex: Liverpool"
                 value={form.homeTeam}
                 onChange={e => setForm(prev => ({ ...prev, homeTeam: e.target.value }))}
                 required
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="awayTeam">Time Fora</Label>
               <Input
                 id="awayTeam"
                 placeholder="Ex: Chelsea"
                 value={form.awayTeam}
                 onChange={e => setForm(prev => ({ ...prev, awayTeam: e.target.value }))}
                 required
               />
             </div>
           </div>
           
           <div className="grid grid-cols-2 gap-3">
             <div className="space-y-2">
               <Label htmlFor="odd">Odd</Label>
               <Input
                 id="odd"
                 type="number"
                 step="0.01"
                 min="1.01"
                 placeholder="2.05"
                 value={form.odd}
                 onChange={e => setForm(prev => ({ ...prev, odd: e.target.value }))}
                 required
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="stakeValue">Stake (R$)</Label>
               <Input
                 id="stakeValue"
                 type="number"
                 step="0.01"
                 min="1"
                 value={form.stakeValue}
                 onChange={e => setForm(prev => ({ ...prev, stakeValue: e.target.value }))}
                 required
               />
             </div>
           </div>
           
           <div className="space-y-2">
             <Label>Resultado</Label>
             <RadioGroup
               value={form.result}
               onValueChange={(value) => setForm(prev => ({ ...prev, result: value as 'Green' | 'Red' }))}
               className="flex gap-4"
             >
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="Green" id="green" />
                 <Label htmlFor="green" className="text-green-500 cursor-pointer">✅ Green</Label>
               </div>
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="Red" id="red" />
                 <Label htmlFor="red" className="text-red-500 cursor-pointer">❌ Red</Label>
               </div>
             </RadioGroup>
           </div>
           
           <Button type="submit" className="w-full" disabled={isSubmitting}>
             {isSubmitting ? (
               <>
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 Salvando...
               </>
             ) : (
               <>
                 <Plus className="mr-2 h-4 w-4" />
                 Adicionar Entrada
               </>
             )}
           </Button>
         </form>
       </CardContent>
     </Card>
   );
 }