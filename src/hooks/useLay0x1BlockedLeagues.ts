import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface BlockedLeague {
  id: string;
  owner_id: string;
  league_name: string;
  reason: string;
  created_at: string;
}

export const useLay0x1BlockedLeagues = () => {
  const { user } = useAuth();
  const [blockedLeagues, setBlockedLeagues] = useState<BlockedLeague[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocked = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('lay0x1_blocked_leagues')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    setBlockedLeagues(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBlocked(); }, [fetchBlocked]);

  const blockLeague = useCallback(async (leagueName: string, reason: string = 'nao_disponivel') => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from('lay0x1_blocked_leagues')
      .upsert({ owner_id: user.id, league_name: leagueName, reason }, { onConflict: 'owner_id,league_name' });
    if (!error) {
      setBlockedLeagues(prev => [...prev.filter(b => b.league_name !== leagueName), { id: '', owner_id: user.id, league_name: leagueName, reason, created_at: new Date().toISOString() }]);
      toast.success(`Liga "${leagueName}" bloqueada`);
    }
  }, [user]);

  const unblockLeague = useCallback(async (leagueName: string) => {
    if (!user) return;
    await (supabase as any)
      .from('lay0x1_blocked_leagues')
      .delete()
      .eq('owner_id', user.id)
      .eq('league_name', leagueName);
    setBlockedLeagues(prev => prev.filter(b => b.league_name !== leagueName));
    toast.success(`Liga "${leagueName}" desbloqueada`);
  }, [user]);

  const isBlocked = useCallback((leagueName: string) => {
    return blockedLeagues.some(b => b.league_name === leagueName);
  }, [blockedLeagues]);

  const blockedNames = blockedLeagues.map(b => b.league_name);

  return { blockedLeagues, loading, blockLeague, unblockLeague, isBlocked, blockedNames, refetch: fetchBlocked };
};
