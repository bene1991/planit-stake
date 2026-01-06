import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Betfair bookmaker IDs to try (Betfair has multiple IDs in API-Football)
const BETFAIR_IDS = [6, 15];
const PREFERRED_BOOKMAKERS = [...BETFAIR_IDS, 8, 1]; // Betfair, then Bet365, then Bwin

export interface OddsValue {
  home: number;
  draw: number;
  away: number;
}

export interface BttsOdds {
  yes: number;
  no: number;
}

export interface FixtureOdds {
  matchOdds: OddsValue | null;
  btts: BttsOdds | null;
  bookmaker: string;
  bookmakerId: number;
  isLive: boolean;
  lastUpdate: string | null;
}

interface OddsApiResponse {
  response: Array<{
    fixture: { id: number };
    bookmakers: Array<{
      id: number;
      name: string;
      bets: Array<{
        id: number;
        name: string;
        values: Array<{
          value: string;
          odd: string;
        }>;
      }>;
    }>;
  }>;
}

// Cache for pre-match odds (avoid re-fetching)
const preMatchOddsCache = new Map<string, { odds: FixtureOdds | null; timestamp: number }>();
const PREMATCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function parseMatchOdds(values: Array<{ value: string; odd: string }>): OddsValue | null {
  const home = values.find(v => v.value === 'Home')?.odd;
  const draw = values.find(v => v.value === 'Draw')?.odd;
  const away = values.find(v => v.value === 'Away')?.odd;
  
  if (!home || !draw || !away) return null;
  
  return {
    home: parseFloat(home),
    draw: parseFloat(draw),
    away: parseFloat(away),
  };
}

function parseBttsOdds(values: Array<{ value: string; odd: string }>): BttsOdds | null {
  const yes = values.find(v => v.value === 'Yes')?.odd;
  const no = values.find(v => v.value === 'No')?.odd;
  
  if (!yes || !no) return null;
  
  return {
    yes: parseFloat(yes),
    no: parseFloat(no),
  };
}

function extractOddsFromResponse(
  response: OddsApiResponse['response'],
  preferredBookmakers: number[]
): FixtureOdds | null {
  if (!response?.length || !response[0]?.bookmakers?.length) return null;
  
  const bookmakers = response[0].bookmakers;
  
  // Find preferred bookmaker
  let selectedBookmaker = null;
  for (const prefId of preferredBookmakers) {
    selectedBookmaker = bookmakers.find(b => b.id === prefId);
    if (selectedBookmaker) break;
  }
  
  // Fallback to first available
  if (!selectedBookmaker) {
    selectedBookmaker = bookmakers[0];
  }
  
  if (!selectedBookmaker) return null;
  
  // Match Winner (1X2) - bet id 1
  const matchWinnerBet = selectedBookmaker.bets.find(b => b.id === 1 || b.name === 'Match Winner');
  const matchOdds = matchWinnerBet ? parseMatchOdds(matchWinnerBet.values) : null;
  
  // Both Teams Score - bet id 8
  const bttsBet = selectedBookmaker.bets.find(b => b.id === 8 || b.name === 'Both Teams Score');
  const btts = bttsBet ? parseBttsOdds(bttsBet.values) : null;
  
  return {
    matchOdds,
    btts,
    bookmaker: selectedBookmaker.name,
    bookmakerId: selectedBookmaker.id,
    isLive: false,
    lastUpdate: new Date().toISOString(),
  };
}

export function useFixtureOdds(
  fixtureId: string | number | undefined,
  isGameLive: boolean = false,
  refetchInterval: number = 60000 // 1 minute for live games
) {
  const [odds, setOdds] = useState<FixtureOdds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  
  const fetchOdds = useCallback(async (live: boolean = false) => {
    if (!fixtureId) return;
    
    const cacheKey = `odds-${fixtureId}`;
    
    // For non-live games, check cache first
    if (!live) {
      const cached = preMatchOddsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PREMATCH_CACHE_TTL) {
        setOdds(cached.odds);
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = live ? 'odds/live' : 'odds';
      const params = live 
        ? { fixture: fixtureId }
        : { fixture: fixtureId, bookmaker: BETFAIR_IDS[0] }; // Try Betfair first
      
      const { data: response, error: invokeError } = await supabase.functions.invoke('api-football', {
        body: { endpoint, params }
      });
      
      if (invokeError) throw new Error(invokeError.message);
      
      let parsedOdds = extractOddsFromResponse(response?.response || [], PREFERRED_BOOKMAKERS);
      
      // If Betfair not found for pre-match, try without bookmaker filter
      if (!parsedOdds && !live) {
        const { data: fallbackResponse } = await supabase.functions.invoke('api-football', {
          body: { endpoint: 'odds', params: { fixture: fixtureId } }
        });
        parsedOdds = extractOddsFromResponse(fallbackResponse?.response || [], PREFERRED_BOOKMAKERS);
      }
      
      if (parsedOdds) {
        parsedOdds.isLive = live;
      }
      
      // Cache pre-match odds
      if (!live) {
        preMatchOddsCache.set(cacheKey, { odds: parsedOdds, timestamp: Date.now() });
      }
      
      setOdds(parsedOdds);
    } catch (err) {
      console.error('Error fetching odds:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);
  
  // Initial fetch
  useEffect(() => {
    if (!fixtureId || fetchedRef.current) return;
    fetchedRef.current = true;
    fetchOdds(isGameLive);
  }, [fixtureId, isGameLive, fetchOdds]);
  
  // Periodic refresh for live games
  useEffect(() => {
    if (!isGameLive || !fixtureId) return;
    
    const interval = setInterval(() => {
      fetchOdds(true);
    }, refetchInterval);
    
    return () => clearInterval(interval);
  }, [isGameLive, fixtureId, refetchInterval, fetchOdds]);
  
  return { odds, loading, error, refetch: () => fetchOdds(isGameLive) };
}
