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

export interface OverUnderOdds {
  line: string;
  over: number;
  under: number;
}

export interface NextGoalOdds {
  home: number;
  away: number;
  none: number;
}

export interface PreMatchOdds {
  matchOdds: OddsValue | null;
  btts: BttsOdds | null;
  overUnder25: OverUnderOdds | null;
  bookmaker: string;
  bookmakerId: number;
}

export interface LiveOdds {
  goalsOU: OverUnderOdds | null;
  cornersOU: OverUnderOdds | null;
  nextGoal: NextGoalOdds | null;
  bookmaker: string;
  lastUpdate: Date;
}

export interface FixtureOddsResult {
  preMatch: PreMatchOdds | null;
  live: LiveOdds | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Legacy interface for backward compatibility
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
const preMatchOddsCache = new Map<string, { odds: PreMatchOdds | null; timestamp: number }>();
const PREMATCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Cache for live odds
const liveOddsCache = new Map<string, { odds: LiveOdds | null; timestamp: number }>();
const LIVE_CACHE_TTL = 60 * 1000; // 1 minute

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

function parseOverUnderOdds(
  values: Array<{ value: string; odd: string }>,
  targetLine: string = '2.5'
): OverUnderOdds | null {
  const overValue = values.find(v => v.value === `Over ${targetLine}`)?.odd;
  const underValue = values.find(v => v.value === `Under ${targetLine}`)?.odd;
  
  if (!overValue || !underValue) return null;
  
  return {
    line: targetLine,
    over: parseFloat(overValue),
    under: parseFloat(underValue),
  };
}

function extractPreMatchOdds(
  response: OddsApiResponse['response'],
  preferredBookmakers: number[]
): PreMatchOdds | null {
  if (!response?.length) return null;
  
  const data = response[0];
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
  
  // Over/Under 2.5 Goals - bet id 5
  const ouBet = selectedBookmaker.bets.find((b: any) => 
    b.id === 5 || b.name === 'Goals Over/Under' || b.name === 'Over/Under'
  );
  const overUnder25 = ouBet ? parseOverUnderOdds(ouBet.values, '2.5') : null;
  
  return {
    matchOdds,
    btts,
    overUnder25,
    bookmaker: selectedBookmaker.name,
    bookmakerId: selectedBookmaker.id,
  };
}

function extractLiveOdds(response: OddsApiResponse['response']): LiveOdds | null {
  if (!response?.length) return null;
  
  const data = response[0];
  if (!data?.odds?.length) return null;
  
  const oddsArray = data.odds;
  
  // Goals Over/Under - find main line
  const goalsOUBet = oddsArray.find((b: any) => 
    b.id === 5 || b.name === 'Goals Over/Under' || b.name === 'Over/Under'
  );
  
  let goalsOU: OverUnderOdds | null = null;
  if (goalsOUBet?.values?.length) {
    // Find the main line (usually marked as main: true or first available)
    const mainValues = goalsOUBet.values.filter((v: any) => v.main === true) || [];
    const valuesToUse = mainValues.length > 0 ? mainValues : goalsOUBet.values;
    
    // Extract available lines and find the most common one
    const overValues = valuesToUse.filter((v: any) => v.value.startsWith('Over'));
    if (overValues.length > 0) {
      const lineMatch = overValues[0].value.match(/Over ([\d.]+)/);
      if (lineMatch) {
        const line = lineMatch[1];
        const underValue = valuesToUse.find((v: any) => v.value === `Under ${line}`)?.odd;
        if (underValue) {
          goalsOU = {
            line,
            over: parseFloat(overValues[0].odd),
            under: parseFloat(underValue),
          };
        }
      }
    }
  }
  
  // Corners Over/Under
  const cornersOUBet = oddsArray.find((b: any) => 
    b.name === 'Corners Over/Under' || b.name === 'Total Corners'
  );
  
  let cornersOU: OverUnderOdds | null = null;
  if (cornersOUBet?.values?.length) {
    const overValues = cornersOUBet.values.filter((v: any) => v.value.startsWith('Over'));
    if (overValues.length > 0) {
      const lineMatch = overValues[0].value.match(/Over ([\d.]+)/);
      if (lineMatch) {
        const line = lineMatch[1];
        const underValue = cornersOUBet.values.find((v: any) => v.value === `Under ${line}`)?.odd;
        if (underValue) {
          cornersOU = {
            line,
            over: parseFloat(overValues[0].odd),
            under: parseFloat(underValue),
          };
        }
      }
    }
  }
  
  // Next Goal
  const nextGoalBet = oddsArray.find((b: any) => 
    b.name === 'Next Goal' || b.name === 'Which Team to Score'
  );
  
  let nextGoal: NextGoalOdds | null = null;
  if (nextGoalBet?.values?.length) {
    const home = nextGoalBet.values.find((v: any) => v.value === 'Home' || v.value === '1')?.odd;
    const away = nextGoalBet.values.find((v: any) => v.value === 'Away' || v.value === '2')?.odd;
    const none = nextGoalBet.values.find((v: any) => v.value === 'No Goal' || v.value === 'None')?.odd;
    
    if (home && away) {
      nextGoal = {
        home: parseFloat(home),
        away: parseFloat(away),
        none: none ? parseFloat(none) : 0,
      };
    }
  }
  
  if (!goalsOU && !cornersOU && !nextGoal) return null;
  
  return {
    goalsOU,
    cornersOU,
    nextGoal,
    bookmaker: 'Live',
    lastUpdate: new Date(),
  };
}

export function useFixtureOdds(
  fixtureId: string | number | undefined,
  isGameLive: boolean = false,
  refetchInterval: number = 60000 // 1 minute for live games
): FixtureOddsResult {
  const [preMatch, setPreMatch] = useState<PreMatchOdds | null>(null);
  const [live, setLive] = useState<LiveOdds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedPreMatchRef = useRef(false);
  
  const fetchPreMatchOdds = useCallback(async () => {
    if (!fixtureId) return;
    
    const cacheKey = `prematch-${fixtureId}`;
    
    // Check cache first
    const cached = preMatchOddsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PREMATCH_CACHE_TTL) {
      setPreMatch(cached.odds);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch pre-match odds
      const { data: response, error: invokeError } = await supabase.functions.invoke('api-football', {
        body: { endpoint: 'odds', params: { fixture: fixtureId, bookmaker: BETFAIR_IDS[0] } }
      });
      
      if (invokeError) throw new Error(invokeError.message);
      
      let parsedOdds = extractPreMatchOdds(response?.response || [], PREFERRED_BOOKMAKERS);
      
      // If Betfair not found, try without bookmaker filter
      if (!parsedOdds) {
        const { data: fallbackResponse } = await supabase.functions.invoke('api-football', {
          body: { endpoint: 'odds', params: { fixture: fixtureId } }
        });
        parsedOdds = extractPreMatchOdds(fallbackResponse?.response || [], PREFERRED_BOOKMAKERS);
      }
      
      // Cache odds
      preMatchOddsCache.set(cacheKey, { odds: parsedOdds, timestamp: Date.now() });
      setPreMatch(parsedOdds);
    } catch (err) {
      console.error('Error fetching pre-match odds:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);
  
  const fetchLiveOdds = useCallback(async () => {
    if (!fixtureId || !isGameLive) return;
    
    const cacheKey = `live-${fixtureId}`;
    
    // Check cache first
    const cached = liveOddsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < LIVE_CACHE_TTL) {
      setLive(cached.odds);
      return;
    }
    
    try {
      const { data: response, error: invokeError } = await supabase.functions.invoke('api-football', {
        body: { endpoint: 'odds/live', params: { fixture: fixtureId } }
      });
      
      if (invokeError) throw new Error(invokeError.message);
      
      const parsedOdds = extractLiveOdds(response?.response || []);
      
      // Cache odds
      liveOddsCache.set(cacheKey, { odds: parsedOdds, timestamp: Date.now() });
      setLive(parsedOdds);
    } catch (err) {
      console.error('Error fetching live odds:', err);
      // Don't set error for live odds - pre-match is more important
    }
  }, [fixtureId, isGameLive]);
  
  // Initial pre-match fetch (only once)
  useEffect(() => {
    if (!fixtureId || fetchedPreMatchRef.current) return;
    fetchedPreMatchRef.current = true;
    fetchPreMatchOdds();
  }, [fixtureId, fetchPreMatchOdds]);
  
  // Fetch live odds for live games
  useEffect(() => {
    if (!isGameLive || !fixtureId) return;
    
    // Initial fetch
    fetchLiveOdds();
    
    // Periodic refresh
    const interval = setInterval(fetchLiveOdds, refetchInterval);
    
    return () => clearInterval(interval);
  }, [isGameLive, fixtureId, refetchInterval, fetchLiveOdds]);
  
  const refetch = useCallback(() => {
    fetchPreMatchOdds();
    if (isGameLive) fetchLiveOdds();
  }, [fetchPreMatchOdds, fetchLiveOdds, isGameLive]);
  
  return { preMatch, live, loading, error, refetch };
}

// Legacy hook for backward compatibility
export function useFixtureOddsLegacy(
  fixtureId: string | number | undefined,
  isGameLive: boolean = false
) {
  const { preMatch, loading, error, refetch } = useFixtureOdds(fixtureId, isGameLive);
  
  // Convert to legacy format
  const odds: FixtureOdds | null = preMatch ? {
    matchOdds: preMatch.matchOdds,
    btts: preMatch.btts,
    bookmaker: preMatch.bookmaker,
    bookmakerId: preMatch.bookmakerId,
    isLive: false,
    lastUpdate: new Date().toISOString(),
  } : null;
  
  return { odds, loading, error, refetch };
}
