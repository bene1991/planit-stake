import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'matchbook_creds';

interface MatchbookSearchResult {
  id: number;
  name: string;
  start: string;
}

function loadCreds() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function matchbookFetch(url: string, method = 'GET', headers: Record<string, string> = {}, body?: string) {
  const { data, error } = await supabase.functions.invoke('matchbook-proxy', {
    body: { url, method, headers, body },
  });
  if (error) throw new Error(error.message || 'Proxy error');
  return data;
}

export function useMatchbookEventLinker() {
  const [searchResults, setSearchResults] = useState<MatchbookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const tokenTsRef = useRef(0);

  const ensureAuth = useCallback(async () => {
    if (tokenRef.current && (Date.now() - tokenTsRef.current) < 4 * 3600000) return;
    const creds = loadCreds();
    if (!creds) throw new Error('Não autenticado');
    const res = await matchbookFetch(
      'https://api.matchbook.com/bpapi/rest/security/session',
      'POST',
      { 'Content-Type': 'application/json' },
      JSON.stringify(creds)
    );
    tokenRef.current = res.data?.['session-token'] || res.data?.['sessionToken'];
    tokenTsRef.current = Date.now();
  }, []);

  const searchEvents = useCallback(async (query: string) => {
    setSearching(true);
    try {
      await ensureAuth();
      const res = await matchbookFetch(
        'https://api.matchbook.com/edge/rest/events?category-ids=1&states=open&per-page=100',
        'GET',
        { 'session-token': tokenRef.current! }
      );
      const events: MatchbookSearchResult[] = (res.data?.events || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        start: e.start,
      }));

      const q = query.toLowerCase();
      const filtered = events.filter(e => {
        const name = e.name.toLowerCase();
        const parts = q.split(/\s+vs?\s+|\s+x\s+|\s+-\s+/i);
        return parts.some(p => name.includes(p.trim()));
      });

      setSearchResults(filtered.length > 0 ? filtered : events.slice(0, 20));
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [ensureAuth]);

  const autoMatch = useCallback(async (homeTeam: string, awayTeam: string): Promise<number | null> => {
    try {
      await ensureAuth();
      const res = await matchbookFetch(
        'https://api.matchbook.com/edge/rest/events?category-ids=1&states=open&per-page=100',
        'GET',
        { 'session-token': tokenRef.current! }
      );
      const events = res.data?.events || [];

      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const home = normalize(homeTeam);
      const away = normalize(awayTeam);

      for (const e of events) {
        const eName = normalize(e.name);
        if (eName.includes(home) && eName.includes(away)) {
          return e.id;
        }
      }
      return null;
    } catch {
      return null;
    }
  }, [ensureAuth]);

  return { searchResults, searching, searchEvents, autoMatch };
}
