
## Adicionar opcao "Void" na finalizacao de metodos

### Resumo
Adicionar "Void" como terceira opcao de resultado (alem de Green e Red) ao finalizar um metodo. Void significa que a operacao foi anulada (ex: jogo terminou 0x0 no Lay 0x1/1x0). Void tem lucro zero e aparece nos relatorios como "Void".

### Alteracoes necessarias

**1. Tipo `MethodOperation` (`src/types/index.ts`)**
- Alterar o tipo `result` de `'Green' | 'Red'` para `'Green' | 'Red' | 'Void'`

**2. Calculadora de lucro (`src/utils/profitCalculator.ts`)**
- Tratar `result === 'Void'` retornando lucro 0

**3. Botoes de resultado nos cards de jogo**
- **`src/components/GameCardCompact.tsx`**: Adicionar botao Void (circulo amarelo/cinza com icone "Minus") ao lado dos botoes Green/Red
- **`src/components/GameListItem.tsx`**: Mesmo botao Void
- Atualizar `handleResultClick` para aceitar `'Void'` alem de `'Green' | 'Red'`
- Estilizar pill do metodo com cor amarela/cinza quando Void

**4. Editor de metodos no modal (`src/components/GameMethodEditor.tsx`)**
- Adicionar opcao "Void" no Select de resultado (com icone Minus, cor amarela)
- Atualizar tipo `MethodFormData.result` para incluir `'Void'`
- Tratar badge de Void no cabecalho do metodo

**5. Resumo Telegram (`src/components/TelegramSummaryMessage.tsx`)**
- Alterar tipo `SummaryItem.result` para incluir `'Void'`
- Void aparece como "Void" na mensagem (nao conta como Green nem Red)
- Stake percent = 0% para Void

**6. Estatisticas e filtros**
- Em `src/hooks/useFilteredStatistics.ts`: Void conta como operacao finalizada (tem result), mas nao e Green nem Red - nao afeta win rate
- Em `src/hooks/useStatistics.ts`: Mesmo tratamento
- Nos graficos e badges que checam `op.result === 'Green'` ou `op.result === 'Red'`: Void simplesmente nao entra em nenhum dos dois, o que ja e o comportamento correto na maioria dos casos

**7. Reconstrucao de stats (`src/utils/rebuildStats.ts`)**
- Adicionar Void como resultado possivel (lucro 0)

### Detalhes tecnicos

- **Lucro Void = 0**: Nenhum dinheiro ganho ou perdido
- **Win Rate**: Void NAO entra no calculo. Win Rate = Greens / (Greens + Reds). Voids sao ignorados
- **Cor visual**: Amarelo/amber para Void (consistente com "neutro")
- **Icone**: `Minus` do lucide-react
- **Database**: A coluna `result` na tabela `method_operations` ja e tipo `text`, entao aceita "Void" sem migracao

### Arquivos modificados
1. `src/types/index.ts`
2. `src/utils/profitCalculator.ts`
3. `src/components/GameCardCompact.tsx`
4. `src/components/GameListItem.tsx`
5. `src/components/GameMethodEditor.tsx`
6. `src/components/TelegramSummaryMessage.tsx`
7. `src/hooks/useFilteredStatistics.ts`
8. `src/utils/rebuildStats.ts`
