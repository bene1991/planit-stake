import { supabase } from '@/integrations/supabase/client';

export interface BttsOddsResult {
  yes: number;
  no: number;
  bookmaker: string;
  isBetfair: boolean;
}

/**
 * Fetches BTTS odds from The Odds API for a given game.
 * This is meant to be called ONCE when adding a game to planning.
 * The result should be saved to the database permanently.
 */
export async function fetchBttsOdds(
  homeTeam: string,
  awayTeam: string,
  league: string
): Promise<BttsOddsResult | null> {
  try {
    console.log(`[useTheOddsBtts] Fetching BTTS for ${homeTeam} vs ${awayTeam} (${league})`);
    
    const { data, error } = await supabase.functions.invoke('the-odds-api', {
      body: { 
        action: 'get_btts',
        homeTeam,
        awayTeam,
        league,
      }
    });
    
    if (error) {
      console.error('[useTheOddsBtts] Error calling edge function:', error);
      return null;
    }
    
    if (!data?.btts) {
      console.log('[useTheOddsBtts] No BTTS data returned:', data?.error);
      return null;
    }
    
    console.log('[useTheOddsBtts] BTTS fetched successfully:', data.btts);
    
    if (data.creditsRemaining !== null) {
      console.log(`[useTheOddsBtts] API credits remaining: ${data.creditsRemaining}`);
    }
    
    return {
      yes: data.btts.yes,
      no: data.btts.no,
      bookmaker: data.btts.bookmaker,
      isBetfair: data.btts.isBetfair,
    };
  } catch (err) {
    console.error('[useTheOddsBtts] Unexpected error:', err);
    return null;
  }
}
