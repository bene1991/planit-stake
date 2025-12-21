import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate VAPID keys using Web Crypto API
async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"]
  );

  const publicKeyBuffer = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  // Convert to base64url format (required for VAPID)
  const publicKey = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // For private key, we need the raw 32 bytes from the PKCS8 format
  const privateKeyArray = new Uint8Array(privateKeyBuffer);
  // PKCS8 format for P-256 has the raw private key at offset 36, length 32
  const rawPrivateKey = privateKeyArray.slice(36, 68);
  const privateKey = btoa(String.fromCharCode(...rawPrivateKey))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return { publicKey, privateKey };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action } = await req.json();

    if (action === 'get-or-create') {
      // Check if VAPID keys already exist
      const { data: existingKeys, error: selectError } = await supabase
        .from('vapid_keys')
        .select('public_key')
        .limit(1)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error checking existing keys:', selectError);
        throw selectError;
      }

      if (existingKeys) {
        console.log('VAPID keys already exist, returning public key');
        return new Response(
          JSON.stringify({ publicKey: existingKeys.public_key }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate new VAPID keys
      console.log('Generating new VAPID keys...');
      const { publicKey, privateKey } = await generateVapidKeys();

      // Store in database
      const { error: insertError } = await supabase
        .from('vapid_keys')
        .insert({
          public_key: publicKey,
          private_key: privateKey,
        });

      if (insertError) {
        console.error('Error storing VAPID keys:', insertError);
        throw insertError;
      }

      console.log('VAPID keys generated and stored successfully');
      return new Response(
        JSON.stringify({ publicKey }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-private') {
      // This should only be called by other edge functions
      const { data, error } = await supabase
        .from('vapid_keys')
        .select('public_key, private_key')
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching VAPID keys:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ publicKey: data.public_key, privateKey: data.private_key }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-vapid-keys:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
