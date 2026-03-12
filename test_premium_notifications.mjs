
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendTest() {
    console.log('--- ENVIANDO TESTES DE NOTIFICAÇÃO PREMIUM ---');

    // 1. Signal Test
    console.log('Enviando Sinal de Teste...');
    await supabase.functions.invoke('send-telegram-notification', {
        body: {
            action: 'sendSignal',
            payload: {
                game: 'Time A vs Time B',
                market: 'Back Home (Premium)',
                odds: 2.10,
                stake: 100,
                note: 'Teste do novo layout premium'
            }
        }
    });

    // 2. Result Test
    console.log('Enviando Resultado de Teste...');
    await supabase.functions.invoke('send-telegram-notification', {
        body: {
            action: 'sendResult',
            payload: {
                game: 'Time A vs Time B',
                market: 'Back Home (Premium)',
                result: 'Green',
                profit: 110,
                note: 'Resultado de teste atualizado'
            }
        }
    });

    // 3. Alert Test
    console.log('Enviando Alerta de Teste...');
    await supabase.functions.invoke('send-telegram-notification', {
        body: {
            action: 'sendAlert',
            title: 'TESTE PREMIUM',
            message: 'Este é um alerta de manutenção teste com o novo design.',
            payload: { note: 'Divisores e links verificados' }
        }
    });

    // 4. Force Robot Replay (if any alerts exist)
    console.log('Triggering Force Alerts (Replay)...');
    await supabase.functions.invoke('force-telegram-alerts');

    console.log('--- TODOS OS TESTES ENVIADOS ---');
}

await sendTest();
