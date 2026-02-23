

## Corrigir Ranges de Normalizacao do Score Inteligente

### Problema

Os ranges de normalizacao no `analyze-lay0x1/index.ts` sao muito largos, comprimindo scores de jogos bons para valores mediocres:

| Componente | Valor real | Range atual | Score | Range correto | Score corrigido |
|---|---|---|---|---|---|
| Ofensivo (1.9 gols) | 1.90 | [0.5, 3.0] | 56% | [1.0, 2.2] | **75%** |
| Defensivo (1.7 gols) | 1.70 | [0.5, 3.0] | 48% | [1.0, 2.2] | **58%** |
| Over Poisson (79%) | 78.6 | [30, 95] | 75% | [40, 85] | **86%** |
| Liga (proxy) | 1.80 | [1.0, 3.5] | 32% | [1.3, 2.5] | **42%** |
| H2H (0 de 5) | 5 | [0, 5] | 100% | sem mudanca | **100%** |
| Odds (3.85) | 1.0 | ideal | 100% | sem mudanca | **100%** |

**Score atual**: 65.5 arredondado para **66** (abaixo do min_score 75 do usuario)
**Score corrigido**: ~76 (acima do min_score, seria Aprovado)

### Mudancas

**Arquivo unico: `supabase/functions/analyze-lay0x1/index.ts`**

1. **Ajustar ranges de normalizacao** (linhas 388-393):

```text
// ANTES (ranges irrealistas):
normalize(homeGoalsAvg, 0.5, 3.0)    // 1.9 -> 0.56
normalize(awayConcededAvg, 0.5, 3.0) // 1.7 -> 0.48
normalize(probOverReal, 30, 95)       // 78.6 -> 0.75
normalize(leagueGoalsAvg, 1.0, 3.5)  // 1.8 -> 0.32

// DEPOIS (ranges realistas de futebol):
normalize(homeGoalsAvg, 1.0, 2.2)    // 1.9 -> 0.75
normalize(awayConcededAvg, 1.0, 2.2) // 1.7 -> 0.58
normalize(probOverReal, 40, 85)       // 78.6 -> 0.86
normalize(leagueGoalsAvg, 1.3, 2.5)  // 1.8 -> 0.42
```

Justificativa dos novos ranges:
- **[1.0, 2.2] para gols**: a grande maioria dos times esta entre 1.0 e 2.2 de media. Times com 2.2+ sao excepcionais (score 100%)
- **[40, 85] para Over Poisson**: probabilidades reais de Over 1.5 ficam nesse range. Acima de 85% e excelente
- **[1.3, 2.5] para liga**: proxy mais realista para qualidade da liga baseada nos stats do jogo

### Simulacao com os novos ranges

Para Brondby vs Sonderjyske (1.9/1.7/3.85/79%/0 h2h):

```text
offensiveScore = 0.75 * 0.20 = 0.150
defensiveScore = 0.58 * 0.20 = 0.117
overScore      = 0.86 * 0.20 = 0.172
leagueScore    = 0.42 * 0.15 = 0.063
h2hScore       = 1.00 * 0.15 = 0.150
oddsScore      = 1.00 * 0.10 = 0.100

baseScore = 75.2
penalty0x1 = 0 (prob0x1 < 12%)
riskIndex = 0 (divergencia < 1.0)

Score final = 75 -> APROVADO (>= min_score 75)
Classification = "Forte"
```

### Impacto

- Jogos que atendem todos os criterios com stats decentes passam a ter scores 70-85 (realistas)
- Jogos excepcionais (media 2.0+ gols, over 85%+) atingem 85-95
- Jogos marginais (media ~1.5, over ~50%) ficam em 55-65 (corretamente reprovados)
- Nenhuma outra mudanca necessaria -- apenas os 4 numeros de range

