import { supabase } from '@/integrations/supabase/client';

// Cache telegram settings for 5 minutes to avoid repeated DB queries
let cachedSettings: { botToken: string; chatId: string; userId: string; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getTelegramSettings(): Promise<{ botToken: string; chatId: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Return cached if still valid and same user
  if (cachedSettings && cachedSettings.userId === user.id && (Date.now() - cachedSettings.ts) < CACHE_TTL) {
    return { botToken: cachedSettings.botToken, chatId: cachedSettings.chatId };
  }

  const { data: settings, error } = await supabase
    .from('settings')
    .select('telegram_bot_token, telegram_chat_id')
    .eq('owner_id', user.id)
    .single();

  if (error || !settings?.telegram_bot_token || !settings?.telegram_chat_id) {
    return null;
  }

  cachedSettings = {
    botToken: settings.telegram_bot_token,
    chatId: settings.telegram_chat_id,
    userId: user.id,
    ts: Date.now(),
  };

  return { botToken: cachedSettings.botToken, chatId: cachedSettings.chatId };
}

export const sendTelegramNotification = async (message: string) => {
  try {
    const settings = await getTelegramSettings();
    if (!settings) {
      console.log('Telegram not configured, skipping notification');
      return;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram API error:', data.description);
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
};

/** Invalidate cached settings (e.g. when user updates telegram config) */
export const invalidateTelegramCache = () => {
  cachedSettings = null;
};
