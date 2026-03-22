
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function introspectGames() {
    const { data, error } = await supabase.from('games').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Colunas em games:', Object.keys(data[0]));
        console.log('Exemplo de registro:', data[0]);
    } else {
        console.log('Tabela games vazia ou erro:', error);
    }
}

introspectGames();
