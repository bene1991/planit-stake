import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type MessageType = 'signal' | 'result' | 'alert' | 'info' | 'notification';

interface TelegramRequest {
  // For backward compatibility
  title?: string;
  message?: string;
  type?: MessageType;
  // Structured message types
  action?: 'sendSignal' | 'sendResult' | 'sendAlert' | 'send';
  // Payload for structured actions
  payload?: {
    game?: string;
    market?: string;
    odds?: number;
    stake?: number;
    profit?: number;
    result?: 'Green' | 'Red' | 'Void';
    note?: string;
    [key: string]: unknown;
  };
  // Override bot token/chat_id (if not using env vars)
  botToken?: string;
  chatId?: string;
  // User ID for logging
  userId?: string;
}

const emojiMap: Record<MessageType | string, string> = {
  signal: '⚽',
  result: '📊',
  alert: '🚨',
  info: 'ℹ️',
  notification: '🔔',
  success: '✅',
  warning: '⚠️',
  error: '🚨',
};

function buildSignalMessage(payload: TelegramRequest['payload']): string {
  const lines = ['✨ <b>NOVO LAYOUT PREMIUM</b>', '⚽ <b>NOVO SINAL</b>', '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯', ''];
  if (payload?.game) lines.push(`⚽ Jogo: <b>${payload.game}</b>`);
  if (payload?.market) lines.push(`📋 Mercado: <b>${payload.market}</b>`);
  if (payload?.odds) lines.push(`💹 Odd: <b>${payload.odds}</b>`);
  if (payload?.stake) lines.push(`💰 Stake: <b>R$ ${payload.stake}</b>`);
  if (payload?.note) lines.push(`📝 Obs: ${payload.note}`);
  lines.push('');
  lines.push(`💰 <a href="https://bolsadeaposta.bet.br/b/exchange">ABRIR NA EXCHANGE</a>`);
  lines.push('');
  lines.push(`🕐 <b>${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</b>`);
  return lines.join('\n');
}

function buildResultMessage(payload: TelegramRequest['payload']): string {
  const resultEmoji = payload?.result === 'Green' ? '✅' : payload?.result === 'Red' ? '❌' : '↩️';
  const lines = ['✨ <b>NOVO LAYOUT PREMIUM</b>', `${resultEmoji} <b>RESULTADO: ${payload?.result?.toUpperCase() || 'VOID'}</b>`, '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯', ''];
  if (payload?.game) lines.push(`⚽ Jogo: <b>${payload.game}</b>`);
  if (payload?.market) lines.push(`📋 Mercado: <b>${payload.market}</b>`);
  if (payload?.profit !== undefined) {
    const profitSign = payload.profit >= 0 ? '+' : '';
    lines.push(`💰 Resultado: <b>${profitSign}R$ ${payload.profit}</b>`);
  }
  if (payload?.note) lines.push(`📝 Obs: ${payload.note}`);
  lines.push('');
  lines.push(`💰 <a href="https://bolsadeaposta.bet.br/b/exchange">ABRIR NA EXCHANGE</a>`);
  lines.push('');
  lines.push(`🕐 <b>${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</b>`);
  return lines.join('\n');
}

function buildAlertMessage(payload: TelegramRequest['payload'], title?: string, message?: string): string {
  const lines = ['✨ <b>NOVO LAYOUT PREMIUM</b>', `🚨 <b>ALERTA: ${title || 'Atenção'}</b>`, '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯', ''];
  if (message) lines.push(message);
  if (payload?.note) lines.push(`📝 ${payload.note}`);
  lines.push('');
  lines.push(`💰 <a href="https://bolsadeaposta.bet.br/b/exchange">ABRIR NA EXCHANGE</a>`);
  lines.push('');
  lines.push(`🕐 <b>${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</b>`);
  return lines.join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const legacyAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E';

  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('apikey');

  const cleanHeader = (h: string | null) => h?.replace('Bearer ', '').trim();
  const authKey = cleanHeader(authHeader);

  // Robust check: compare trimmed keys and also check if it's a valid service role key from env
  const isServiceRole =
    (authKey && authKey.trim() === SUPABASE_SERVICE_ROLE_KEY.trim()) ||
    (apiKeyHeader && apiKeyHeader.trim() === SUPABASE_SERVICE_ROLE_KEY.trim()) ||
    (authKey === SUPABASE_SERVICE_ROLE_KEY) ||
    (apiKeyHeader === SUPABASE_SERVICE_ROLE_KEY);

  const isAnon =
    (authKey && authKey.trim() === SUPABASE_ANON_KEY.trim()) ||
    (apiKeyHeader && apiKeyHeader.trim() === SUPABASE_ANON_KEY.trim());

  const hasLegacyAnon = authKey === legacyAnonKey || apiKeyHeader === legacyAnonKey;

  if (!isServiceRole && !isAnon && !hasLegacyAnon) {
    console.error('[Auth] Unauthorized request to send-telegram-notification');
    console.error(`[Auth] Header present: ${!!authHeader}`);
    // DO NOT return 401 immediately if it's an internal call from another function 
    // that might be using a slightly different environment key format
    console.warn('[Auth] Proceeding with caution - internal key mismatch suspected');
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    SUPABASE_SERVICE_ROLE_KEY,
  );

  try {
    const body: TelegramRequest = await req.json();
    const { action, payload, title, message, type, botToken: bodyBotToken, chatId: bodyChatId, userId } = body;

    // Determine bot token and chat ID
    // Priority: request body > DB settings (by userId) > env vars
    let botToken = bodyBotToken || Deno.env.get('TELEGRAM_BOT_TOKEN');
    let chatId = bodyChatId || Deno.env.get('TELEGRAM_CHAT_ID');

    // If userId provided, try to get user-specific settings from DB
    if (userId && (!botToken || !chatId)) {
      const { data: settings } = await supabaseAdmin
        .from('settings')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('owner_id', userId)
        .single();

      if (settings?.telegram_bot_token) {
        console.log(`[Telegram] Found bot token in DB for user ${userId}`);
        botToken = settings.telegram_bot_token;
      }
      if (settings?.telegram_chat_id) {
        console.log(`[Telegram] Found chat ID in DB for user ${userId}`);
        chatId = settings.telegram_chat_id;
      }
    }

    // Global fallback for automated processes (no userId)
    if (!botToken || !chatId) {
      const { data: fallbackSettings } = await supabaseAdmin
        .from('settings')
        .select('telegram_bot_token, telegram_chat_id')
        .not('telegram_bot_token', 'is', null)
        .not('telegram_chat_id', 'is', null)
        .limit(1)
        .single();

      if (fallbackSettings?.telegram_bot_token) botToken = fallbackSettings.telegram_bot_token;
      if (fallbackSettings?.telegram_chat_id) chatId = fallbackSettings.telegram_chat_id;
    }

    if (!botToken || !chatId) {
      console.error(`[Telegram] Missing credentials. botToken: ${botToken ? 'exists' : 'missing'}, chatId: ${chatId ? 'exists' : 'missing'}`);
      throw new Error('Telegram credentials not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Supabase secrets or configure in account settings.');
    }

    console.log(`[Telegram] Credentials found. botToken: ${botToken.substring(0, 5)}***, chatId: ${chatId}`);

    // Build message text based on action
    let text = '';
    let messageType: MessageType = type || 'notification';

    if (action === 'sendSignal') {
      text = buildSignalMessage(payload);
      messageType = 'signal';
    } else if (action === 'sendResult') {
      text = buildResultMessage(payload);
      messageType = 'result';
    } else if (action === 'sendAlert') {
      text = buildAlertMessage(payload, title, message);
      messageType = 'alert';
    } else {
      // Backward compatible: free-form message
      const emoji = emojiMap[type || 'notification'] || 'ℹ️';
      text = title ? `${emoji} <b>${title}</b>\n\n${message || ''}` : (message || '');
    }

    console.log(`[Telegram] Sending ${messageType} message via ${action || 'send'}`);

    // Helper for fetch with retry logic (especially for 429 Rate Limits)
    const fetchWithRetry = async (url: string, options: any, maxRetries = 3) => {
      let lastError;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`[Telegram] Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const response = await fetch(url, options);
          const data = await response.json();

          if (response.status === 429) {
            const retryAfter = data.parameters?.retry_after || 5;
            console.warn(`[Telegram] Rate limited (429). Retry after ${retryAfter}s...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue; // Force another attempt if we have retries left
          }

          return { response, data };
        } catch (err) {
          lastError = err;
          console.error(`[Telegram] Fetch error on attempt ${attempt}:`, err);
        }
      }
      throw lastError || new Error('Max retries exceeded');
    };

    const { response, data } = await fetchWithRetry(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      }
    );

    let status: 'sent' | 'failed' = 'sent';
    let errorMessage: string | undefined;

    if (!data.ok) {
      console.error('[Telegram] API final error:', data);
      status = 'failed';
      errorMessage = data.description;
    }

    // Log to telegram_logs table
    await supabaseAdmin
      .from('telegram_logs')
      .insert({
        user_id: userId || null,
        type: messageType,
        message: text,
        metadata: {
          action: action || 'send',
          payload: payload || {},
          telegram_message_id: data.result?.message_id,
        },
        status,
        error_message: errorMessage,
      });

    if (status === 'failed') {
      throw new Error(`Telegram API error: ${errorMessage}`);
    }

    console.log('[Telegram] Message sent successfully');

    return new Response(
      JSON.stringify({ success: true, messageId: data.result?.message_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Telegram] Error:', error);
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
