

## Corrigir: IA nao deve bloquear ligas sem Red

### O Problema

A funcao `calibrate-lay0x1` permite que a IA (Gemini) recomende bloqueio de ligas sem nenhuma validacao. As 3 ligas bloqueadas atualmente tem **zero reds**:

- **Eerste Divisie**: 4 Greens, 0 Reds
- **Friendlies Clubs**: 3 Greens, 0 Reds  
- **Professional Development League**: 7 Greens, 0 Reds

A IA bloqueou ligas lucrativas sem justificativa estatistica.

### A Solucao (2 partes)

#### Parte 1: Validar recomendacoes da IA antes de aplicar

**Arquivo**: `supabase/functions/calibrate-lay0x1/index.ts`

Na secao que aplica bloqueios da IA (linhas 593-606), adicionar validacao: so bloquear se a liga tiver pelo menos 1 Red no historico.

Antes de inserir na tabela `lay0x1_blocked_leagues`, verificar se a liga esta em `leagueStats` e tem `reds > 0`. Se nao tiver reds, ignorar a recomendacao e logar o motivo.

#### Parte 2: Melhorar o prompt da IA

No schema da funcao `calibration_recommendations` (linha 267-271), atualizar a descricao do campo `leagues_to_block` para instruir a IA a so recomendar ligas com reds:

De:
```
description: 'Ligas que devem ser bloqueadas automaticamente'
```

Para:
```
description: 'Ligas que devem ser bloqueadas. SOMENTE ligas com pelo menos 1 Red no historico. NUNCA bloqueie ligas com 0 Reds.'
```

#### Parte 3: Desbloquear as 3 ligas injustamente bloqueadas

Remover as 3 ligas da tabela `lay0x1_blocked_leagues` via migracao SQL, pois foram bloqueadas sem justificativa.

### Detalhes Tecnicos

**Validacao no backend** (`calibrate-lay0x1/index.ts`, linhas 593-606):

```text
// Auto-block leagues recommended by AI — ONLY if they have reds
if (aiRecommendations.leagues_to_block?.length > 0) {
  for (const league of aiRecommendations.leagues_to_block) {
    const stats = leagueStats[league];
    if (!stats || stats.reds === 0) {
      console.log(`[AI] Skipping block for "${league}" — no reds (${stats?.total || 0} games, 0 reds)`);
      continue;
    }
    // ... existing upsert code
  }
}
```

**Fallback pattern-based** (linhas 608-620): ja tem a regra `rate > 0.5 && total >= 3`, entao so bloqueia com reds. Nao precisa mudar.

**Limpeza**: Deletar as 3 ligas da tabela via SQL.

### Arquivos Modificados

- `supabase/functions/calibrate-lay0x1/index.ts` — Validacao de reds antes de bloquear + prompt melhorado
- Migracao SQL — Remover as 3 ligas bloqueadas incorretamente

