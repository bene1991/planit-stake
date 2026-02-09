

## Adicionar Resumo por Metodo no "Resumo do Dia"

### O que muda

Abaixo dos 4 cards atuais (Lucro Hoje, Operacoes Hoje, Win Rate Hoje, Jogos Hoje), adicionar uma linha compacta mostrando cada metodo que teve entrada no dia, com seus resultados individuais. Metodos sem operacoes no dia nao aparecem.

### Layout

Cada metodo aparece como um mini-badge/chip horizontal com:
- Nome do metodo
- Greens/Reds (ex: 5G/2R)
- Lucro em R$ (colorido verde/vermelho)

Exemplo visual:
```text
[BTTS FILTRO ODD 2: 5G/2R  +R$ 80,00]  [LAY 0x1: 2G/1R  +R$ 30,00]
```

### Etapa unica: `src/pages/DailyPlanning.tsx`

Dentro do bloco do Resumo do Dia (linhas ~503-557), apos calcular `todayOps`, agrupar as operacoes por `methodId`, buscar o nome do metodo em `bankroll.methods`, e renderizar uma linha de chips abaixo dos 4 cards. Somente metodos com pelo menos 1 operacao resolvida no dia aparecem.

Logica:
1. Agrupar `todayOps` por `methodId`
2. Para cada grupo: contar greens, reds, somar lucro
3. Buscar nome do metodo em `bankroll.methods`
4. Renderizar como flex-wrap de badges compactos

