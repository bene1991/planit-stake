
## Relatório de Operações em PDF

### O Que Será Criado

Um sistema completo de exportação de relatórios em PDF com filtros avançados, contendo informações detalhadas de cada operação (times, stake, odd, resultado) em um layout profissional.

---

### Funcionalidade

O usuário poderá na página de **Desempenho**:
1. Aplicar filtros (período, método, liga, resultado)
2. Clicar em "Exportar PDF"
3. Receber um PDF profissional com:
   - Cabeçalho com logo e período
   - Resumo estatístico (total operações, win rate, lucro)
   - Tabela detalhada de todas as operações

---

### Estrutura do PDF

```text
┌──────────────────────────────────────────────────────────────┐
│  📊 ViniTrader - Relatório de Operações                      │
│  Período: 01/01/2026 - 31/01/2026                            │
│  Método: BTTS | Liga: Premier League                         │
├──────────────────────────────────────────────────────────────┤
│  RESUMO                                                       │
│  ┌──────────┬──────────┬──────────┬──────────┐               │
│  │ Total    │ Greens   │ Reds     │ Win Rate │               │
│  │ 45       │ 32       │ 13       │ 71.1%    │               │
│  └──────────┴──────────┴──────────┴──────────┘               │
│  Lucro Período: +R$ 1.250,00                                 │
├──────────────────────────────────────────────────────────────┤
│  DETALHAMENTO DAS OPERAÇÕES                                   │
│  ┌────────┬───────┬───────────────────┬───────┬──────┬─────┐ │
│  │ Data   │ Hora  │ Jogo              │ Stake │ Odd  │ Res │ │
│  ├────────┼───────┼───────────────────┼───────┼──────┼─────┤ │
│  │ 15/01  │ 14:00 │ Arsenal x Chelsea │ R$100 │ 2.10 │ ✓   │ │
│  │ 15/01  │ 16:30 │ Liverpool x Man U │ R$100 │ 2.25 │ ✓   │ │
│  │ 16/01  │ 12:00 │ Everton x Wolves  │ R$100 │ 2.15 │ ✗   │ │
│  └────────┴───────┴───────────────────┴───────┴──────┴─────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

### Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `package.json` | Adicionar `jspdf` e `jspdf-autotable` |
| `src/utils/exportToPDF.ts` | Novo - função de geração de PDF |
| `src/components/PDFExportButton.tsx` | Novo - botão com modal de opções |
| `src/pages/Performance.tsx` | Adicionar botão de exportação PDF |

---

### Detalhes Técnicos

#### 1. Dependências
```json
{
  "jspdf": "^2.5.2",
  "jspdf-autotable": "^3.8.4"
}
```

**jsPDF** é a biblioteca mais popular para geração de PDF no navegador, leve (~300KB) e sem dependências de backend.

#### 2. Função de Exportação (`exportToPDF.ts`)

```typescript
interface PDFExportOptions {
  games: Game[];
  methods: Method[];
  filters: StatisticsFilters;
  stats: {
    total: number;
    greens: number;
    reds: number;
    winRate: number;
    profitReais: number;
  };
}

export function exportOperationsToPDF(options: PDFExportOptions) {
  // Criar documento
  // Adicionar cabeçalho com logo/título
  // Adicionar resumo estatístico
  // Adicionar tabela com autoTable
  // Salvar arquivo
}
```

#### 3. Colunas da Tabela

| Coluna | Dados |
|--------|-------|
| Data | `game.date` formatado DD/MM/YYYY |
| Hora | `game.time` |
| Liga | `game.league` |
| Time Casa | `game.homeTeam` |
| Time Fora | `game.awayTeam` |
| Método | `method.name` |
| Tipo | Back / Lay |
| Stake | `R$ X,XX` |
| Odd | `X.XX` |
| Resultado | Green ✓ / Red ✗ |
| Lucro | `R$ ±X,XX` |

#### 4. Formatação

- **Verde** para operações Green
- **Vermelho** para operações Red
- **Zebra stripes** nas linhas (alternando cinza claro)
- **Fonte**: Helvetica (padrão do jsPDF)
- **Tamanho A4** orientação paisagem (mais espaço para colunas)

---

### Interface do Botão

Na página de Desempenho, ao lado do botão CSV existente:

```
[📄 Atualizar] [📥 CSV] [📄 PDF ▼]
                         ├── Relatório Completo
                         ├── Apenas Resumo
                         └── Por Método
```

Ou versão simples:
```
[📄 PDF]
```
Que exporta diretamente com os filtros atuais.

---

### Fluxo de Exportação

```text
Usuário aplica filtros
       │
       ▼
Clica em "PDF"
       │
       ▼
Sistema coleta:
  - Games filtrados
  - Métodos
  - Stats calculados
       │
       ▼
Gera PDF com jsPDF
       │
       ▼
Download automático:
  relatorio_YYYY-MM-DD.pdf
```

---

### Benefícios

1. **Profissional** - Layout organizado para análise/compartilhamento
2. **Filtrado** - Respeita todos os filtros aplicados
3. **Completo** - Todas as informações financeiras importantes
4. **Offline** - Gerado 100% no navegador, sem servidor
5. **Rápido** - Download imediato após clique

---

### Ordem de Implementação

1. Instalar jspdf e jspdf-autotable
2. Criar função `exportOperationsToPDF`
3. Criar componente `PDFExportButton`
4. Integrar na página de Desempenho
5. Testar com diferentes filtros e volumes de dados
