

## Monitor Trader - Painel Operacional de Odds em Tempo Real

### Resumo

Criar uma nova aba "Monitor Trader" que exibe automaticamente os jogos planejados e mostra odds em tempo real de 4 mercados da Matchbook (Correct Score, Match Odds, BTTS, Over 1.5 Goals), com auto-refresh a cada 5 segundos e visual estilo trader.

### Descoberta importante

Os jogos no Planejamento possuem `api_fixture_id` (API-Football), mas **nao possuem** um ID de evento da Matchbook. Sera necessario adicionar um campo `matchbook_event_id` na tabela `games` e implementar um sistema de vinculacao automatica (por nome dos times) + manual.

### Arquitetura

```text
Monitor Trader (pagina)
    |
    +-- Busca jogos com status 'Not Started' ou 'Live' do Planejamento
    |
    +-- Para cada jogo com matchbook_event_id:
    |     |
    |     +-- GET /events/{id}/markets (a cada 5s)
    |     |
    |     +-- Filtra 4 mercados:
    |           - Correct Score
    |           - Match Odds
    |           - Both Teams To Score
    |           - Over/Under 1.5 Goals
    |
    +-- Para jogos sem matchbook_event_id:
          +-- Botao "Vincular" para buscar e selecionar evento Matchbook
```

### Alteracoes

**1. Migracao de banco de dados**
- Adicionar coluna `matchbook_event_id` (text, nullable) na tabela `games`

**2. Hook: `src/hooks/useMatchbookMonitor.ts` (novo)**
- Hook dedicado ao Monitor que busca todos os mercados de um evento (nao apenas Correct Score)
- Retorna dados estruturados para 4 mercados: Correct Score, Match Odds, BTTS, Over 1.5
- Cache interno de 5 segundos por evento para evitar requisicoes duplicadas
- Auto-refresh com `setInterval` de 5 segundos
- Deteccao de variacao de odd (comparar valor anterior vs atual para colorir verde/vermelho)
- Reutiliza `fetchWithAuth` e autenticacao do `useMatchbook` existente

**3. Hook: `src/hooks/useMatchbookEventLinker.ts` (novo)**
- Busca eventos da Matchbook e tenta vincular automaticamente pelo nome dos times
- Funcao de busca manual caso a vinculacao automatica falhe
- Salva o `matchbook_event_id` no jogo via `updateGame`

**4. Pagina: `src/pages/MonitorTrader.tsx` (nova)**
- Busca jogos pendentes/ao vivo do `useSupabaseGames`
- Para cada jogo, exibe card expansivel com:
  - Cabecalho: nome do evento, liga, horario, status (badge colorido)
  - Se tem `matchbook_event_id`: mostra 4 blocos de mercados
  - Se nao tem: botao "Vincular ao Matchbook"
- Blocos de mercados dentro do card:
  - **Correct Score**: tabela com Score | Back | Lay | Liquidez Lay
  - **Match Odds**: 3 runners (Home/Draw/Away) com Back e Lay
  - **BTTS**: Yes/No com Back e Lay
  - **Over 1.5**: Over/Under com Back e Lay
- Indicador visual de variacao: fundo verde-flash quando odd cai, vermelho-flash quando sobe
- Horario da ultima atualizacao por jogo
- Botao manual de refresh global
- Formulario de login Matchbook (reutiliza logica existente de sessionStorage)
- Tema escuro forcado na pagina

**5. Rota: `src/App.tsx`**
- Adicionar rota `/monitor` protegida com Layout

**6. Navegacao: `src/components/BottomNav.tsx` e `src/components/Layout.tsx`**
- Adicionar aba "Monitor" com icone `Monitor` ou `Activity` na BottomNav (6 itens)
- Adicionar link correspondente na navegacao desktop

### Detalhes tecnicos

**Estrutura de dados dos mercados:**
```text
interface MarketData {
  correct_score: Array<{
    score: string;
    back_price: number | null;
    back_available: number;
    lay_price: number | null;
    lay_available: number;
  }>;
  match_odds: Array<{
    name: string; // "Home", "Draw", "Away"
    back_price: number | null;
    lay_price: number | null;
  }>;
  btts: Array<{
    name: string; // "Yes", "No"
    back_price: number | null;
    lay_price: number | null;
  }>;
  over_15: Array<{
    name: string; // "Over 1.5", "Under 1.5"
    back_price: number | null;
    lay_price: number | null;
  }>;
}
```

**Filtragem de mercados na API Matchbook:**
```text
market.name ou market['market-type'] contendo:
- "Correct Score" ou "correct_score"
- "Match Odds" ou "moneyline"
- "Both Teams To Score" ou "btts"
- "Over/Under 1.5 Goals" ou similar com "1.5"
```

**Controle de rate limit:**
- Cache por evento: armazena resposta por 5 segundos
- Se multiplos jogos, escalona as requisicoes (nao envia todas ao mesmo tempo)
- Maximo de 1 requisicao por segundo por evento

**Deteccao de variacao de odd:**
- Armazena odds anteriores em ref
- Compara com novas odds: se caiu = verde (flash 1s), se subiu = vermelho (flash 1s)
- Reset do flash apos 1 segundo via setTimeout

