const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

let sessionToken: string | null = null;
let tokenTimestamp = 0;
const TOKEN_TTL = 4 * 60 * 60 * 1000;
const MATCHBOOK_BASE = 'https://api.matchbook.com';

function isTokenValid(): boolean {
  return !!sessionToken && (Date.now() - tokenTimestamp) < TOKEN_TTL;
}

async function doLogin(): Promise<string> {
  const username = Deno.env.get('MATCHBOOK_USERNAME');
  const password = Deno.env.get('MATCHBOOK_PASSWORD');
  if (!username || !password) throw new Error('Matchbook credentials not configured');

  const res = await fetch(`${MATCHBOOK_BASE}/bpapi/rest/security/session`, {
    method: 'POST',
    headers: { 'accept': 'application/json', 'content-type': 'application/json', 'User-Agent': 'api-doc-test-client' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const token = data['session-token'] || data['sessionToken'] || null;
  if (!token) throw new Error('No session-token in response');

  sessionToken = token;
  tokenTimestamp = Date.now();
  return token;
}

async function ensureToken(): Promise<string> {
  if (!isTokenValid()) return await doLogin();
  return sessionToken!;
}

async function fetchWithAuth(url: string, retry = true): Promise<Response> {
  const token = await ensureToken();
  const res = await fetch(url, {
    headers: { 'accept': 'application/json', 'User-Agent': 'api-doc-test-client', 'session-token': token },
  });
  if (res.status === 401 && retry) {
    sessionToken = null;
    return fetchWithAuth(url, false);
  }
  return res;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'login') {
      await doLogin();
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'events') {
      const sport = url.searchParams.get('sport') || '1';
      const res = await fetchWithAuth(`${MATCHBOOK_BASE}/edge/rest/events?category-ids=${sport}&states=open&per-page=50`);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Events fetch failed (${res.status}): ${t}`);
      }
      const data = await res.json();
      const events = (data.events || []).map((e: Record<string, unknown>) => ({
        event_id: e.id,
        event_name: e.name,
        start_time: e.start,
      }));
      return new Response(JSON.stringify({ events }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'correct-score-lay') {
      const eventId = url.searchParams.get('event_id');
      if (!eventId) throw new Error('event_id required');

      const marketsRes = await fetchWithAuth(`${MATCHBOOK_BASE}/edge/rest/events/${eventId}/markets`);
      if (!marketsRes.ok) {
        const t = await marketsRes.text();
        throw new Error(`Markets fetch failed (${marketsRes.status}): ${t}`);
      }
      const marketsData = await marketsRes.json();
      const markets = marketsData.markets || [];
      const csMarket = markets.find((m: Record<string, unknown>) => {
        const name = String(m.name || '').toLowerCase();
        const mtype = String(m['market-type'] || '').toLowerCase();
        return name.includes('correct score') || mtype.includes('correct_score');
      });

      if (!csMarket) {
        return new Response(JSON.stringify({ scores: [], message: 'Correct Score market not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const runners = csMarket.runners || [];
      const scores = runners
        .map((r: Record<string, unknown>) => {
          const prices = (r.prices || []) as Array<Record<string, unknown>>;
          const layPrice = prices.find((p) => p.side === 'lay');
          return {
            score: r.name,
            lay_price: layPrice ? (layPrice.odds || layPrice.price || null) : null,
            lay_available: layPrice ? (layPrice['available-amount'] || layPrice['availableAmount'] || 0) : 0,
          };
        })
        .filter((s: Record<string, unknown>) => s.lay_price !== null)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (a.lay_price as number) - (b.lay_price as number));

      return new Response(JSON.stringify({ scores, market_name: csMarket.name }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: login, events, correct-score-lay' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
