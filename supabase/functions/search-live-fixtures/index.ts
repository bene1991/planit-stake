import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchFixturesRequest {
  live?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { live }: SearchFixturesRequest = await req.json();
    
    const apiKey = Deno.env.get('API_FOOTBALL_KEY');

    if (!apiKey) {
      console.error('API_FOOTBALL_KEY not configured');
      throw new Error('API_FOOTBALL_KEY not configured');
    }

    console.log('Searching live fixtures with API Key:', apiKey.substring(0, 10) + '...');

    // Build query parameters for live matches
    const params = new URLSearchParams({
      live: 'all',
      timezone: 'America/Sao_Paulo'
    });

    const apiUrl = `https://v3.football.api-sports.io/fixtures?${params.toString()}`;
    console.log('API URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
        'x-apisports-host': 'v3.football.api-sports.io',
      },
    });

    console.log('API Response status:', response.status);

    const data = await response.json();

    if (!response.ok) {
      console.error('API-Football error:', JSON.stringify(data));
      throw new Error(`API-Football error: ${data.message || 'Unknown error'}`);
    }

    console.log(`Found ${data.response?.length || 0} live fixtures`);
    
    if (data.response && data.response.length > 0) {
      console.log('First fixture:', JSON.stringify(data.response[0]));
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error searching fixtures:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
