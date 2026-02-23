

## Horario dos Jogos + Backtest Historico

### 1. Mostrar horario e ordenar por horario

**Edge function `analyze-lay0x1/index.ts`:**
- Adicionar campo `time` ao `AnalysisResult` extraindo de `fixture.fixture.date` (converter para horario de Brasilia UTC-3)
- Ordenar resultados por horario antes de retornar (aprovados primeiro, dentro de cada grupo por horario)

**ScoreCard `Lay0x1ScoreCard.tsx`:**
- Adicionar prop `time` e exibir o horario ao lado da liga (ex: "14:30 - Premier League")

**Scanner `Lay0x1Scanner.tsx`:**
- Adicionar `time` na interface `AnalysisResult`
- Passar `time` para o ScoreCard

### 2. Backtest com datas passadas

**Scanner `Lay0x1Scanner.tsx`:**
- Adicionar botoes de atalho de datas: "Ontem", "7 dias", "15 dias", "30 dias"
- Quando a data selecionada for no passado, ativar **modo backtest**:
  - Apos receber os resultados do scanner, buscar o placar final de cada jogo aprovado via API-Football (`fixtures` endpoint com `id=fixture_id`)
  - Verificar se o resultado foi 0x1 (Red) ou nao (Green)
  - Exibir resultado real ao lado de cada card: badge "Green" ou "Red" com o placar
  - Exibir resumo do backtest: "X aprovados, Y Green, Z Red, Win Rate: W%"
  - **NAO salvar** automaticamente no banco jogos de backtest (apenas exibir)

**Edge function `analyze-lay0x1/index.ts`:**
- Para datas passadas, a logica ja funciona normalmente (API-Football retorna fixtures e odds historicos)
- Adicionar campo `final_score` ao resultado quando o jogo ja tiver terminado (status FT/AET/PEN), extraindo de `fixture.goals.home` e `fixture.goals.away` que ja vem no response de fixtures

### Detalhes Tecnicos

**Novo campo na resposta da edge function:**
```text
AnalysisResult {
  ...campos existentes,
  time: string,          // "14:30" em horario de Brasilia
  final_score_home?: number,  // se jogo ja terminou
  final_score_away?: number,  // se jogo ja terminou
  fixture_status?: string,    // "FT", "NS", etc
}
```

**Conversao de horario na edge function:**
```text
const fixtureDateTime = fixture.fixture?.date  // "2025-02-23T17:00:00+00:00"
// Converter UTC para UTC-3 (Brasilia)
const brasiliaDate = new Date(fixtureDateTime)
brasiliaDate.setHours(brasiliaDate.getHours() - 3)
const time = `${brasiliaDate.getHours().toString().padStart(2,'0')}:${brasiliaDate.getMinutes().toString().padStart(2,'0')}`
```

**UI do Backtest no Scanner:**
- Botoes de atalho acima do date picker: chips clicaveis "Ontem", "-7d", "-15d", "-30d"
- Quando data < hoje, aparece banner "Modo Backtest" com resumo de resultados
- Cards mostram badge com placar real e resultado (Green/Red)
- Resumo: card com total aprovados, greens, reds, win rate %

**ScoreCard com resultado do backtest:**
- Nova prop opcional `backtestResult?: { scoreHome: number, scoreAway: number, was0x1: boolean }`
- Se presente, exibir badge no topo do card: "0 x 2 Green" ou "0 x 1 Red"

### Arquivos Modificados

1. `supabase/functions/analyze-lay0x1/index.ts` -- adicionar `time`, `final_score_home`, `final_score_away`, `fixture_status` ao resultado
2. `src/components/Lay0x1/Lay0x1ScoreCard.tsx` -- exibir horario e resultado de backtest
3. `src/components/Lay0x1/Lay0x1Scanner.tsx` -- botoes de atalho de data, modo backtest com resumo, interface atualizada

