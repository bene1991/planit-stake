import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// L1: In-memory cache (fast, per-instance)
interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}
const cache = new Map<string, CacheEntry>();

// Store the latest rate limit data globally
let lastRateLimit: { limit: number; remaining: number; used: number } | null = null;

// Cache TTL configuration (in milliseconds)
const CACHE_TTL: Record<string, number> = {
  live: 40 * 1000,
  fixtures_date: 10 * 60 * 1000,
  fixtures_id: 60 * 1000,
  statistics: 60 * 1000,
  events: 60 * 1000,
  leagues: 24 * 60 * 60 * 1000,
  teams: 24 * 60 * 60 * 1000,
  standings: 60 * 60 * 1000,
  odds: 10 * 60 * 1000,
  odds_live: 120 * 1000,
  bookmakers: 24 * 60 * 60 * 1000,
  default: 5 * 60 * 1000,
};

function getCacheKey(endpoint: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return `${endpoint}?${sortedParams}`;
}

function getTTL(endpoint: string, params: Record<string, unknown>): number {
  if (params.live === 'all') return CACHE_TTL.live;
  if (endpoint === 'fixtures' && params.id) return CACHE_TTL.fixtures_id;
  if (endpoint === 'fixtures' && params.date) return CACHE_TTL.fixtures_date;
  if (endpoint === 'fixtures/statistics') return CACHE_TTL.statistics;
  if (endpoint === 'fixtures/events') return CACHE_TTL.events;
  if (endpoint === 'leagues') return CACHE_TTL.leagues;
  if (endpoint === 'teams') return CACHE_TTL.teams;
  if (endpoint === 'standings') return CACHE_TTL.standings;
  if (endpoint === 'odds') return CACHE_TTL.odds;
  if (endpoint === 'odds/live') return CACHE_TTL.odds_live;
  if (endpoint === 'bookmakers') return CACHE_TTL.bookmakers;
  return CACHE_TTL.default;
}

// L1: In-memory cache helpers
function getFromL1(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setL1(key: string, data: unknown, ttl: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > v.ttl) cache.delete(k);
    }
  }
}

// L2: Database cache helpers
function getSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey);
}

async function getFromL2(key: string): Promise<unknown | null> {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('api_cache')
      .select('response_data')
      .eq('cache_key', key)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;
    return data.response_data;
  } catch (err) {
    console.error('[L2 Cache] Read error:', err);
    return null;
  }
}

async function setL2(key: string, data: unknown, ttlMs: number): Promise<void> {
  try {
    const sb = getSupabaseClient();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    await sb
      .from('api_cache')
      .upsert({
        cache_key: key,
        response_data: data,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      }, { onConflict: 'cache_key' });
  } catch (err) {
    console.error('[L2 Cache] Write error:', err);
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
    
    if (!endpoint) throw new Error('Endpoint is required');
    
    const apiKey = Deno.env.get('API_FOOTBALL_KEY');
    if (!apiKey) throw new Error('API_FOOTBALL_KEY not configured');

    const cacheKey = getCacheKey(endpoint, params);
    const ttl = getTTL(endpoint, params);
    
    // L1: Check in-memory cache first (fastest)
    const l1Data = getFromL1(cacheKey);
    if (l1Data) {
      console.log(`[L1 HIT] ${cacheKey}`);
      return new Response(
        JSON.stringify({ ...l1Data as object, _cached: true, _cacheKey: cacheKey, _rateLimit: lastRateLimit }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // L2: Check database cache (persistent across instances)
    const l2Data = await getFromL2(cacheKey);
    if (l2Data) {
      console.log(`[L2 HIT] ${cacheKey}`);
      // Warm L1 with L2 data
      setL1(cacheKey, l2Data, ttl);
      return new Response(
        JSON.stringify({ ...l2Data as object, _cached: true, _cacheKey: cacheKey, _rateLimit: lastRateLimit }),
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
    
    if (endpoint === 'fixtures' && !params.timezone) {
      queryParams.append('timezone', 'America/Sao_Paulo');
    }

    const apiUrl = `https://v3.football.api-sports.io/${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    console.log(`[API CALL] ${apiUrl}`);

    // Fetch with retry for transient errors (503, 502, etc.)
    let response: Response | null = null;
    let data: any;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'x-apisports-key': apiKey },
      });

      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
        break; // success
      } catch {
        console.error(`[API-Football] Attempt ${attempt}/${maxRetries} Non-JSON response (${response.status}):`, responseText.substring(0, 200));
        if (attempt < maxRetries && (response.status >= 500 || response.status === 0)) {
          const delay = attempt * 1000;
          console.log(`[API-Football] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`API-Football returned non-JSON response (${response.status}): ${responseText.substring(0, 100)}`);
      }
    }

    // Extract rate limit headers
    const rateLimitLimit = parseInt(response.headers.get('x-ratelimit-requests-limit') || '0', 10);
    const rateLimitRemaining = parseInt(response.headers.get('x-ratelimit-requests-remaining') || '0', 10);
    const rateLimitUsed = rateLimitLimit > 0 ? rateLimitLimit - rateLimitRemaining : 0;

    if (!response.ok) {
      console.error('API-Football error:', JSON.stringify(data));
      throw new Error(`API-Football error: ${data.message || response.statusText}`);
    }

    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error('API-Football errors:', JSON.stringify(data.errors));
    }

    if (rateLimitLimit > 0) {
      console.log(`[RATE LIMIT] Used: ${rateLimitUsed}/${rateLimitLimit}, Remaining: ${rateLimitRemaining}`);
      lastRateLimit = { limit: rateLimitLimit, remaining: rateLimitRemaining, used: rateLimitUsed };
    }

    // Save to both L1 and L2 caches
    setL1(cacheKey, data, ttl);
    setL2(cacheKey, data, ttl); // fire-and-forget
    console.log(`[CACHED L1+L2] ${cacheKey} for ${ttl / 1000}s`);

    const responseData = {
      ...data,
      _rateLimit: rateLimitLimit > 0 ? { limit: rateLimitLimit, remaining: rateLimitRemaining, used: rateLimitUsed } : null
    };

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in api-football function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorMessage, errors: { request: errorMessage }, response: [], results: 0 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
