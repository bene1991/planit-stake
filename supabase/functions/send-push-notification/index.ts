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

// HKDF implementation using Web Crypto API
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

// Create info string for HKDF
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

// Create context for key derivation
function createContext(
  clientPublicKey: Uint8Array,
  serverPublicKey: Uint8Array
): Uint8Array {
  // Format: label + 0x00 + client_pub_len (2 bytes) + client_pub + server_pub_len (2 bytes) + server_pub
  const label = new TextEncoder().encode('P-256');
  const context = new Uint8Array(
    label.length + 1 + 2 + clientPublicKey.length + 2 + serverPublicKey.length
  );
  
  let offset = 0;
  context.set(label, offset);
  offset += label.length;
  context[offset++] = 0;
  
  // Client public key length (big endian)
  context[offset++] = (clientPublicKey.length >> 8) & 0xff;
  context[offset++] = clientPublicKey.length & 0xff;
  context.set(clientPublicKey, offset);
  offset += clientPublicKey.length;
  
  // Server public key length (big endian)
  context[offset++] = (serverPublicKey.length >> 8) & 0xff;
  context[offset++] = serverPublicKey.length & 0xff;
  context.set(serverPublicKey, offset);
  
  return context;
}

// Encrypt payload using aes128gcm for Web Push
async function encryptPayload(
  payload: Uint8Array,
  clientPublicKeyBase64: string,
  clientAuthBase64: string
): Promise<{ encrypted: Uint8Array; serverPublicKey: Uint8Array; salt: Uint8Array }> {
  // Decode client keys
  const clientPublicKey = base64UrlDecode(clientPublicKeyBase64);
  const clientAuth = base64UrlDecode(clientAuthBase64);

  // Generate server's ephemeral ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Export server public key in uncompressed format
  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);

  // Import client's public key
  const clientKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(clientPublicKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Perform ECDH to get shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Create context for key derivation
  const context = createContext(clientPublicKey, serverPublicKey);

  // Derive PRK using HKDF with auth secret as salt
  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const prk = await hkdf(clientAuth, sharedSecret, authInfo, 32);

  // Derive content encryption key (CEK)
  const cekInfo = createInfo('aes128gcm', context);
  const cek = await hkdf(salt, prk, cekInfo, 16);

  // Derive nonce
  const nonceInfo = createInfo('nonce', context);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);

  // Pad the payload (add delimiter byte 0x02 for last record)
  const paddedPayload = new Uint8Array(payload.length + 1);
  paddedPayload.set(payload);
  paddedPayload[payload.length] = 0x02; // Delimiter byte

  // Import CEK for AES-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(cek),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Encrypt with AES-128-GCM
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

// Build aes128gcm encrypted content with header
function buildEncryptedContent(
  encrypted: Uint8Array,
  serverPublicKey: Uint8Array,
  salt: Uint8Array
): Uint8Array {
  // Record size: 4096 bytes is standard
  const rs = 4096;
  
  // Header format:
  // - salt (16 bytes)
  // - rs (4 bytes, big endian)
  // - idlen (1 byte) = 65 (length of uncompressed P-256 public key)
  // - keyid (65 bytes) = server public key
  // Then encrypted content
  
  const headerLength = 16 + 4 + 1 + serverPublicKey.length;
  const result = new Uint8Array(headerLength + encrypted.length);
  
  let offset = 0;
  
  // Salt (16 bytes)
  result.set(salt, offset);
  offset += 16;
  
  // Record size (4 bytes, big endian)
  result[offset++] = (rs >> 24) & 0xff;
  result[offset++] = (rs >> 16) & 0xff;
  result[offset++] = (rs >> 8) & 0xff;
  result[offset++] = rs & 0xff;
  
  // Key ID length (1 byte)
  result[offset++] = serverPublicKey.length;
  
  // Key ID (server public key)
  result.set(serverPublicKey, offset);
  offset += serverPublicKey.length;
  
  // Encrypted content
  result.set(encrypted, offset);
  
  return result;
}

// Create JWT for VAPID
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

    console.log('Received push request for user:', userId || 'all users');
    console.log('Payload:', JSON.stringify(payload));

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

    console.log('VAPID keys loaded successfully');

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
        try {
          const endpoint = sub.endpoint;
          const url = new URL(endpoint);
          const audience = `${url.protocol}//${url.host}`;

          console.log(`Processing subscription ${sub.id} to ${url.host}`);

          // Create VAPID JWT
          const jwt = await createVapidJwt(
            audience,
            'mailto:admin@valuetips.com',
            vapidData.private_key
          );

          const vapidHeader = `vapid t=${jwt}, k=${vapidData.public_key}`;

          // Encrypt the payload using aes128gcm
          const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
          
          console.log(`Encrypting payload for subscription ${sub.id}`);
          
          const { encrypted, serverPublicKey, salt } = await encryptPayload(
            payloadBytes,
            sub.p256dh,
            sub.auth
          );

          // Build the full encrypted content with header
          const encryptedContent = buildEncryptedContent(encrypted, serverPublicKey, salt);

          console.log(`Sending encrypted push (${encryptedContent.length} bytes) to ${sub.id}`);

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
            const errorText = await response.text();
            console.error(`Push failed for ${sub.id}: ${response.status} ${response.statusText}`);
            console.error(`Response body: ${errorText}`);
            
            // Remove invalid subscriptions (expired or unsubscribed)
            if (response.status === 404 || response.status === 410) {
              console.log(`Removing invalid subscription ${sub.id}`);
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
            
            throw new Error(`Push failed: ${response.status} - ${errorText}`);
          }

          console.log(`Push sent successfully to ${sub.id}`);
          return { success: true, subscriptionId: sub.id };
        } catch (error) {
          console.error(`Error sending push to ${sub.id}:`, error);
          throw error;
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message || 'Unknown error');

    console.log(`Push results: ${successful} successful, ${failed} failed`);
    if (errors.length > 0) {
      console.log('Errors:', errors);
    }

    return new Response(
      JSON.stringify({ success: true, sent: successful, failed, errors }),
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
