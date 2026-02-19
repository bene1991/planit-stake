import { useState, useCallback, useRef, useEffect } from 'react';

const MATCHBOOK_BASE = 'https://api.matchbook.com';
const TOKEN_TTL = 4 * 60 * 60 * 1000;
const CACHE_TTL = 5000; // 5s cache per event
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
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
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
    const res = await fetch(`${MATCHBOOK_BASE}/bpapi/rest/security/session`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(`Login falhou (${res.status})`);
    const data = await res.json();
    const token = data['session-token'] || data['sessionToken'];
    if (!token) throw new Error('Sem session-token');
    tokenRef.current = token;
    tokenTimestampRef.current = Date.now();
    return token;
  }, []);

  const fetchWithAuth = useCallback(async (url: string): Promise<Response> => {
    const creds = loadCreds();
    if (!isTokenValid() && creds) {
      await doLogin(creds.username, creds.password);
    }
    if (!tokenRef.current) throw new Error('Não autenticado');

    let res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'session-token': tokenRef.current },
    });

    if (res.status === 401 && creds) {
      tokenRef.current = null;
      await doLogin(creds.username, creds.password);
      res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'session-token': tokenRef.current! },
      });
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
        `${MATCHBOOK_BASE}/edge/rest/events/${eventId}/markets?include-runners-prices=true`
      );
      if (!res.ok) return;

      const data = await res.json();
      const markets = data.markets || [];

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

      // Clear flashes after 1s
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

    // Stagger requests: 200ms apart
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
    cacheRef.current = {}; // Clear cache to force fresh fetch
    fetchAllEvents();
  }, [fetchAllEvents]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !connected) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    fetchAllEvents();
    intervalRef.current = setInterval(fetchAllEvents, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, connected, fetchAllEvents]);

  // Auto-login on mount
  useEffect(() => {
    const creds = loadCreds();
    if (creds && !connected) {
      login(creds.username, creds.password);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    connected,
    loading,
    error,
    marketsByEvent,
    flashesByEvent,
    lastUpdatedByEvent,
    autoRefresh,
    setAutoRefresh,
    login,
    disconnect,
    setEventIds,
    fetchMarketsForEvent,
    manualRefresh,
  };
}
