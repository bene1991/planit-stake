import { supabase } from '@/integrations/supabase/client';

export const sendTelegramNotification = async (message: string) => {
  try {
    // Buscar configurações do usuário
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('owner_id', user.id)
      .single();

    if (settingsError || !settings?.telegram_bot_token || !settings?.telegram_chat_id) {
      console.log('Telegram not configured, skipping notification');
      return;
    }

    // Enviar via API do Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.telegram_chat_id,
          text: message,
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      // Registrar erro mas não travar
      console.error('Telegram API error:', data.description);
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    // Não travar a aplicação
  }
};
