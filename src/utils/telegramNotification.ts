import { supabase } from '@/integrations/supabase/client';

/**
 * Telegram Notification Service
 * 
 * All calls go through the Supabase Edge Function `send-telegram-notification`,
 * which securely handles the Telegram API key and logs all messages to telegram_logs.
 * 
 * The bot token must be configured in one of:
 *   1. The user's settings table (telegram_bot_token + telegram_chat_id columns)
 *   2. Supabase Edge Function Secrets (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
 */

interface TelegramPayload {
  game?: string;
  market?: string;
  odds?: number;
  stake?: number;
  profit?: number;
  result?: 'Green' | 'Red' | 'Void';
  note?: string;
  [key: string]: unknown;
}

async function getCurrentUserId(): Promise<string | undefined> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
}

async function invokeEdgeFunction(body: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase.functions.invoke('send-telegram-notification', {
      body: { ...body, userId },
    });

    if (error) {
      console.error('[Telegram] Edge function error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Telegram] Failed to invoke edge function:', error);
    return { success: false, error: msg };
  }
}

/**
 * Send a football signal (entry tip).
 */
export const sendSignal = async (payload: TelegramPayload): Promise<{ success: boolean; error?: string }> => {
  return await invokeEdgeFunction({ action: 'sendSignal', payload });
};

/**
 * Send a result notification (green/red/void).
 */
export const sendResult = async (payload: TelegramPayload): Promise<{ success: boolean; error?: string }> => {
  return await invokeEdgeFunction({ action: 'sendResult', payload });
};

/**
 * Send an alert message.
 */
export const sendAlert = async (title: string, message: string, payload?: TelegramPayload): Promise<{ success: boolean; error?: string }> => {
  return await invokeEdgeFunction({ action: 'sendAlert', title, message, payload });
};

/**
 * Send a generic Telegram notification (backward compatibility).
 */
export const sendTelegramNotification = async (message: string, type: 'signal' | 'result' | 'alert' | 'info' | 'notification' = 'notification'): Promise<{ success: boolean; error?: string }> => {
  return await invokeEdgeFunction({ action: 'send', message, type });
};

/**
 * @deprecated Use sendSignal, sendResult or sendAlert instead.
 */
export const invalidateTelegramCache = () => {
  // No-op: caching was handled in the old direct-call implementation.
  // The Edge function handles its own security via Supabase secrets and user settings.
};
