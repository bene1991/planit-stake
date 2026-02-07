
## Adicionar Posse, Chutes Totais e Chutes no Gol nos Tooltips do LDI

### O que muda

Ao passar o mouse no score LDI de cada time, alem da explicacao textual que ja existe, o tooltip vai mostrar os dados reais do jogo: posse de bola, chutes totais e chutes no gol.

### Exemplo do tooltip atualizado

```
Tigres UANL -- LDI 36/100

Tigres UANL esta sendo dominado. Adversario controla as acoes do jogo.

Posse: 38% | Chutes: 4 (2 no gol)

Calculado a partir de posse de bola, chutes, chutes no gol e escanteios.
```

### Arquivos a editar

**1. `src/components/LiveDominanceDisplay.tsx`**
- Adicionar prop opcional `normalizedStats` (tipo `NormalizedStats` importado de `useFixtureCache`)
- Nos tooltips do home e away, adicionar uma linha com os valores reais: posse %, chutes totais e chutes no gol
- Mostrar apenas quando os dados existem (fallback graceful)

**2. `src/components/GameListItem.tsx`**
- Passar `fixtureCache?.normalized_stats` como prop para `LiveDominanceDisplay`

**3. `src/components/GameCardCompact.tsx`**
- Mesmo ajuste: passar `normalized_stats` para `LiveDominanceDisplay`

### Detalhes tecnicos

Nova prop no componente:

```text
interface LiveDominanceDisplayProps {
  result: DominanceResult;
  homeTeam: string;
  awayTeam: string;
  ldiHistory?: LdiSnapshot[];
  normalizedStats?: NormalizedStats;  // <-- nova
}
```

Linha extra no tooltip:

```text
{normalizedStats && (
  <p className="text-[10px] text-muted-foreground mt-0.5">
    Posse: {possession}% | Chutes: {shots_total} ({shots_on} no gol)
  </p>
)}
```

Os dados de cada time (home/away) serao exibidos no tooltip do respectivo time, usando `normalizedStats.home` e `normalizedStats.away`.
