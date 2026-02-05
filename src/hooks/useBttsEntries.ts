 import { useState, useEffect, useCallback, useMemo } from 'react';
 import { useAuth } from '@/contexts/AuthContext';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export interface BttsEntry {
   id: string;
   date: string;
   time: string;
   league: string;
   homeTeam: string;
   awayTeam: string;
   odd: number;
   stakeValue: number;
   result: 'Green' | 'Red';
   profit: number;
   method: string;
 }
 
 export interface LeagueQuarantine {
   id: string;
   league: string;
   quarantineUntil: string;
   reason: string | null;
 }
 
 export interface BttsStats {
   total: number;
   greens: number;
   reds: number;
   winRate: number;
   profit: number;
   roi: number;
   avgOdd: number;
 }
 
 export function useBttsEntries() {
   const { user } = useAuth();
   const { toast } = useToast();
   const [entries, setEntries] = useState<BttsEntry[]>([]);
   const [quarantine, setQuarantine] = useState<LeagueQuarantine[]>([]);
   const [loading, setLoading] = useState(true);
 
   // Fetch entries
   const fetchEntries = useCallback(async () => {
     if (!user) return;
     
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from('btts_entries')
         .select('*')
         .eq('owner_id', user.id)
         .order('date', { ascending: false });
       
       if (error) throw error;
       
       setEntries((data || []).map(row => ({
         id: row.id,
         date: row.date,
         time: row.time,
         league: row.league,
         homeTeam: row.home_team,
         awayTeam: row.away_team,
         odd: Number(row.odd),
         stakeValue: Number(row.stake_value),
         result: row.result as 'Green' | 'Red',
         profit: Number(row.profit || 0),
         method: row.method || 'BTTS',
       })));
     } catch (error) {
       console.error('Error fetching BTTS entries:', error);
     } finally {
       setLoading(false);
     }
   }, [user]);
 
   // Fetch quarantine
   const fetchQuarantine = useCallback(async () => {
     if (!user) return;
     
     try {
       const { data, error } = await supabase
         .from('btts_league_quarantine')
         .select('*')
         .eq('owner_id', user.id);
       
       if (error) throw error;
       
       setQuarantine((data || []).map(row => ({
         id: row.id,
         league: row.league,
         quarantineUntil: row.quarantine_until,
         reason: row.reason,
       })));
     } catch (error) {
       console.error('Error fetching quarantine:', error);
     }
   }, [user]);
 
   useEffect(() => {
     fetchEntries();
     fetchQuarantine();
   }, [fetchEntries, fetchQuarantine]);
 
   // Calculate stats
   const stats: BttsStats = useMemo(() => {
     const total = entries.length;
     const greens = entries.filter(e => e.result === 'Green').length;
     const reds = total - greens;
     const winRate = total > 0 ? (greens / total) * 100 : 0;
     const profit = entries.reduce((sum, e) => sum + e.profit, 0);
     const totalStaked = entries.reduce((sum, e) => sum + e.stakeValue, 0);
     const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;
     const avgOdd = total > 0 ? entries.reduce((sum, e) => sum + e.odd, 0) / total : 0;
     
     return { total, greens, reds, winRate, profit, roi, avgOdd };
   }, [entries]);
 
   // Add entry
   const addEntry = useCallback(async (entry: Omit<BttsEntry, 'id' | 'profit'>) => {
     if (!user) return;
     
     const profit = entry.result === 'Green' 
       ? entry.stakeValue * (entry.odd - 1)
       : -entry.stakeValue;
     
     try {
       const { error } = await supabase
         .from('btts_entries')
         .insert({
           owner_id: user.id,
           date: entry.date,
           time: entry.time,
           league: entry.league,
           home_team: entry.homeTeam,
           away_team: entry.awayTeam,
           odd: entry.odd,
           stake_value: entry.stakeValue,
           result: entry.result,
           profit,
           method: entry.method || 'BTTS',
         });
       
       if (error) throw error;
       
       toast({ title: 'Entrada adicionada', description: `${entry.homeTeam} x ${entry.awayTeam}` });
       await fetchEntries();
     } catch (error) {
       console.error('Error adding BTTS entry:', error);
       toast({ title: 'Erro ao adicionar', variant: 'destructive' });
     }
   }, [user, toast, fetchEntries]);
 
   // Delete entry
   const deleteEntry = useCallback(async (id: string) => {
     if (!user) return;
     
     try {
       const { error } = await supabase
         .from('btts_entries')
         .delete()
         .eq('id', id);
       
       if (error) throw error;
       
       toast({ title: 'Entrada removida' });
       await fetchEntries();
     } catch (error) {
       console.error('Error deleting BTTS entry:', error);
       toast({ title: 'Erro ao remover', variant: 'destructive' });
     }
   }, [user, toast, fetchEntries]);
 
   // Add quarantine
   const addQuarantine = useCallback(async (league: string, days: number, reason: string) => {
     if (!user) return;
     
     const quarantineUntil = new Date();
     quarantineUntil.setDate(quarantineUntil.getDate() + days);
     
     try {
       const { error } = await supabase
         .from('btts_league_quarantine')
         .insert({
           owner_id: user.id,
           league,
           quarantine_until: quarantineUntil.toISOString().split('T')[0],
           reason,
         });
       
       if (error) throw error;
       
       toast({ title: 'Liga em quarentena', description: `${league} pausada por ${days} dias` });
       await fetchQuarantine();
     } catch (error) {
       console.error('Error adding quarantine:', error);
       toast({ title: 'Erro ao adicionar quarentena', variant: 'destructive' });
     }
   }, [user, toast, fetchQuarantine]);
 
   // Remove quarantine
   const removeQuarantine = useCallback(async (id: string) => {
     if (!user) return;
     
     try {
       const { error } = await supabase
         .from('btts_league_quarantine')
         .delete()
         .eq('id', id);
       
       if (error) throw error;
       
       toast({ title: 'Quarentena removida' });
       await fetchQuarantine();
     } catch (error) {
       console.error('Error removing quarantine:', error);
       toast({ title: 'Erro ao remover quarentena', variant: 'destructive' });
     }
   }, [user, toast, fetchQuarantine]);
 
   // Check if league is in quarantine
   const isLeagueQuarantined = useCallback((league: string): boolean => {
     const today = new Date().toISOString().split('T')[0];
     return quarantine.some(q => q.league === league && q.quarantineUntil >= today);
   }, [quarantine]);
 
   return {
     entries,
     loading,
     stats,
     quarantine,
     addEntry,
     deleteEntry,
     addQuarantine,
     removeQuarantine,
     isLeagueQuarantined,
     refresh: fetchEntries,
   };
 }