import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const TOKEN_TTL = 4 * 60 * 60 * 1000;
const CACHE_TTL = 5000;
const REFRESH_INTERVAL = 5000;

interface RunnerOdds {
  name: string;
  back_price: number | null;
  back_available: number;
  lay_price: number | null;
  lay_available: number;
}

export interface MarketData {
  correct_score: RunnerOdds[];
  match_odds: RunnerOdds[];
  btts: RunnerOdds[];
  over_15: RunnerOdds[];
}

export interface OddFlash {
  [key: string]: 'up' | 'down' | null;
}

interface CacheEntry {
  data: MarketData;
  timestamp: number;
}

const SESSION_KEY = 'matchbook_creds';

function loadCreds(): { username: string; password: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
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
    throw new Error(data.data?.message || data.data?.error || `HTTP ${data.status}`);
  }
  return data;
}

export function useMatchbookMonitor() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketsByEvent, setMarketsByEvent] = useState<Record<string, MarketData>>({});
  const [flashesByEvent, setFlashesByEvent] = useState<Record<string, OddFlash>>({});
  const [lastUpdatedByEvent, setLastUpdatedByEvent] = useState<Record<string, Date>>({});
  const [autoRefresh, setAutoRefresh] = useState(true);

  const tokenRef = useRef<string | null>(null);
  const tokenTimestampRef = useRef(0);
  const cacheRef = useRef<Record<string, CacheEntry>>({});
  const prevOddsRef = useRef<Record<string, Record<string, number>>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventIdsRef = useRef<string[]>([]);
  const requestQueueRef = useRef<Promise<void>>(Promise.resolve());

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
    const token = res.data?.['session-token'] || res.data?.['sessionToken'];
    if (!token) throw new Error('Sem session-token');
    tokenRef.current = token;
    tokenTimestampRef.current = Date.now();
    return token;
  }, []);

  const fetchWithAuth = useCallback(async (url: string): Promise<any> => {
    const creds = loadCreds();
    if (!isTokenValid() && creds) {
      await doLogin(creds.username, creds.password);
    }
    if (!tokenRef.current) throw new Error('Não autenticado');

    let res = await matchbookFetch(url, 'GET', { 'session-token': tokenRef.current });

    if (res.status === 401 && creds) {
      tokenRef.current = null;
      await doLogin(creds.username, creds.password);
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
    } catch (err: any) {
      setError(err.message);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [doLogin]);

  const parseRunners = (runners: any[]): RunnerOdds[] => {
    return runners.map((r: any) => {
      const prices = r.prices || [];
      const backPrice = prices.find((p: any) => p.side === 'back');
      const layPrice = prices.find((p: any) => p.side === 'lay');
      return {
        name: String(r.name || ''),
        back_price: backPrice ? Number(backPrice.odds || backPrice.price || 0) : null,
        back_available: backPrice ? Number(backPrice['available-amount'] || backPrice.availableAmount || 0) : 0,
        lay_price: layPrice ? Number(layPrice.odds || layPrice.price || 0) : null,
        lay_available: layPrice ? Number(layPrice['available-amount'] || layPrice.availableAmount || 0) : 0,
      };
    });
  };

  const detectFlashes = (eventId: string, newData: MarketData): OddFlash => {
    const flashes: OddFlash = {};
    const prevMap = prevOddsRef.current[eventId] || {};
    const newMap: Record<string, number> = {};

    const processRunners = (runners: RunnerOdds[], prefix: string) => {
      runners.forEach(r => {
        if (r.lay_price != null) {
          const key = `${prefix}_${r.name}_lay`;
          newMap[key] = r.lay_price;
          const prev = prevMap[key];
          if (prev != null && prev !== r.lay_price) {
            flashes[key] = r.lay_price > prev ? 'up' : 'down';
          }
        }
        if (r.back_price != null) {
          const key = `${prefix}_${r.name}_back`;
          newMap[key] = r.back_price;
          const prev = prevMap[key];
          if (prev != null && prev !== r.back_price) {
            flashes[key] = r.back_price > prev ? 'up' : 'down';
          }
        }
      });
    };

    processRunners(newData.correct_score, 'cs');
    processRunners(newData.match_odds, 'mo');
    processRunners(newData.btts, 'btts');
    processRunners(newData.over_15, 'o15');

    prevOddsRef.current[eventId] = newMap;
    return flashes;
  };

  const fetchMarketsForEvent = useCallback(async (eventId: string) => {
    const cached = cacheRef.current[eventId];
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) return;

    try {
      const res = await fetchWithAuth(
        `https://api.matchbook.com/edge/rest/events/${eventId}/markets?include-runners-prices=true`
      );
      if (res.status && res.status >= 400) return;

      const markets = res.data?.markets || [];
      const result: MarketData = { correct_score: [], match_odds: [], btts: [], over_15: [] };

      for (const m of markets) {
        const name = String(m.name || '').toLowerCase();
        const mtype = String(m['market-type'] || '').toLowerCase();

        if (name.includes('correct score') || mtype.includes('correct_score')) {
          result.correct_score = parseRunners(m.runners || [])
            .filter(r => r.lay_price != null || r.back_price != null)
            .sort((a, b) => (a.lay_price ?? 999) - (b.lay_price ?? 999));
        } else if (name === 'match odds' || mtype.includes('moneyline') || mtype === 'match_odds') {
          result.match_odds = parseRunners(m.runners || []);
        } else if (name.includes('both teams') || mtype.includes('btts') || name.includes('btts')) {
          result.btts = parseRunners(m.runners || []);
        } else if ((name.includes('over') && name.includes('1.5')) || (mtype.includes('over') && mtype.includes('1.5'))) {
          result.over_15 = parseRunners(m.runners || []);
        }
      }

      cacheRef.current[eventId] = { data: result, timestamp: Date.now() };
      const flashes = detectFlashes(eventId, result);

      setMarketsByEvent(prev => ({ ...prev, [eventId]: result }));
      setLastUpdatedByEvent(prev => ({ ...prev, [eventId]: new Date() }));
      setFlashesByEvent(prev => ({ ...prev, [eventId]: flashes }));

      setTimeout(() => {
        setFlashesByEvent(prev => ({ ...prev, [eventId]: {} }));
      }, 1000);
    } catch (err: any) {
      console.error(`Monitor fetch error for event ${eventId}:`, err.message);
    }
  }, [fetchWithAuth]);

  const fetchAllEvents = useCallback(async () => {
    const ids = eventIdsRef.current;
    if (ids.length === 0 || !connected) return;

    for (let i = 0; i < ids.length; i++) {
      requestQueueRef.current = requestQueueRef.current.then(async () => {
        await fetchMarketsForEvent(ids[i]);
        if (i < ids.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      });
    }
  }, [connected, fetchMarketsForEvent]);

  const setEventIds = useCallback((ids: string[]) => {
    eventIdsRef.current = ids;
  }, []);

  const manualRefresh = useCallback(() => {
    cacheRef.current = {};
    fetchAllEvents();
  }, [fetchAllEvents]);

  useEffect(() => {
    if (!autoRefresh || !connected) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    fetchAllEvents();
    intervalRef.current = setInterval(fetchAllEvents, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, connected, fetchAllEvents]);

  // Auto-login removed from hook — handled only in MonitorTrader page component

  const disconnect = useCallback(() => {
    tokenRef.current = null;
    tokenTimestampRef.current = 0;
    setConnected(false);
    setMarketsByEvent({});
    setFlashesByEvent({});
    cacheRef.current = {};
    prevOddsRef.current = {};
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return {
    connected, loading, error, marketsByEvent, flashesByEvent, lastUpdatedByEvent,
    autoRefresh, setAutoRefresh, login, disconnect, setEventIds, fetchMarketsForEvent, manualRefresh,
  };
}
