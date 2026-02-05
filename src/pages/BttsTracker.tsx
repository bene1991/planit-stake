 import { Target, RefreshCw } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { useBttsEntries } from '@/hooks/useBttsEntries';
 import { BttsStatsCard } from '@/components/BttsStatsCard';
 import { BttsEntryForm } from '@/components/BttsEntryForm';
 import { BttsEntriesList } from '@/components/BttsEntriesList';
 import { BttsQuarantineManager } from '@/components/BttsQuarantineManager';
 import { Skeleton } from '@/components/ui/skeleton';
 
 export default function BttsTracker() {
   const {
     entries,
     loading,
     stats,
     quarantine,
     addEntry,
     deleteEntry,
     addQuarantine,
     removeQuarantine,
     isLeagueQuarantined,
     refresh,
   } = useBttsEntries();
 
   return (
     <div className="min-h-screen bg-background">
       <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
         {/* Header */}
         <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
           <div>
             <h1 className="text-2xl font-bold flex items-center gap-2">
               <Target className="h-6 w-6 text-primary" />
               BTTS Tracker
             </h1>
             <p className="text-muted-foreground">
               Gerencie suas operações de Ambas Marcam
             </p>
           </div>
           
           <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
             <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
             Atualizar
           </Button>
         </div>
 
         {/* Stats */}
         {loading ? (
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
             {Array.from({ length: 6 }).map((_, i) => (
               <Skeleton key={i} className="h-24" />
             ))}
           </div>
         ) : (
           <BttsStatsCard stats={stats} />
         )}
 
         {/* Main Content */}
         <div className="grid lg:grid-cols-3 gap-6">
           {/* Left Column - Form & Quarantine */}
           <div className="lg:col-span-1 space-y-6">
             <BttsEntryForm
               onSubmit={addEntry}
               isQuarantined={isLeagueQuarantined}
             />
             
             <BttsQuarantineManager
               quarantine={quarantine}
               onAdd={addQuarantine}
               onRemove={removeQuarantine}
             />
           </div>
 
           {/* Right Column - Entries List */}
           <div className="lg:col-span-2">
             {loading ? (
               <Skeleton className="h-[500px]" />
             ) : (
               <BttsEntriesList
                 entries={entries}
                 onDelete={deleteEntry}
               />
             )}
           </div>
         </div>
       </div>
     </div>
   );
 }