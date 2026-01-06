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
    // Pre-match format
    bookmakers?: Array<{
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
    // Live format
    odds?: Array<{
      id: number;
      name: string;
      values: Array<{
        value: string;
        odd: string;
        handicap?: string;
        main?: boolean | null;
        suspended?: boolean;
      }>;
    }>;
  }>;
}

// Cache for pre-match odds (avoid re-fetching)
const preMatchOddsCache = new Map<string, { odds: FixtureOdds | null; timestamp: number }>();
const PREMATCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function parseMatchOdds(values: Array<{ value: string; odd: string }>): OddsValue | null {
  // Accept both "Home/Draw/Away" and "1/X/2" formats
  const home = values.find(v => v.value === 'Home' || v.value === '1')?.odd;
  const draw = values.find(v => v.value === 'Draw' || v.value === 'X')?.odd;
  const away = values.find(v => v.value === 'Away' || v.value === '2')?.odd;
  
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
  preferredBookmakers: number[],
  isLiveFormat: boolean = false
): FixtureOdds | null {
  if (!response?.length) return null;
  
  const data = response[0];
  
  // Live odds format: response[0].odds (array of bet types, no bookmaker structure)
  if (isLiveFormat && data?.odds?.length) {
    const oddsArray = data.odds;
    
    // Match Winner (1X2) - id 1 or name contains "Winner"
    const matchWinnerBet = oddsArray.find((b: any) => 
      b.id === 1 || b.name === 'Match Winner' || b.name === '3Way Result'
    );
    
    let matchOdds: OddsValue | null = null;
    if (matchWinnerBet?.values) {
      const home = matchWinnerBet.values.find((v: any) => v.value === 'Home' || v.value === '1')?.odd;
      const draw = matchWinnerBet.values.find((v: any) => v.value === 'Draw' || v.value === 'X')?.odd;
      const away = matchWinnerBet.values.find((v: any) => v.value === 'Away' || v.value === '2')?.odd;
      
      if (home && draw && away) {
        matchOdds = {
          home: parseFloat(home),
          draw: parseFloat(draw),
          away: parseFloat(away),
        };
      }
    }
    
    // Both Teams Score - id 8
    const bttsBet = oddsArray.find((b: any) => 
      b.id === 8 || b.name === 'Both Teams Score' || b.name === 'Both Teams to Score'
    );
    
    let btts: BttsOdds | null = null;
    if (bttsBet?.values) {
      const yes = bttsBet.values.find((v: any) => v.value === 'Yes')?.odd;
      const no = bttsBet.values.find((v: any) => v.value === 'No')?.odd;
      
      if (yes && no) {
        btts = { yes: parseFloat(yes), no: parseFloat(no) };
      }
    }
    
    if (!matchOdds && !btts) return null;
    
    return {
      matchOdds,
      btts,
      bookmaker: 'Live',
      bookmakerId: 0,
      isLive: true,
      lastUpdate: new Date().toISOString(),
    };
  }
  
  // Pre-match format: response[0].bookmakers
  if (!data?.bookmakers?.length) return null;
  
  const bookmakers = data.bookmakers;
  
  // Find preferred bookmaker
  let selectedBookmaker = null;
  for (const prefId of preferredBookmakers) {
    selectedBookmaker = bookmakers.find((b: any) => b.id === prefId);
    if (selectedBookmaker) break;
  }
  
  // Fallback to first available
  if (!selectedBookmaker) {
    selectedBookmaker = bookmakers[0];
  }
  
  if (!selectedBookmaker) return null;
  
  // Match Winner (1X2) - bet id 1
  const matchWinnerBet = selectedBookmaker.bets.find((b: any) => b.id === 1 || b.name === 'Match Winner');
  const matchOdds = matchWinnerBet ? parseMatchOdds(matchWinnerBet.values) : null;
  
  // Both Teams Score - bet id 8
  const bttsBet = selectedBookmaker.bets.find((b: any) => b.id === 8 || b.name === 'Both Teams Score');
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
  
  const fetchOdds = useCallback(async () => {
    if (!fixtureId) return;
    
    const cacheKey = `odds-${fixtureId}`;
    
    // Always check cache first (pre-match odds are valid for the whole match)
    const cached = preMatchOddsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PREMATCH_CACHE_TTL) {
      setOdds(cached.odds);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // ALWAYS fetch pre-match odds (odds/live doesn't have 1X2 and BTTS markets)
      const { data: response, error: invokeError } = await supabase.functions.invoke('api-football', {
        body: { endpoint: 'odds', params: { fixture: fixtureId, bookmaker: BETFAIR_IDS[0] } }
      });
      
      if (invokeError) throw new Error(invokeError.message);
      
      let parsedOdds = extractOddsFromResponse(response?.response || [], PREFERRED_BOOKMAKERS, false);
      
      // If Betfair not found, try without bookmaker filter (any bookmaker)
      if (!parsedOdds) {
        const { data: fallbackResponse } = await supabase.functions.invoke('api-football', {
          body: { endpoint: 'odds', params: { fixture: fixtureId } }
        });
        parsedOdds = extractOddsFromResponse(fallbackResponse?.response || [], PREFERRED_BOOKMAKERS, false);
      }
      
      // Cache odds
      preMatchOddsCache.set(cacheKey, { odds: parsedOdds, timestamp: Date.now() });
      
      setOdds(parsedOdds);
    } catch (err) {
      console.error('Error fetching odds:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);
  
  // Initial fetch (only once per fixture)
  useEffect(() => {
    if (!fixtureId || fetchedRef.current) return;
    fetchedRef.current = true;
    fetchOdds();
  }, [fixtureId, fetchOdds]);
  
  // No periodic refresh needed - pre-match odds don't change during live game
  
  return { odds, loading, error, refetch: fetchOdds };
}
