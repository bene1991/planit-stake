import { useState, useCallback, useRef } from 'react';

const MATCHBOOK_BASE = 'https://api.matchbook.com';
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

export function useMatchbookEventLinker() {
  const [searchResults, setSearchResults] = useState<MatchbookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const tokenTsRef = useRef(0);

  const ensureAuth = useCallback(async () => {
    if (tokenRef.current && (Date.now() - tokenTsRef.current) < 4 * 3600000) return;
    const creds = loadCreds();
    if (!creds) throw new Error('Não autenticado');
    const res = await fetch(`${MATCHBOOK_BASE}/bpapi/rest/security/session`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    if (!res.ok) throw new Error('Login falhou');
    const data = await res.json();
    tokenRef.current = data['session-token'] || data['sessionToken'];
    tokenTsRef.current = Date.now();
  }, []);

  const searchEvents = useCallback(async (query: string) => {
    setSearching(true);
    try {
      await ensureAuth();
      const res = await fetch(
        `${MATCHBOOK_BASE}/edge/rest/events?category-ids=1&states=open&per-page=100`,
        { headers: { 'Accept': 'application/json', 'session-token': tokenRef.current! } }
      );
      if (!res.ok) throw new Error('Erro buscando eventos');
      const data = await res.json();
      const events: MatchbookSearchResult[] = (data.events || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        start: e.start,
      }));

      // Filter by query (fuzzy match on team names)
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
      const res = await fetch(
        `${MATCHBOOK_BASE}/edge/rest/events?category-ids=1&states=open&per-page=100`,
        { headers: { 'Accept': 'application/json', 'session-token': tokenRef.current! } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const events = data.events || [];

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
