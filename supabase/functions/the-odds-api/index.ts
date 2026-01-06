import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapping from league names to The Odds API sport keys
const LEAGUE_MAPPING: Record<string, string> = {
  // Brazil
  'serie a': 'soccer_brazil_campeonato',
  'brasileirão': 'soccer_brazil_campeonato',
  'serie b': 'soccer_brazil_serie_b',
  'copa do brasil': 'soccer_brazil_copa_do_brasil',
  
  // Europe
  'premier league': 'soccer_epl',
  'la liga': 'soccer_spain_la_liga',
  'bundesliga': 'soccer_germany_bundesliga',
  'ligue 1': 'soccer_france_ligue_one',
  'serie a italy': 'soccer_italy_serie_a',
  'italian serie a': 'soccer_italy_serie_a',
  
  // International
  'champions league': 'soccer_uefa_champs_league',
  'uefa champions league': 'soccer_uefa_champs_league',
  'europa league': 'soccer_uefa_europa_league',
  'uefa europa league': 'soccer_uefa_europa_league',
  'conference league': 'soccer_uefa_europa_conference_league',
  
  // South America
  'libertadores': 'soccer_conmebol_libertadores',
  'copa libertadores': 'soccer_conmebol_libertadores',
  'sudamericana': 'soccer_conmebol_sudamericana',
  'copa sudamericana': 'soccer_conmebol_sudamericana',
};

function getSportKeyFromLeague(league: string): string | null {
  const normalizedLeague = league.toLowerCase().trim();
  
  // Direct match
  if (LEAGUE_MAPPING[normalizedLeague]) {
    return LEAGUE_MAPPING[normalizedLeague];
  }
  
  // Partial match
  for (const [key, value] of Object.entries(LEAGUE_MAPPING)) {
    if (normalizedLeague.includes(key) || key.includes(normalizedLeague)) {
      return value;
    }
  }
  
  return null;
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/fc|sc|ac|cf|afc|bsc/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function teamsMatch(apiTeam: string, searchTeam: string): boolean {
  const normalizedApi = normalizeTeamName(apiTeam);
  const normalizedSearch = normalizeTeamName(searchTeam);
  
  // Exact match
  if (normalizedApi === normalizedSearch) return true;
  
  // Contains match
  if (normalizedApi.includes(normalizedSearch) || normalizedSearch.includes(normalizedApi)) return true;
  
  // Check if first 4 characters match (for abbreviations)
  if (normalizedApi.length >= 4 && normalizedSearch.length >= 4) {
    if (normalizedApi.substring(0, 4) === normalizedSearch.substring(0, 4)) return true;
  }
  
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, league, homeTeam, awayTeam, sportKey } = await req.json();
    const apiKey = Deno.env.get('THE_ODDS_API_KEY');
    
    if (!apiKey) {
      throw new Error('THE_ODDS_API_KEY not configured');
    }

    console.log(`[the-odds-api] Action: ${action}, League: ${league}, Home: ${homeTeam}, Away: ${awayTeam}`);

    // Get sport key from league name if not provided
    const resolvedSportKey = sportKey || getSportKeyFromLeague(league || '');
    
    if (!resolvedSportKey) {
      console.log(`[the-odds-api] League not mapped: ${league}`);
      return new Response(JSON.stringify({ 
        btts: null, 
        error: 'Liga não suportada',
        league,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[the-odds-api] Resolved sport key: ${resolvedSportKey}`);

    if (action === 'get_btts') {
      // Step 1: Get events for this sport
      const eventsUrl = `https://api.the-odds-api.com/v4/sports/${resolvedSportKey}/events?apiKey=${apiKey}`;
      console.log(`[the-odds-api] Fetching events from: ${eventsUrl.replace(apiKey, 'API_KEY')}`);
      
      const eventsResponse = await fetch(eventsUrl);
      
      if (!eventsResponse.ok) {
        const errorText = await eventsResponse.text();
        console.error(`[the-odds-api] Events API error: ${eventsResponse.status} - ${errorText}`);
        throw new Error(`Events API error: ${eventsResponse.status}`);
      }
      
      const events = await eventsResponse.json();
      console.log(`[the-odds-api] Found ${events.length} events for ${resolvedSportKey}`);
      
      // Find matching event by team names
      const matchingEvent = events.find((event: any) => {
        const homeMatch = teamsMatch(event.home_team, homeTeam);
        const awayMatch = teamsMatch(event.away_team, awayTeam);
        
        if (homeMatch && awayMatch) {
          console.log(`[the-odds-api] Found match: ${event.home_team} vs ${event.away_team}`);
          return true;
        }
        
        // Also try reverse (home/away swapped)
        const reverseHome = teamsMatch(event.home_team, awayTeam);
        const reverseAway = teamsMatch(event.away_team, homeTeam);
        
        if (reverseHome && reverseAway) {
          console.log(`[the-odds-api] Found reverse match: ${event.home_team} vs ${event.away_team}`);
          return true;
        }
        
        return false;
      });
      
      if (!matchingEvent) {
        console.log(`[the-odds-api] No matching event found for ${homeTeam} vs ${awayTeam}`);
        return new Response(JSON.stringify({ 
          btts: null, 
          error: 'Evento não encontrado',
          homeTeam,
          awayTeam,
          sportKey: resolvedSportKey,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Step 2: Get BTTS odds for this event
      const oddsUrl = new URL(`https://api.the-odds-api.com/v4/sports/${resolvedSportKey}/events/${matchingEvent.id}/odds`);
      oddsUrl.searchParams.set('apiKey', apiKey);
      oddsUrl.searchParams.set('regions', 'uk,eu');
      oddsUrl.searchParams.set('markets', 'btts');
      oddsUrl.searchParams.set('oddsFormat', 'decimal');
      
      console.log(`[the-odds-api] Fetching BTTS odds for event: ${matchingEvent.id}`);
      
      const oddsResponse = await fetch(oddsUrl.toString());
      
      if (!oddsResponse.ok) {
        const errorText = await oddsResponse.text();
        console.error(`[the-odds-api] Odds API error: ${oddsResponse.status} - ${errorText}`);
        throw new Error(`Odds API error: ${oddsResponse.status}`);
      }
      
      const oddsData = await oddsResponse.json();
      const creditsRemaining = oddsResponse.headers.get('x-requests-remaining');
      const creditsUsed = oddsResponse.headers.get('x-requests-used');
      
      console.log(`[the-odds-api] Credits remaining: ${creditsRemaining}, used: ${creditsUsed}`);
      
      // Extract BTTS odds - prioritize Betfair Exchange
      const bookmakers = oddsData.bookmakers || [];
      
      if (bookmakers.length === 0) {
        console.log(`[the-odds-api] No bookmakers with BTTS odds for this event`);
        return new Response(JSON.stringify({ 
          btts: null, 
          error: 'BTTS não disponível',
          creditsRemaining,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Sort bookmakers to prioritize Betfair
      const sortedBookmakers = bookmakers.sort((a: any, b: any) => {
        const aIsBetfair = a.key.toLowerCase().includes('betfair');
        const bIsBetfair = b.key.toLowerCase().includes('betfair');
        if (aIsBetfair && !bIsBetfair) return -1;
        if (!aIsBetfair && bIsBetfair) return 1;
        return 0;
      });
      
      const selectedBookmaker = sortedBookmakers[0];
      const bttsMarket = selectedBookmaker.markets?.find((m: any) => m.key === 'btts');
      
      if (!bttsMarket) {
        console.log(`[the-odds-api] No BTTS market in selected bookmaker`);
        return new Response(JSON.stringify({ 
          btts: null, 
          error: 'BTTS não disponível neste bookmaker',
          creditsRemaining,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const yesOutcome = bttsMarket.outcomes.find((o: any) => o.name === 'Yes');
      const noOutcome = bttsMarket.outcomes.find((o: any) => o.name === 'No');
      
      const bttsResult = {
        yes: yesOutcome?.price || null,
        no: noOutcome?.price || null,
        bookmaker: selectedBookmaker.title,
        bookmakerKey: selectedBookmaker.key,
        isBetfair: selectedBookmaker.key.toLowerCase().includes('betfair'),
        lastUpdate: bttsMarket.last_update,
        eventId: matchingEvent.id,
        eventHomeTeam: matchingEvent.home_team,
        eventAwayTeam: matchingEvent.away_team,
      };
      
      console.log(`[the-odds-api] BTTS result:`, bttsResult);
      
      return new Response(JSON.stringify({ 
        btts: bttsResult,
        creditsRemaining: creditsRemaining ? parseInt(creditsRemaining) : null,
        creditsUsed: creditsUsed ? parseInt(creditsUsed) : null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('[the-odds-api] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      btts: null,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
