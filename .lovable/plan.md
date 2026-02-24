
Objetivo: garantir que a aba **Lay 0x1** apareça no menu inferior em qualquer tela mobile (inclusive no preview estreito), sem “sumir” para fora da largura visível.

Diagnóstico confirmado no código + print:
- A rota existe (`/lay-0x1`) e já está no `navItems` do `BottomNav`.
- O problema não é rota faltando; é **layout responsivo do menu inferior**.
- Hoje o menu usa `flex + justify-around + min-w-[60px]` em 6 itens. Em larguras menores, isso empurra o último item para fora da viewport.
- O print mostra exatamente esse comportamento: aparecem 5 abas e a 6ª fica cortada.

Escopo de implementação (sem backend):
1) Reestruturar o layout do `BottomNav` para distribuição fixa por coluna
- Arquivo: `src/components/BottomNav.tsx`
- Trocar o container interno de `flex justify-around` para `grid grid-cols-6`.
- Em cada item, remover `min-w-[60px]` e usar `min-w-0 w-full` para permitir encolhimento sem overflow horizontal.
- Resultado esperado: sempre 6 posições visíveis, uma por coluna.

2) Ajustar tipografia/espaçamento para caber em telas estreitas
- Arquivo: `src/components/BottomNav.tsx`
- Reduzir padding horizontal dos itens (ex.: `px-1`/`px-1.5`).
- Manter ícone compacto (ex.: `h-4.5` ou `h-4` se necessário).
- Aplicar label com `truncate whitespace-nowrap text-[9px]-[10px]` para impedir quebra e empurrão lateral.
- Se necessário, encurtar apenas o rótulo visual de `Lay 0x1` para `Lay` em telas muito estreitas (sem mudar rota).

3) Garantia extra para telas ultra estreitas
- Arquivo: `src/components/BottomNav.tsx`
- Adicionar fallback responsivo para esconder rótulos abaixo de um breakpoint crítico (ex.: `max-[340px]:hidden`) e manter só ícones.
- Isso evita novo sumiço em ambientes de preview com viewport reduzida.

4) Consistência visual e acessibilidade
- Arquivo: `src/components/BottomNav.tsx`
- Preservar estilo ativo/inativo atual.
- Garantir área de toque adequada em todos os itens.
- Adicionar/confirmar `aria-label` por item para manter usabilidade quando rótulo for ocultado em telas muito pequenas.

Validação (ponta a ponta):
1. Testar em largura 390, 375, 360 e 320:
   - todas as 6 abas devem ficar visíveis.
   - `Lay 0x1` deve aparecer e ser clicável.
2. Navegar por cada aba do bottom nav e verificar rota ativa.
3. Confirmar que o menu desktop não foi afetado.
4. Testar no fluxo real mobile (Preview no celular e app publicado) para garantir que não há corte lateral.

Critérios de aceite:
- A aba Lay 0x1 aparece no celular sem depender de scroll lateral.
- Nenhum item do menu inferior fica fora da tela.
- Navegação por todas as abas continua funcionando normalmente.
