import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache storage with TTL
interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry>();

// Cache TTL configuration (in milliseconds)
const CACHE_TTL = {
  live: 15 * 1000,           // 15 seconds for live games
  fixtures_date: 2 * 60 * 1000,  // 2 minutes for fixtures by date
  fixtures_id: 15 * 1000,    // 15 seconds for specific fixture
  statistics: 15 * 1000,     // 15 seconds for statistics
  events: 15 * 1000,         // 15 seconds for events
  leagues: 24 * 60 * 60 * 1000,  // 24 hours for leagues
  teams: 24 * 60 * 60 * 1000,    // 24 hours for teams
  standings: 60 * 60 * 1000,     // 1 hour for standings
  odds: 5 * 60 * 1000,       // 5 minutes for pre-match odds
  odds_live: 30 * 1000,      // 30 seconds for live odds
  bookmakers: 24 * 60 * 60 * 1000, // 24 hours for bookmakers list
  default: 60 * 1000,        // 1 minute default
};

function getCacheKey(endpoint: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return `${endpoint}?${sortedParams}`;
}

function getTTL(endpoint: string, params: Record<string, unknown>): number {
  // Live games
  if (params.live === 'all') {
    return CACHE_TTL.live;
  }
  
  // Specific fixture
  if (endpoint === 'fixtures' && params.id) {
    return CACHE_TTL.fixtures_id;
  }
  
  // Fixtures by date
  if (endpoint === 'fixtures' && params.date) {
    return CACHE_TTL.fixtures_date;
  }
  
  // Statistics
  if (endpoint === 'fixtures/statistics') {
    return CACHE_TTL.statistics;
  }
  
  // Events
  if (endpoint === 'fixtures/events') {
    return CACHE_TTL.events;
  }
  
  // Leagues
  if (endpoint === 'leagues') {
    return CACHE_TTL.leagues;
  }
  
  // Teams
  if (endpoint === 'teams') {
    return CACHE_TTL.teams;
  }
  
  // Standings
  if (endpoint === 'standings') {
    return CACHE_TTL.standings;
  }
  
  // Odds
  if (endpoint === 'odds') {
    return CACHE_TTL.odds;
  }
  
  // Live odds
  if (endpoint === 'odds/live') {
    return CACHE_TTL.odds_live;
  }
  
  // Bookmakers
  if (endpoint === 'bookmakers') {
    return CACHE_TTL.bookmakers;
  }
  
  return CACHE_TTL.default;
}

function getFromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(key: string, data: unknown, ttl: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
  
  // Cleanup old entries (keep cache size manageable)
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > v.ttl) {
        cache.delete(k);
      }
    }
  }
}

interface ApiFootballRequest {
  endpoint: string;
  params?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, params = {} }: ApiFootballRequest = await req.json();
    
    if (!endpoint) {
      throw new Error('Endpoint is required');
    }
    
    const apiKey = Deno.env.get('API_FOOTBALL_KEY');
    if (!apiKey) {
      console.error('API_FOOTBALL_KEY not configured');
      throw new Error('API_FOOTBALL_KEY not configured');
    }

    // Build cache key
    const cacheKey = getCacheKey(endpoint, params);
    
    // Check cache
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log(`[CACHE HIT] ${cacheKey}`);
      return new Response(
        JSON.stringify({ 
          ...cachedData as object, 
          _cached: true,
          _cacheKey: cacheKey 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CACHE MISS] ${cacheKey}`);

    // Build query string
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    }
    
    // Only add timezone for the main fixtures endpoint (not fixtures/events or fixtures/statistics)
    if (endpoint === 'fixtures' && !params.timezone) {
      queryParams.append('timezone', 'America/Sao_Paulo');
    }

    const apiUrl = `https://v3.football.api-sports.io/${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    console.log(`[API CALL] ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API-Football error:', JSON.stringify(data));
      throw new Error(`API-Football error: ${data.message || response.statusText}`);
    }

    // Check for API errors in response
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error('API-Football errors:', JSON.stringify(data.errors));
      // Still return the data, let frontend handle the errors
    }

    // Log rate limit info
    if (data.paging) {
      console.log(`[RATE LIMIT] Current: ${data.paging.current}/${data.paging.total}`);
    }

    // Cache the result
    const ttl = getTTL(endpoint, params);
    setCache(cacheKey, data, ttl);
    console.log(`[CACHED] ${cacheKey} for ${ttl/1000}s`);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in api-football function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        errors: { request: errorMessage },
        response: [],
        results: 0
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
