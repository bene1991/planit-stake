import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert Uint8Array to ArrayBuffer properly
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

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

// HKDF implementation
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(ikm),
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(info),
    },
    key,
    length * 8
  );

  return new Uint8Array(bits);
}

function createInfo(type: string, context: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const info = new Uint8Array(
    'Content-Encoding: '.length + type.length + 1 + context.length
  );
  
  let offset = 0;
  const prefix = new TextEncoder().encode('Content-Encoding: ');
  info.set(prefix, offset);
  offset += prefix.length;
  info.set(typeBytes, offset);
  offset += typeBytes.length;
  info.set([0], offset);
  offset += 1;
  info.set(context, offset);
  
  return info;
}

function createContext(
  clientPublicKey: Uint8Array,
  serverPublicKey: Uint8Array
): Uint8Array {
  const label = new TextEncoder().encode('P-256');
  const context = new Uint8Array(
    label.length + 1 + 2 + clientPublicKey.length + 2 + serverPublicKey.length
  );
  
  let offset = 0;
  context.set(label, offset);
  offset += label.length;
  context[offset++] = 0;
  
  context[offset++] = (clientPublicKey.length >> 8) & 0xff;
  context[offset++] = clientPublicKey.length & 0xff;
  context.set(clientPublicKey, offset);
  offset += clientPublicKey.length;
  
  context[offset++] = (serverPublicKey.length >> 8) & 0xff;
  context[offset++] = serverPublicKey.length & 0xff;
  context.set(serverPublicKey, offset);
  
  return context;
}

async function encryptPayload(
  payload: Uint8Array,
  clientPublicKeyBase64: string,
  clientAuthBase64: string
): Promise<{ encrypted: Uint8Array; serverPublicKey: Uint8Array; salt: Uint8Array }> {
  const clientPublicKey = base64UrlDecode(clientPublicKeyBase64);
  const clientAuth = base64UrlDecode(clientAuthBase64);

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);

  const clientKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(clientPublicKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const context = createContext(clientPublicKey, serverPublicKey);

  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const prk = await hkdf(clientAuth, sharedSecret, authInfo, 32);

  const cekInfo = createInfo('aes128gcm', context);
  const cek = await hkdf(salt, prk, cekInfo, 16);

  const nonceInfo = createInfo('nonce', context);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);

  const paddedPayload = new Uint8Array(payload.length + 1);
  paddedPayload.set(payload);
  paddedPayload[payload.length] = 0x02;

  const aesKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(cek),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(nonce) },
    aesKey,
    paddedPayload
  );

  return {
    encrypted: new Uint8Array(encrypted),
    serverPublicKey,
    salt,
  };
}

function buildEncryptedContent(
  encrypted: Uint8Array,
  serverPublicKey: Uint8Array,
  salt: Uint8Array
): Uint8Array {
  const rs = 4096;
  const headerLength = 16 + 4 + 1 + serverPublicKey.length;
  const result = new Uint8Array(headerLength + encrypted.length);
  
  let offset = 0;
  result.set(salt, offset);
  offset += 16;
  
  result[offset++] = (rs >> 24) & 0xff;
  result[offset++] = (rs >> 16) & 0xff;
  result[offset++] = (rs >> 8) & 0xff;
  result[offset++] = rs & 0xff;
  
  result[offset++] = serverPublicKey.length;
  result.set(serverPublicKey, offset);
  offset += serverPublicKey.length;
  
  result.set(encrypted, offset);
  
  return result;
}

async function createVapidJwt(audience: string, subject: string, privateKeyBase64: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const privateKeyBytes = base64UrlDecode(privateKeyBase64);
  
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
    toArrayBuffer(pkcs8Key),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sigArray = new Uint8Array(signature);
  let r, s;
  
  if (sigArray.length === 64) {
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32);
  } else {
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

  const rPadded = new Uint8Array(32);
  const sPadded = new Uint8Array(32);
  rPadded.set(r, 32 - r.length);
  sPadded.set(s, 32 - s.length);

  const rawSignature = new Uint8Array(64);
  rawSignature.set(rPadded);
  rawSignature.set(sPadded, 32);

  return `${unsignedToken}.${base64UrlEncode(rawSignature)}`;
}

interface VapidKeys {
  public_key: string;
  private_key: string;
}

interface PushSubscription {
  id: string;
  owner_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// deno-lint-ignore no-explicit-any
async function sendPushNotification(
  supabase: any,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  // Get VAPID keys
  const { data: vapidData, error: vapidError } = await supabase
    .from('vapid_keys')
    .select('public_key, private_key')
    .limit(1)
    .single();

  if (vapidError || !vapidData) {
    console.error('VAPID keys not found:', vapidError);
    return;
  }

  const vapid = vapidData as VapidKeys;

  // Get push subscriptions for user
  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('owner_id', userId);

  if (subError || !subscriptions || subscriptions.length === 0) {
    console.log('No subscriptions for user:', userId);
    return;
  }

  const subs = subscriptions as PushSubscription[];

  const payload = {
    title,
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'goal-notification',
    data,
  };

  for (const sub of subs) {
    try {
      const endpoint = sub.endpoint;
      const url = new URL(endpoint);
      const audience = `${url.protocol}//${url.host}`;

      const jwt = await createVapidJwt(
        audience,
        'mailto:admin@valuetips.com',
        vapid.private_key
      );

      const vapidHeader = `vapid t=${jwt}, k=${vapid.public_key}`;

      const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
      const { encrypted, serverPublicKey, salt } = await encryptPayload(
        payloadBytes,
        sub.p256dh,
        sub.auth
      );

      const encryptedContent = buildEncryptedContent(encrypted, serverPublicKey, salt);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': vapidHeader,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'TTL': '86400',
          'Content-Length': encryptedContent.length.toString(),
        },
        body: toArrayBuffer(encryptedContent),
      });

      if (!response.ok) {
        console.error(`Push failed for ${sub.id}: ${response.status}`);
        if (response.status === 404 || response.status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      } else {
        console.log(`Push sent to ${sub.id}`);
      }
    } catch (error) {
      console.error(`Error sending push to ${sub.id}:`, error);
    }
  }
}

interface GoalCheckRequest {
  userId: string;
  games: Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    api_fixture_id: string;
    lastKnownHomeScore: number;
    lastKnownAwayScore: number;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('API_FOOTBALL_KEY');

    if (!apiKey) {
      throw new Error('API_FOOTBALL_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, games }: GoalCheckRequest = await req.json();

    if (!userId || !games || games.length === 0) {
      return new Response(
        JSON.stringify({ success: true, goals: [], message: 'No games to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking ${games.length} games for user ${userId}`);

    const goalsDetected: Array<{
      gameId: string;
      homeTeam: string;
      awayTeam: string;
      newHomeScore: number;
      newAwayScore: number;
      scoringTeam: 'home' | 'away';
    }> = [];

    // Check each game for new goals
    for (const game of games) {
      try {
        const response = await fetch(
          `https://v3.football.api-sports.io/fixtures?id=${game.api_fixture_id}`,
          {
            method: 'GET',
            headers: {
              'x-apisports-key': apiKey,
            },
          }
        );

        const data = await response.json();
        const fixture = data.response?.[0];

        if (!fixture) continue;

        const currentHomeScore = fixture.goals?.home ?? 0;
        const currentAwayScore = fixture.goals?.away ?? 0;

        // Check for new goals
        if (currentHomeScore > game.lastKnownHomeScore) {
          goalsDetected.push({
            gameId: game.id,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            newHomeScore: currentHomeScore,
            newAwayScore: currentAwayScore,
            scoringTeam: 'home',
          });
        } else if (currentAwayScore > game.lastKnownAwayScore) {
          goalsDetected.push({
            gameId: game.id,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            newHomeScore: currentHomeScore,
            newAwayScore: currentAwayScore,
            scoringTeam: 'away',
          });
        }
      } catch (error) {
        console.error(`Error checking game ${game.id}:`, error);
      }
    }

    // Send push notifications for each goal detected
    for (const goal of goalsDetected) {
      const scoringTeamName = goal.scoringTeam === 'home' ? goal.homeTeam : goal.awayTeam;
      const title = `⚽ GOL! ${scoringTeamName}`;
      const body = `${goal.homeTeam} ${goal.newHomeScore} - ${goal.newAwayScore} ${goal.awayTeam}`;

      await sendPushNotification(supabase, userId, title, body, {
        gameId: goal.gameId,
        type: 'goal',
      });
    }

    console.log(`Detected ${goalsDetected.length} new goals`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        goals: goalsDetected,
        checked: games.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-goals-and-notify:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});