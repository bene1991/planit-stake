
## Historico LDI Sparkline + Tooltips Explicativos

### Visao Geral

Duas melhorias no indicador de dominancia:

1. **Sparkline do LDI** - Mini-grafico mostrando a evolucao do indice ao longo do jogo, construido acumulando snapshots do LDI a cada atualizacao do cache
2. **Tooltips explicativos** - Ao tocar/hover no valor LDI ou na barra, o usuario ve uma explicacao do que cada faixa significa

---

### Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useLdiHistory.ts` | Hook que acumula snapshots `{ minute, ldi }` em um ref a cada mudanca do cache, retornando o array para o sparkline |
| `src/components/LdiSparkline.tsx` | Componente SVG puro que desenha a linha do historico LDI (sem dependencia de recharts para manter leve) |

### Arquivos a Editar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/GameListItem.tsx` | Integrar `useLdiHistory` e passar o historico para `DominanceIndicator` |
| `src/components/DominanceIndicator.tsx` | Adicionar sparkline + tooltips |

---

### Detalhes Tecnicos

#### Hook `useLdiHistory`

```typescript
interface LdiSnapshot {
  minute: number;
  ldi: number;
}

function useLdiHistory(
  fixtureId: number | undefined,
  minuteNow: number | undefined,
  ldi: number | null
): LdiSnapshot[]
```

- Usa `useRef` para manter array de snapshots entre renders
- A cada mudanca de `minuteNow` ou `ldi`, adiciona um novo ponto se o minuto mudou (evita duplicatas)
- Limpa o historico se o `fixtureId` mudar (novo jogo)
- Retorna o array completo para render
- O historico e local (em memoria) - se o usuario recarrega a pagina, comeca do zero, o que e aceitavel para dados ao vivo

#### Componente `LdiSparkline`

Componente SVG inline, sem dependencia externa:

- Recebe `data: LdiSnapshot[]` e dimensoes (`width=120, height=24`)
- Desenha polyline com os pontos mapeados (eixo X = minuto, eixo Y = LDI 0-100)
- Linha central tracejada em 50 (equilibrio)
- Cor da linha: gradiente de emerald (casa) a violet (visitante) baseado no ultimo valor
- Mostra apenas quando ha pelo menos 2 pontos
- Tamanho compacto para caber no card sem poluir

Visual aproximado:
```text
     ╭──╮
────╯    ╰──── (linha LDI)
- - - - - - -  (linha 50, equilibrio)
```

#### Tooltips no DominanceIndicator

Usar o componente `Tooltip` ja existente (`@/components/ui/tooltip`):

1. **Tooltip no valor LDI** (ex: "68 LDI"):
   - Conteudo: Tabela com as faixas
   ```
   Live Dominance Index
   65-100: Casa domina
   55-64:  Casa com vantagem
   45-54:  Equilibrado
   35-44:  Visitante com vantagem
   0-34:   Visitante domina
   ```

2. **Tooltip na barra de dominancia**:
   - Conteudo: "Verde = Casa | Violeta = Visitante"

3. **Tooltip no sparkline**:
   - Conteudo: "Evolucao do LDI ao longo do jogo"

Todos envolvidos em `TooltipProvider` + `Tooltip` + `TooltipTrigger` + `TooltipContent`.

#### Integracao no GameListItem

Adicionar o hook `useLdiHistory` passando `fixtureCache?.minute_now` e `dominance.dominanceIndex`, e repassar o array `ldiHistory` para o `DominanceIndicator` via nova prop.

#### Layout atualizado do DominanceIndicator

```text
[Status] [Casa domina] [68 LDI (tooltip)]  [sparkline ~~~~]
[═══════════════════ barra (tooltip) ══════════════════════]
[alertas...]
```

O sparkline fica na mesma linha do label/LDI, alinhado a direita, ocupando ~120px de largura.

---

### Ordem de Implementacao

1. Criar `useLdiHistory.ts`
2. Criar `LdiSparkline.tsx`
3. Editar `DominanceIndicator.tsx` (adicionar sparkline + tooltips)
4. Editar `GameListItem.tsx` (integrar useLdiHistory)
