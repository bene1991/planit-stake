import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Buscar URL da planilha do settings
    const { data: settings } = await supabaseClient
      .from('settings')
      .select('google_sheets_url')
      .eq('owner_id', user.id)
      .single();

    if (!settings?.google_sheets_url) {
      throw new Error('Google Sheets URL não configurada');
    }

    // Converter URL do Google Sheets para formato de export CSV
    const sheetUrl = settings.google_sheets_url;
    let csvUrl = sheetUrl;
    
    // Extrair o ID da planilha
    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      const sheetId = match[1];
      csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    }

    console.log('Fetching from:', csvUrl);

    // Fazer fetch dos dados CSV
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Erro ao buscar planilha: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    // Processar CSV (pular header)
    const games = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handle quoted values)
      const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
      
      if (values.length >= 5) {
        const [date, time, league, home_team, away_team] = values;
        
        if (date && time && league && home_team && away_team) {
          // Parse date DD/MM/YYYY to YYYY-MM-DD
          const dateParts = date.split('/');
          if (dateParts.length === 3) {
            const [day, month, year] = dateParts;
            const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            
            // Ensure time is in HH:mm format
            const timeParts = time.split(':');
            const formattedTime = timeParts.length === 2 
              ? `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}` 
              : time;
            
            // Create ISO datetime string
            const dateTimeStr = `${formattedDate}T${formattedTime}:00`;

            games.push({
              owner_id: user.id,
              date: formattedDate,
              time: formattedTime,
              league,
              home_team,
              away_team,
              status: 'Not Started',
              added_to_planning: false,
              date_time: dateTimeStr,
            });
          }
        }
      }
    }

    console.log(`Processados ${games.length} jogos`);

    if (games.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum jogo encontrado na planilha', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limpar jogos anteriores
    await supabaseClient
      .from('daily_games')
      .delete()
      .eq('owner_id', user.id);

    // Inserir novos jogos
    const { error: insertError } = await supabaseClient
      .from('daily_games')
      .insert(games);

    if (insertError) {
      console.error('Erro ao inserir:', insertError);
      throw insertError;
    }

    // Atualizar last_import_date
    await supabaseClient
      .from('settings')
      .update({ last_import_date: new Date().toISOString() })
      .eq('owner_id', user.id);

    return new Response(
      JSON.stringify({ 
        message: 'Sincronização concluída com sucesso',
        count: games.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
