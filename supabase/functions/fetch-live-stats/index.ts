import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LiveStatsRequest {
  fixtureId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fixtureId }: LiveStatsRequest = await req.json();
    
    const apiKey = Deno.env.get('API_FOOTBALL_KEY');

    if (!apiKey) {
      throw new Error('API_FOOTBALL_KEY not configured');
    }

    console.log('Fetching live stats for fixture:', fixtureId);

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`,
      {
        method: 'GET',
        headers: {
          'x-apisports-key': apiKey,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('API-Football error:', data);
      throw new Error(`API-Football error: ${data.message || 'Unknown error'}`);
    }

    console.log('Live stats fetched successfully');

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching live stats:', error);
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
