

## Monitoramento em Background com Notificações Telegram

### O que muda

Atualmente, o sistema so funciona com o navegador aberto. Vamos criar um **monitor automatico no backend** que roda a cada 2 minutos, independente do navegador. Quando detectar um gol ou cartao vermelho, envia uma mensagem no seu Telegram automaticamente.

---

### Como vai funcionar

1. A cada 2 minutos, uma funcao no backend acorda automaticamente
2. Busca no banco de dados todos os seus jogos que estao "Live" ou prestes a comecar
3. Consulta a API-Football para obter placares e eventos atualizados
4. Compara com os placares anteriores armazenados no banco
5. Se detectar um **gol** ou **cartao vermelho**, envia uma mensagem no seu Telegram
6. Atualiza os placares no banco para a proxima comparacao

### Formato das mensagens Telegram

**Gol:**
```
⚽ GOL! Flamengo
Flamengo 1 - 0 Palmeiras
🏟 Brasileirão | ⏱ 34'
```

**Cartao Vermelho:**
```
🟥 CARTÃO VERMELHO!
Jogador: Fulano (Palmeiras)
Flamengo 1 - 0 Palmeiras | ⏱ 67'
```

---

### Detalhes tecnicos

**1. Nova Edge Function: `monitor-live-games`**

Funcao principal que sera chamada pelo cron. Logica:
- Busca jogos com `status = 'Live'` ou `status = 'Pending'` com horario proximo (30min)
- Agrupa por usuario (owner_id)
- Chama `live=all` da API-Football (1 unica chamada para todos os jogos)
- Para cada jogo monitorado, compara placar atual com `final_score_home`/`final_score_away` no banco
- Para detectar cartoes vermelhos, busca eventos do fixture quando ha jogos ao vivo
- Se detectar mudanca, envia Telegram usando o bot token/chat id da tabela `settings`
- Atualiza o placar no banco de dados

**2. Armazenamento de estado (nova tabela `live_monitor_state`)**

Para rastrear o ultimo estado conhecido de cada jogo sem depender do frontend:

```sql
CREATE TABLE live_monitor_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  fixture_id text NOT NULL,
  last_home_score integer DEFAULT 0,
  last_away_score integer DEFAULT 0,
  last_events_count integer DEFAULT 0,
  notified_events jsonb DEFAULT '[]',
  status text DEFAULT 'monitoring',
  updated_at timestamptz DEFAULT now()
);
```

Com RLS para que apenas o dono veja seus dados + service role para a edge function.

**3. Cron Job (pg_cron)**

Configurar um job que chama a edge function a cada 2 minutos:

```sql
SELECT cron.schedule(
  'monitor-live-games',
  '*/2 * * * *',
  $$ SELECT net.http_post(...) $$
);
```

**4. Consumo de creditos**

- 1 chamada `live=all` a cada 2 min = ~720 creditos/dia (bem dentro dos 75k)
- Chamadas extras para eventos apenas quando ha jogos ao vivo (~5-10 por jogo)
- Estimativa total: ~1000-2000 creditos/dia para monitoramento em background

**Arquivos a criar/modificar:**
- `supabase/functions/monitor-live-games/index.ts` (nova edge function)
- `supabase/config.toml` (adicionar config da nova funcao)
- Migracoes SQL: tabela `live_monitor_state` + cron job + extensoes pg_cron/pg_net

