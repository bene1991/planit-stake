

## Analise de Dominancia em Tempo Real na Aba Planejamento

### Visao Geral

Adicionar uma camada de inteligencia ao `GameCardCompact` que analisa os dados ja disponibilizados pelo `useFixtureCache` (posse, chutes, escanteios, etc.) para calcular um indice de dominancia e classificar o estado dos dados de cada jogo ao vivo.

Nenhuma nova chamada de API sera necessaria - tudo sera calculado a partir dos dados que ja existem no sistema (`normalized_stats`, `key_events`, `momentum_series` do `fixture_cache`).

---

### Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useDominanceAnalysis.ts` | Hook que recebe `FixtureCacheData` e calcula dominancia, estado dos dados e alertas |
| `src/components/DominanceIndicator.tsx` | Componente visual que exibe o badge de status de dados + barra de dominancia + alertas |

### Arquivos a Editar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/GameCardCompact.tsx` | Integrar `useDominanceAnalysis` + `DominanceIndicator` dentro do card, apenas para jogos ao vivo |

---

### Detalhes Tecnicos

#### Hook `useDominanceAnalysis`

Recebe os dados do `useFixtureCache` e retorna:

```typescript
interface DominanceResult {
  // Estado dos dados
  dataStatus: 'ok' | 'limited' | 'unavailable';
  dataStatusMessage: string;
  
  // Indice de dominancia (0-100, >50 = casa domina)
  dominanceIndex: number | null; // null quando sem dados
  dominantTeam: 'home' | 'away' | 'balanced' | null;
  dominanceLabel: string; // "Casa domina", "Equilibrado", etc.
  
  // Alertas inteligentes
  alerts: DominanceAlert[];
}

interface DominanceAlert {
  type: 'momentum_shift' | 'high_pressure' | 'defensive_lock' | 'danger_zone';
  message: string;
  severity: 'info' | 'warning' | 'critical';
}
```

**Logica de classificacao dos dados:**

1. **Dados OK**: `minute_now > 0` E (`shots_total_home + shots_total_away >= 2` OU `possession_home > 0`)
2. **Dados Limitados**: `minute_now > 0` mas stats insuficientes (ex: so tem posse, sem chutes)
3. **Sem Dados**: `minute_now === 0` OU stats completamente zeradas para jogo ao vivo OU `fixtureCache === null`

**Calculo do Live Dominance Index (LDI):**

Formula ponderada usando os dados disponíveis:
- Posse de bola: peso 20%
- Chutes totais: peso 25%
- Chutes no gol: peso 30%
- Escanteios: peso 15%
- Chutes bloqueados: peso 10%

O LDI resulta em um valor de 0 a 100 onde:
- 0-35: Time visitante domina fortemente
- 35-45: Visitante com leve vantagem
- 45-55: Equilibrado
- 55-65: Casa com leve vantagem
- 65-100: Casa domina fortemente

**Alertas automaticos baseados nos dados:**
- "Pressao alta da casa" quando LDI > 70 por mais de 5 minutos
- "Momentum invertido" quando shots_on muda de dominante (detectado via momentum_series)
- "Jogo travado" quando ambos times tem poucos chutes e muitas faltas
- "Zona de perigo" quando um time tem muitos chutes no gol mas sem gol

---

#### Componente `DominanceIndicator`

Exibido dentro do `GameCardCompact`, entre o placar e as stats:

**Quando dados OK:**
```
[Casa domina] ████████░░░░ 68 LDI
⚠ Pressao alta da casa - 8 chutes no gol vs 2
```

**Quando dados limitados:**
```
🟡 Dados limitados - analise parcial
[Equilibrado] ██████░░░░░░ 52 LDI
```

**Quando sem dados:**
```
🔴 Dados ao vivo indisponiveis no momento. Analise suspensa.
```

Visual:
- Badge colorido (verde/amarelo/vermelho) para status dos dados
- Barra horizontal bicolor mostrando dominancia (verde = casa, violeta = fora)
- Texto descritivo do time dominante
- Lista de alertas com icones e cores por severidade

---

#### Integracao no GameCardCompact

O `DominanceIndicator` sera inserido logo apos o placar e gols, antes do `MatchStatsOverview`, apenas quando o jogo estiver ao vivo:

```
[Placar 2-1]
[Gols: Player 45', Player 62']
[--- DominanceIndicator ---]  <-- NOVO
[MatchStatsOverview]
[OddsDisplay]
[Notes]
[Footer]
[Methods]
```

Quando o jogo nao esta ao vivo (Not Started / Finished), o indicador nao aparece.

Quando os dados voltam (ex: cache atualizado com stats), o indicador reativa automaticamente pois reage ao estado do `fixtureCache`.

---

### Ordem de Implementacao

1. Criar `useDominanceAnalysis.ts` com toda a logica de calculo
2. Criar `DominanceIndicator.tsx` com a interface visual
3. Integrar ambos no `GameCardCompact.tsx`

