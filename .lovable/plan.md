

## Adicionar botao "Bloquear Liga" nos cards do Scanner

### Objetivo

Permitir bloquear ligas diretamente nos cards de jogos reprovados (e aprovados) no Scanner, sem precisar ir ate a aba Config.

### Mudancas

#### 1. Lay0x1ScoreCard.tsx — Nova prop `onBlockLeague`

- Adicionar prop opcional `onBlockLeague?: (leagueName: string) => void`
- Exibir um botao pequeno (icone `Ban` + texto "Bloquear liga") ao lado do nome da liga
- O botao chama `onBlockLeague(league)` ao ser clicado
- Estilo discreto: ghost/outline vermelho, tamanho pequeno

#### 2. Lay0x1Scanner.tsx — Passar a funcao de bloqueio

- Importar `blockLeague` do hook `useLay0x1BlockedLeagues` (ja importado via `blockedNames`)
- Passar `onBlockLeague={blockLeague}` para todos os `Lay0x1ScoreCard` (aprovados e reprovados)
- Como `blockedNames` ja filtra os resultados exibidos (`filteredResults`), ao bloquear uma liga os cards dessa liga desaparecem automaticamente da lista

### Fluxo do usuario

1. Ve um jogo de uma liga indesejada nos resultados
2. Clica no botao "Bloquear" no card
3. A liga e adicionada a `lay0x1_blocked_leagues` com reason `nao_disponivel`
4. Todos os cards daquela liga somem imediatamente da lista
5. Para desbloquear, vai na aba Config > Ligas Bloqueadas

### Detalhes tecnicos

**ScoreCard** (`Lay0x1ScoreCard.tsx`):
- Nova prop: `onBlockLeague?: (leagueName: string) => void`
- Botao posicionado proximo ao nome da liga, com icone `Ban` e tooltip/texto "Bloquear liga"

**Scanner** (`Lay0x1Scanner.tsx`):
- Desestruturar `blockLeague` do `useLay0x1BlockedLeagues()` (linha 98)
- Passar `onBlockLeague={(name) => blockLeague(name, 'nao_disponivel')}` em cada `Lay0x1ScoreCard`

### Arquivos modificados

- `src/components/Lay0x1/Lay0x1ScoreCard.tsx`
- `src/components/Lay0x1/Lay0x1Scanner.tsx`

