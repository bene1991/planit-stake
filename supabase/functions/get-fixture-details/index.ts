import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Status codes that indicate a finished game (cache forever)
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'INT'];

// Status codes that indicate a live game (cache for 90s)
const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'LIVE'];

// Cache TTL in seconds
const LIVE_CACHE_TTL = 90;

interface NormalizedStats {
  home: StatValues;
  away: StatValues;
}

interface StatValues {
  possession: number;
  shots_total: number;
  shots_on: number;
  shots_off: number;
  shots_blocked: number;
  corners: number;
  fouls: number;
  yellow: number;
  red: number;
  offsides: number;
}

interface MomentumPoint {
  m: number;
  home: number;
  away: number;
}

interface KeyEvent {
  minute: number;
  team: 'home' | 'away';
  type: 'goal' | 'shot_on' | 'red_card';
  player?: string;
  detail?: string;
}

interface ApiEvent {
  time: { elapsed: number; extra?: number };
  team: { id: number; name: string };
  type: string;
  detail: string;
  player?: { id: number; name: string };
  assist?: { id: number; name: string };
}

interface ApiStatistic {
  type: string;
  value: string | number | null;
}

// Stat type mapping from API-Football to our normalized format
const STAT_MAPPING: Record<string, keyof StatValues> = {
  'Ball Possession': 'possession',
  'Total Shots': 'shots_total',
  'Shots on Goal': 'shots_on',
  'Shots off Goal': 'shots_off',
  'Blocked Shots': 'shots_blocked',
  'Corner Kicks': 'corners',
  'Fouls': 'fouls',
  'Yellow Cards': 'yellow',
  'Red Cards': 'red',
  'Offsides': 'offsides',
};

// Event weights for momentum calculation (increased for more intensity variation)
const EVENT_WEIGHTS: Record<string, number> = {
  'Goal': 15,
  'Normal Goal': 15,
  'Penalty': 15,
  'Own Goal': 15,
  'Shot on Goal': 6,
  'Shot': 3,
  'Corner': 3,
  'Red Card': 6,
};

function normalizeStatValue(value: string | number | null): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  // Handle percentage strings like "52%"
  const numericValue = parseInt(value.replace('%', ''), 10);
  return isNaN(numericValue) ? 0 : numericValue;
}

interface ApiTeamStats {
  team?: { id: number; name: string };
  statistics?: ApiStatistic[];
}

function normalizeStatistics(statsRaw: ApiTeamStats[]): NormalizedStats {
  const defaultStats: StatValues = {
    possession: 0,
    shots_total: 0,
    shots_on: 0,
    shots_off: 0,
    shots_blocked: 0,
    corners: 0,
    fouls: 0,
    yellow: 0,
    red: 0,
    offsides: 0,
  };

  const result: NormalizedStats = {
    home: { ...defaultStats },
    away: { ...defaultStats },
  };

  if (!Array.isArray(statsRaw) || statsRaw.length < 2) {
    return result;
  }

  // API returns array with [home, away] team stats
  const homeStats = statsRaw[0]?.statistics || [];
  const awayStats = statsRaw[1]?.statistics || [];

  for (const stat of homeStats) {
    const key = STAT_MAPPING[stat.type];
    if (key) {
      result.home[key] = normalizeStatValue(stat.value);
    }
  }

  for (const stat of awayStats) {
    const key = STAT_MAPPING[stat.type];
    if (key) {
      result.away[key] = normalizeStatValue(stat.value);
    }
  }

  return result;
}

function getEventWeight(type: string, detail: string): number {
  // Check for goals
  if (type === 'Goal') {
    return EVENT_WEIGHTS['Goal'];
  }
  
  // Check for shots
  if (type === 'Shot' || type === 'shot') {
    if (detail?.toLowerCase().includes('on goal') || detail?.toLowerCase().includes('saved')) {
      return EVENT_WEIGHTS['Shot on Goal'];
    }
    return EVENT_WEIGHTS['Shot'];
  }

  // Check for corners
  if (type === 'Corner' || detail?.toLowerCase().includes('corner')) {
    return EVENT_WEIGHTS['Corner'];
  }

  // Check for red cards
  if (type === 'Card' && detail?.toLowerCase().includes('red')) {
    return EVENT_WEIGHTS['Red Card'];
  }

  return EVENT_WEIGHTS[type] || 0;
}

function calculateMomentum(events: ApiEvent[], homeTeamId: number, maxMinute: number): MomentumPoint[] {
  const totalMinutes = Math.max(maxMinute, 45); // At least 45 minutes
  const rawMomentum: { home: number[]; away: number[] } = {
    home: new Array(totalMinutes + 1).fill(0),
    away: new Array(totalMinutes + 1).fill(0),
  };

  // Accumulate event weights by minute
  for (const event of events) {
    const minute = event.time?.elapsed || 0;
    if (minute < 1 || minute > totalMinutes) continue;

    const weight = getEventWeight(event.type, event.detail);
    if (weight === 0) continue;

    const isHome = event.team?.id === homeTeamId;
    
    // Red cards benefit the opposing team
    if (event.type === 'Card' && event.detail?.toLowerCase().includes('red')) {
      if (isHome) {
        rawMomentum.away[minute] += weight;
      } else {
        rawMomentum.home[minute] += weight;
      }
    } else {
      if (isHome) {
        rawMomentum.home[minute] += weight;
      } else {
        rawMomentum.away[minute] += weight;
      }
    }
  }

  // Apply 3-minute moving average smoothing (reduced from 5 to preserve intensity peaks)
  const smoothed: MomentumPoint[] = [];
  for (let m = 1; m <= totalMinutes; m++) {
    let homeSum = 0;
    let awaySum = 0;
    let count = 0;

    // Reduced window: m-1 to m+1 (3 minutes)
    for (let i = Math.max(1, m - 1); i <= Math.min(totalMinutes, m + 1); i++) {
      homeSum += rawMomentum.home[i];
      awaySum += rawMomentum.away[i];
      count++;
    }

    smoothed.push({
      m,
      home: count > 0 ? homeSum / count : 0,
      away: count > 0 ? awaySum / count : 0,
    });
  }

  return smoothed;
}

function extractKeyEvents(events: ApiEvent[], homeTeamId: number): KeyEvent[] {
  const keyEvents: KeyEvent[] = [];

  for (const event of events) {
    const minute = event.time?.elapsed || 0;
    if (minute < 1) continue;

    const isHome = event.team?.id === homeTeamId;
    const team: 'home' | 'away' = isHome ? 'home' : 'away';

    // Goals
    if (event.type === 'Goal') {
      keyEvents.push({
        minute,
        team,
        type: 'goal',
        player: event.player?.name,
        detail: event.detail,
      });
    }

    // Red cards
    if (event.type === 'Card' && event.detail?.toLowerCase().includes('red')) {
      keyEvents.push({
        minute,
        team,
        type: 'red_card',
        player: event.player?.name,
      });
    }
  }

  return keyEvents;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fixture_id } = await req.json();
    
    if (!fixture_id) {
      throw new Error('fixture_id is required');
    }

    const fixtureIdNum = parseInt(String(fixture_id), 10);
    if (isNaN(fixtureIdNum)) {
      throw new Error('fixture_id must be a number');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiFootballKey = Deno.env.get('API_FOOTBALL_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache first
    const { data: cached, error: cacheError } = await supabase
      .from('fixture_cache')
      .select('*')
      .eq('fixture_id', fixtureIdNum)
      .maybeSingle();

    if (cacheError) {
      console.error('Cache lookup error:', cacheError);
    }

    const now = new Date();

    // If cache exists, check if we should use it
    if (cached) {
      const isFinished = FINISHED_STATUSES.includes(cached.status);
      const updatedAt = new Date(cached.updated_at);
      const ageSeconds = (now.getTime() - updatedAt.getTime()) / 1000;

      // Finished games: return cache immediately
      if (isFinished) {
        console.log(`[CACHE HIT] Finished game ${fixtureIdNum}`);
        return new Response(JSON.stringify({
          fixture_id: cached.fixture_id,
          status: cached.status,
          minute_now: cached.minute_now,
          normalized_stats: cached.normalized_stats,
          momentum_series: cached.momentum_series,
          key_events: cached.key_events || [],
          cached: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Live games: check if cache is fresh enough
      if (LIVE_STATUSES.includes(cached.status) && ageSeconds < LIVE_CACHE_TTL) {
        console.log(`[CACHE HIT] Live game ${fixtureIdNum}, age ${ageSeconds}s`);
        return new Response(JSON.stringify({
          fixture_id: cached.fixture_id,
          status: cached.status,
          minute_now: cached.minute_now,
          normalized_stats: cached.normalized_stats,
          momentum_series: cached.momentum_series,
          key_events: cached.key_events || [],
          cached: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Need to fetch from API
    if (!apiFootballKey) {
      throw new Error('API_FOOTBALL_KEY not configured');
    }

    console.log(`[API FETCH] Fetching fixture ${fixtureIdNum}`);

    // Fetch fixture info, statistics, and events in parallel
    const [fixtureRes, statsRes, eventsRes] = await Promise.all([
      fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureIdNum}`, {
        headers: { 'x-apisports-key': apiFootballKey },
      }),
      fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureIdNum}`, {
        headers: { 'x-apisports-key': apiFootballKey },
      }),
      fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureIdNum}`, {
        headers: { 'x-apisports-key': apiFootballKey },
      }),
    ]);

    const [fixtureData, statsData, eventsData] = await Promise.all([
      fixtureRes.json(),
      statsRes.json(),
      eventsRes.json(),
    ]);

    // Extract fixture info
    const fixture = fixtureData.response?.[0];
    if (!fixture) {
      // Return 404 with empty data instead of throwing error
      console.log(`[NOT FOUND] Fixture ${fixtureIdNum} not found in API`);
      return new Response(JSON.stringify({
        fixture_id: fixtureIdNum,
        status: 'NOT_FOUND',
        minute_now: 0,
        normalized_stats: { home: {}, away: {} },
        momentum_series: [],
        key_events: [],
        cached: false,
        error: 'Fixture not found in API',
      }), { 
        status: 200, // Return 200 so client can handle gracefully
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const status = fixture.fixture?.status?.short || 'NS';
    const minuteNow = fixture.fixture?.status?.elapsed || 0;
    const homeTeamId = fixture.teams?.home?.id;

    // Process statistics
    const statsRaw = statsData.response || [];
    const normalizedStats = normalizeStatistics(statsRaw);

    // Process events, calculate momentum, and extract key events
    const eventsRaw = eventsData.response || [];
    const momentumSeries = calculateMomentum(eventsRaw, homeTeamId, minuteNow);
    const keyEvents = extractKeyEvents(eventsRaw, homeTeamId);

    // Upsert to cache
    const cacheData = {
      fixture_id: fixtureIdNum,
      updated_at: now.toISOString(),
      status,
      minute_now: minuteNow,
      events_raw: eventsRaw,
      stats_raw: statsRaw,
      key_events: keyEvents,
      momentum_series: momentumSeries,
      normalized_stats: normalizedStats,
    };

    const { error: upsertError } = await supabase
      .from('fixture_cache')
      .upsert(cacheData, { onConflict: 'fixture_id' });

    if (upsertError) {
      console.error('Cache upsert error:', upsertError);
    } else {
      console.log(`[CACHED] Fixture ${fixtureIdNum}`);
    }

    return new Response(JSON.stringify({
      fixture_id: fixtureIdNum,
      status,
      minute_now: minuteNow,
      normalized_stats: normalizedStats,
      momentum_series: momentumSeries,
      key_events: keyEvents,
      cached: false,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in get-fixture-details:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});