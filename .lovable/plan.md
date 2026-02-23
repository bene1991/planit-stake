

## Aprovar jogos com todos os criterios atendidos + Botao manual

### Problema Identificado

O `min_score` atual esta em **75**, entao jogos como Brondby (score 71) e Lechia Gdansk (score 65) sao reprovados mesmo com **todos os criterios verdes**. O score e apenas uma pontuacao ponderada, mas se todos os filtros eliminatorios passam, o jogo deveria ser aprovado.

### Mudanca 1: Aprovar automaticamente quando todos os criterios sao atendidos

**Arquivo**: `supabase/functions/analyze-lay0x1/index.ts`

Alterar a logica de aprovacao (linha ~256):

De:
```
const isApproved = allCriteriaMet && scoreValue >= dynamicMinScore;
```

Para:
```
const isApproved = allCriteriaMet;
```

A classificacao continua usando o score para mostrar "Forte", "Moderado" etc., mas a aprovacao depende apenas dos criterios eliminatorios (odd casa < visitante, H2H, media gols, odd visitante, over 1.5).

### Mudanca 2: Botao "Adicionar" nos jogos reprovados

**Arquivo**: `src/components/Lay0x1/Lay0x1ScoreCard.tsx`

- Adicionar nova prop `onForceAdd` (opcional) ao componente
- Nos cards reprovados, exibir um botao "Adicionar manualmente" que chama `onForceAdd`

**Arquivo**: `src/components/Lay0x1/Lay0x1Scanner.tsx`

- Passar `onForceAdd` para os `Lay0x1ScoreCard` dos jogos reprovados (na secao "Reprovados")
- A funcao `onForceAdd` vai chamar o mesmo `handleSave` que ja existe, salvando o jogo na tabela `lay0x1_analyses`
- Funciona tanto no modo dia quanto no modo backtest

### Resultado

- Jogos com todos os criterios verdes: aprovados automaticamente (independente do score numerico)
- Jogos reprovados (algum criterio falhou): exibem botao "Adicionar" para inclusao manual pelo usuario
- O score continua sendo exibido como referencia de qualidade, mas nao bloqueia mais a aprovacao

### Detalhes Tecnicos

**Backend** (`analyze-lay0x1/index.ts`):
- Remover `scoreValue >= dynamicMinScore` da condicao de aprovacao
- Manter `dynamicMinScore` apenas para a funcao `classify()` (labels visuais)

**ScoreCard** (`Lay0x1ScoreCard.tsx`):
- Nova prop: `onForceAdd?: () => void`
- Botao aparece apenas quando `!approved && onForceAdd`
- Estilo: botao outline com icone "+" e texto "Adicionar"

**Scanner** (`Lay0x1Scanner.tsx`):
- Nos rejected cards, passar `onForceAdd={() => handleSave(r)}` (apenas quando nao e backtest puro)
- No modo backtest com range, permitir adicionar tambem para calibracao
