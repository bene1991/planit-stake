

## Corrigir Data do Resumo do Dia - Bug de Timezone

### Problema

A funcao `getTodayDate()` em `DailyPlanning.tsx` tem um calculo de offset errado:

```text
brasiliaOffset = -3 * 60 = -180
localOffset (usuario em Brasilia) = 180
offsetDiff = 180 - (-180) = 360 minutos = +6 horas
```

Isso soma 6 horas a mais ao horario atual. As 18:10 de Brasilia, o calculo gera 00:10 do dia seguinte (2026-02-09). Como nao existem jogos em 2026-02-09, todos os cards mostram zero.

### Solucao

Substituir a funcao `getTodayDate()` pelo helper correto `getNowInBrasilia()` que ja existe no projeto (`src/utils/timezone.ts`) e e usado em outros lugares.

### Arquivo a modificar

**`src/pages/DailyPlanning.tsx`** (linhas 332-342)

Trocar:

```text
// ANTES (bugado):
const getTodayDate = () => {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const localOffset = now.getTimezoneOffset();
  const offsetDiff = localOffset - brasiliaOffset;
  const today = new Date(now.getTime() + offsetDiff * 60000);
  return format(today, 'yyyy-MM-dd');
};
const todayDate = getTodayDate();
```

```text
// DEPOIS (correto):
import { getNowInBrasilia } from '@/utils/timezone';

const todayDate = format(getNowInBrasilia(), 'yyyy-MM-dd');
```

Isso vai gerar `2026-02-08` corretamente e o filtro `games.filter(g => g.date === todayDate)` vai encontrar os 60 jogos do dia, mostrando as 49 operacoes com resultados nos cards.

### Impacto

- Nenhuma mudanca visual
- Apenas corrige o calculo da data para usar o helper ja testado
- Os 4 cards vao mostrar os dados corretos do dia (27G/22R, 55.1% win rate, etc.)

