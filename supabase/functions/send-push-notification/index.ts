import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64url decode
function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Base64url encode
function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Create JWT for VAPID
async function createVapidJwt(audience: string, subject: string, privateKeyBase64: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const privateKeyBytes = base64UrlDecode(privateKeyBase64);
  
  // Build PKCS8 format from raw 32-byte private key
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20
  ]);
  
  const pkcs8Key = new Uint8Array(pkcs8Header.length + privateKeyBytes.length);
  pkcs8Key.set(pkcs8Header);
  pkcs8Key.set(privateKeyBytes, pkcs8Header.length);

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Key,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw format (64 bytes)
  const sigArray = new Uint8Array(signature);
  let r, s;
  
  if (sigArray.length === 64) {
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32);
  } else {
    // DER format parsing
    let offset = 2;
    const rLength = sigArray[offset + 1];
    offset += 2;
    r = sigArray.slice(offset, offset + rLength);
    if (r.length > 32) r = r.slice(r.length - 32);
    offset += rLength;
    offset += 2;
    s = sigArray.slice(offset);
    if (s.length > 32) s = s.slice(s.length - 32);
  }

  // Pad to 32 bytes if needed
  const rPadded = new Uint8Array(32);
  const sPadded = new Uint8Array(32);
  rPadded.set(r, 32 - r.length);
  sPadded.set(s, 32 - s.length);

  const rawSignature = new Uint8Array(64);
  rawSignature.set(rPadded);
  rawSignature.set(sPadded, 32);

  return `${unsignedToken}.${base64UrlEncode(rawSignature)}`;
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, payload }: { userId?: string; payload: PushPayload } = await req.json();

    // Get VAPID keys from database
    const { data: vapidData, error: vapidError } = await supabase
      .from('vapid_keys')
      .select('public_key, private_key')
      .limit(1)
      .single();

    if (vapidError || !vapidData) {
      console.error('VAPID keys not found:', vapidError);
      throw new Error('VAPID keys not configured');
    }

    // Get push subscriptions
    let query = supabase.from('push_subscriptions').select('*');
    if (userId) {
      query = query.eq('owner_id', userId);
    }
    
    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending push notification to ${subscriptions.length} subscriber(s)`);

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const endpoint = sub.endpoint;
        const url = new URL(endpoint);
        const audience = `${url.protocol}//${url.host}`;

        // Create VAPID JWT
        const jwt = await createVapidJwt(
          audience,
          'mailto:admin@valuetips.com',
          vapidData.private_key
        );

        const vapidHeader = `vapid t=${jwt}, k=${vapidData.public_key}`;

        const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': vapidHeader,
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '86400',
            'Content-Length': payloadBytes.length.toString(),
          },
          body: payloadBytes,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Push failed for ${sub.id}:`, response.status, errorText);
          
          // Remove invalid subscriptions
          if (response.status === 404 || response.status === 410) {
            console.log(`Removing invalid subscription ${sub.id}`);
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
          
          throw new Error(`Push failed: ${response.status}`);
        }

        console.log(`Push sent successfully to ${sub.id}`);
        return { success: true, subscriptionId: sub.id };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Push results: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, sent: successful, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
