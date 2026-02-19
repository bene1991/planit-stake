import "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, method = 'GET', headers = {}, body } = await req.json();

    if (!url || !url.startsWith('https://api.matchbook.com')) {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[matchbook-proxy] ${method} ${url}`);

    const fetchHeaders: Record<string, string> = {
      'User-Agent': BROWSER_UA,
      'Accept': '*/*',
      'Accept-Language': 'en-GB,en;q=0.9',
      ...headers,
    };

    const fetchOptions: RequestInit = {
      method,
      headers: fetchHeaders,
      redirect: 'manual',
    };

    if (body && method !== 'GET') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    console.log(`[matchbook-proxy] status=${response.status}`);

    // Detect redirect (geo-block)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location') || 'unknown';
      console.log(`[matchbook-proxy] REDIRECT to ${location}`);
      // Consume body to avoid leak
      try { await response.text(); } catch {}
      return new Response(JSON.stringify({
        error: `Geo-redirect detectado: servidor redirecionou para ${location}. A API Matchbook está bloqueando por localização do servidor.`,
        status: response.status,
        redirect_location: location,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const responseText = await response.text();
    console.log(`[matchbook-proxy] body preview: ${responseText.substring(0, 150)}`);

    // Detect HTML response (geo-block without redirect)
    const trimmed = responseText.trim();
    if (trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
      return new Response(JSON.stringify({
        error: 'API retornou HTML em vez de JSON. O servidor está sendo bloqueado por geo-restrição da Matchbook.',
        status: response.status,
        html_snippet: trimmed.substring(0, 300),
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    return new Response(JSON.stringify({ status: response.status, data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[matchbook-proxy] ERROR: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
