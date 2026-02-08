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

// Store the latest rate limit data globally (persists across requests)
let lastRateLimit: { limit: number; remaining: number; used: number } | null = null;

// Cache TTL configuration (in milliseconds) - OPTIMIZED to reduce API consumption
const CACHE_TTL = {
  live: 40 * 1000,           // 40 seconds for live games (was 30s) - saves credits
  fixtures_date: 10 * 60 * 1000,  // 10 minutes for fixtures by date (was 5 min)
  fixtures_id: 60 * 1000,    // 60 seconds for specific fixture (was 30s)
  statistics: 60 * 1000,     // 60 seconds for statistics (was 30s)
  events: 60 * 1000,         // 60 seconds for events (was 30s)
  leagues: 24 * 60 * 60 * 1000,  // 24 hours for leagues
  teams: 24 * 60 * 60 * 1000,    // 24 hours for teams
  standings: 60 * 60 * 1000,     // 1 hour for standings
  odds: 10 * 60 * 1000,      // 10 minutes for pre-match odds (was 5 min)
  odds_live: 120 * 1000,     // 120 seconds for live odds (was 60s)
  bookmakers: 24 * 60 * 60 * 1000, // 24 hours for bookmakers list
  default: 5 * 60 * 1000,    // 5 minutes default (was 2 min)
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
      // Include last known rate limit even for cached responses
      return new Response(
        JSON.stringify({ 
          ...cachedData as object, 
          _cached: true,
          _cacheKey: cacheKey,
          _rateLimit: lastRateLimit
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

    // Safe JSON parsing - handle non-JSON responses (e.g. 503 upstream errors)
    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(`[API-Football] Non-JSON response (${response.status}):`, responseText.substring(0, 200));
      throw new Error(`API-Football returned non-JSON response (${response.status}): ${responseText.substring(0, 100)}`);
    }

    // Extract rate limit headers from API-Football response
    const rateLimitLimit = parseInt(response.headers.get('x-ratelimit-requests-limit') || '0', 10);
    const rateLimitRemaining = parseInt(response.headers.get('x-ratelimit-requests-remaining') || '0', 10);
    const rateLimitUsed = rateLimitLimit > 0 ? rateLimitLimit - rateLimitRemaining : 0;

    if (!response.ok) {
      console.error('API-Football error:', JSON.stringify(data));
      throw new Error(`API-Football error: ${data.message || response.statusText}`);
    }

    // Check for API errors in response
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error('API-Football errors:', JSON.stringify(data.errors));
      // Still return the data, let frontend handle the errors
    }

    // Log rate limit info from headers (real API usage) and store globally
    if (rateLimitLimit > 0) {
      console.log(`[RATE LIMIT] Used: ${rateLimitUsed}/${rateLimitLimit}, Remaining: ${rateLimitRemaining}`);
      // Store globally so cache hits can also return rate limit data
      lastRateLimit = {
        limit: rateLimitLimit,
        remaining: rateLimitRemaining,
        used: rateLimitUsed
      };
    } else if (data.paging) {
      console.log(`[RATE LIMIT] Paging: ${data.paging.current}/${data.paging.total}`);
    }

    // Cache the result
    const ttl = getTTL(endpoint, params);
    setCache(cacheKey, data, ttl);
    console.log(`[CACHED] ${cacheKey} for ${ttl/1000}s`);

    // Include rate limit data in response for frontend tracking
    const responseData = {
      ...data,
      _rateLimit: rateLimitLimit > 0 ? {
        limit: rateLimitLimit,
        remaining: rateLimitRemaining,
        used: rateLimitUsed
      } : null
    };

    return new Response(
      JSON.stringify(responseData),
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
