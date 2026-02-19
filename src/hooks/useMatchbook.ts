import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const TOKEN_TTL = 4 * 60 * 60 * 1000; // 4 hours

interface MatchbookEvent {
  event_id: number;
  event_name: string;
  start_time: string;
}

interface CorrectScoreLay {
  score: string;
  lay_price: number;
  lay_available: number;
}

async function matchbookFetch(url: string, method = 'GET', headers: Record<string, string> = {}, body?: string) {
  const { data, error } = await supabase.functions.invoke('matchbook-proxy', {
    body: { url, method, headers, body },
  });
  if (error) throw new Error(error.message || 'Proxy error');
  if (typeof data?.data === 'string' && data.data.trim().startsWith('<!')) {
    throw new Error('API retornou HTML em vez de JSON (possível redirecionamento geográfico)');
  }
  if (data?.status && data.status >= 400) {
    throw new Error(`Matchbook error (${data.status}): ${JSON.stringify(data.data).substring(0, 200)}`);
  }
  return data;
}

export function useMatchbook() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<MatchbookEvent[]>([]);
  const [scores, setScores] = useState<CorrectScoreLay[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const tokenRef = useRef<string | null>(null);
  const tokenTimestampRef = useRef<number>(0);

  const isTokenValid = useCallback(() => {
    return !!tokenRef.current && (Date.now() - tokenTimestampRef.current) < TOKEN_TTL;
  }, []);

  const doLogin = useCallback(async (username: string, password: string): Promise<string> => {
    const res = await matchbookFetch(
      'https://api.matchbook.com/bpapi/rest/security/session',
      'POST',
      { 'Content-Type': 'application/json' },
      JSON.stringify({ username, password })
    );
    const token = res.data?.['session-token'] || res.data?.['sessionToken'] || null;
    if (!token) throw new Error('Nenhum session-token na resposta');
    tokenRef.current = token;
    tokenTimestampRef.current = Date.now();
    return token;
  }, []);

  const fetchWithAuth = useCallback(async (url: string, username?: string, password?: string) => {
    if (!isTokenValid() && username && password) {
      await doLogin(username, password);
    }
    if (!tokenRef.current) throw new Error('Não autenticado. Faça login primeiro.');

    let res = await matchbookFetch(url, 'GET', { 'session-token': tokenRef.current });

    if (res.status === 401 && username && password) {
      tokenRef.current = null;
      await doLogin(username, password);
      res = await matchbookFetch(url, 'GET', { 'session-token': tokenRef.current! });
    }
    return res;
  }, [isTokenValid, doLogin]);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await doLogin(username, password);
      setConnected(true);
      toast.success('Conectado à Matchbook');
    } catch (err: any) {
      setError(err.message);
      setConnected(false);
      toast.error('Falha ao conectar: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [doLogin]);

  const fetchEvents = useCallback(async (username?: string, password?: string) => {
    setEventsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        'https://api.matchbook.com/edge/rest/events?category-ids=1&states=open&per-page=50',
        username, password
      );
      const mapped = (res.data?.events || []).map((e: Record<string, unknown>) => ({
        event_id: e.id,
        event_name: e.name,
        start_time: e.start,
      }));
      setEvents(mapped);
      setConnected(true);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message);
      toast.error('Erro ao buscar eventos: ' + err.message);
    } finally {
      setEventsLoading(false);
    }
  }, [fetchWithAuth]);

  const fetchCorrectScoreLay = useCallback(async (eventId: number, username?: string, password?: string) => {
    setScoresLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        `https://api.matchbook.com/edge/rest/events/${eventId}/markets`,
        username, password
      );
      const markets = res.data?.markets || [];
      const csMarket = markets.find((m: Record<string, unknown>) => {
        const name = String(m.name || '').toLowerCase();
        const mtype = String(m['market-type'] || '').toLowerCase();
        return name.includes('correct score') || mtype.includes('correct_score');
      });

      if (!csMarket) {
        setScores([]);
        setLastUpdated(new Date());
        return;
      }

      const runners = csMarket.runners || [];
      const mapped = runners
        .map((r: Record<string, unknown>) => {
          const prices = (r.prices || []) as Array<Record<string, unknown>>;
          const layPrice = prices.find((p) => p.side === 'lay');
          return {
            score: r.name,
            lay_price: layPrice ? (layPrice.odds || layPrice.price || null) : null,
            lay_available: layPrice ? (layPrice['available-amount'] || layPrice['availableAmount'] || 0) : 0,
          };
        })
        .filter((s: Record<string, unknown>) => s.lay_price !== null)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (a.lay_price as number) - (b.lay_price as number));

      setScores(mapped);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message);
      toast.error('Erro ao buscar odds: ' + err.message);
    } finally {
      setScoresLoading(false);
    }
  }, [fetchWithAuth]);

  const disconnect = useCallback(() => {
    tokenRef.current = null;
    tokenTimestampRef.current = 0;
    setConnected(false);
    setEvents([]);
    setScores([]);
    setError(null);
  }, []);

  return {
    connected, events, scores, loading, eventsLoading, scoresLoading,
    error, lastUpdated, login, fetchEvents, fetchCorrectScoreLay, disconnect,
  };
}
