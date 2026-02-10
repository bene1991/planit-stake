

## Adicionar Resumo por Metodo no "Resumo do Dia"

### O que muda

Abaixo dos 4 cards atuais (Lucro Hoje, Operacoes Hoje, Win Rate Hoje, Jogos Hoje), adicionar uma linha de chips/badges compactos mostrando cada metodo que teve entrada no dia, com greens, reds e lucro individual. Metodos sem operacoes resolvidas no dia nao aparecem.

### Layout

Exemplo visual:
```text
[BTTS FILTRO ODD 2: 5G/2R  +R$ 80,00]  [LAY 0x1: 2G/1R  +R$ 30,00]
```

### Etapa unica: `src/pages/DailyPlanning.tsx`

Dentro do bloco do Resumo do Dia (linhas 503-557), apos os calculos existentes de `todayOps` (linha 505), adicionar:

1. Agrupar `todayOps` por `methodId` usando um `reduce`
2. Para cada grupo: contar greens, reds, somar lucro (usando `op.profit` ou `calculateProfit`)
3. Buscar nome do metodo em `bankroll.methods` pelo id
4. Renderizar como `flex flex-wrap gap-2` de badges compactos abaixo do grid de 4 cards (dentro do `<div className="space-y-2">` existente, linha 527)

Cada badge tera:
- Fundo semi-transparente verde ou vermelho conforme lucro positivo/negativo
- Texto: `NomeMetodo: XG/YR +R$ Z`
- Tamanho pequeno (`text-xs`, `px-2 py-1`, `rounded-full`)

Nenhum outro arquivo precisa ser alterado.

