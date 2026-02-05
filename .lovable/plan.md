

## Correções e Nova Ferramenta BTTS

### Problema 1: Erro na Análise de IA do Fechamento Mensal

**Diagnóstico:**
O erro `TypeError: Cannot read properties of undefined (reading 'isFiltered')` ocorre porque:
- A edge function `analyze-performance` espera receber `performanceData` com a estrutura completa (incluindo `isFiltered`, `activeFilters`, etc.)
- O hook `useMonthlyReport.ts` está enviando apenas `{ prompt }` ao invés de `{ performanceData, structuredOutput: true }`

**Solução:**
Modificar o `useMonthlyReport.ts` para enviar os dados no formato correto que a edge function espera.

---

### Problema 2: Ferramenta para BTTS (Ambas Marcam)

O sistema já possui:
- Tabela `btts_entries` para registrar operações BTTS
- Tabela `btts_health_settings` para configurações de saúde
- Tabela `btts_league_quarantine` para quarentena de ligas
- Edge function `the-odds-api` para buscar odds BTTS
- Hook `useTheOddsBtts.ts` para consumir a API

**O que falta:** Uma página/interface dedicada para gerenciar operações BTTS.

---

### Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useMonthlyReport.ts` | Corrigir formato de envio para a edge function |
| `src/pages/BttsTracker.tsx` | **CRIAR** - Página dedicada para BTTS |
| `src/hooks/useBttsEntries.ts` | **CRIAR** - Hook para CRUD de operações BTTS |
| `src/components/BttsEntryForm.tsx` | **CRIAR** - Formulário para adicionar entradas |
| `src/components/BttsStatsCard.tsx` | **CRIAR** - Card com estatísticas BTTS |
| `src/components/BttsQuarantineManager.tsx` | **CRIAR** - Gerenciador de quarentena de ligas |
| `src/App.tsx` | Adicionar rota `/btts` |
| `src/components/Layout.tsx` | Adicionar link na navegação |
| `src/components/BottomNav.tsx` | Adicionar ícone na barra mobile |

---

### Correção da Análise Mensal

```typescript
// useMonthlyReport.ts - ANTES (incorreto)
const { data, error } = await supabase.functions.invoke('analyze-performance', {
  body: { prompt }
});

// DEPOIS (correto)
const performanceData = {
  period: formatMonthYear(selectedMonth),
  overallStats: {
    total: stats.totalOperations,
    greens: stats.greens,
    reds: stats.reds,
    winRate: stats.winRate,
  },
  profit: stats.profitStakes,
  totalProfitReais: stats.profitMoney,
  averageOdd: 2.0, // default
  breakevenRate: 50,
  methodStats: stats.methodRanking.map(m => ({
    methodName: m.name,
    total: m.operations,
    greens: Math.round(m.operations * m.winRate / 100),
    reds: m.operations - Math.round(m.operations * m.winRate / 100),
    winRate: m.winRate,
    profitReais: m.profit,
    combinedScore: 50,
    activeDays: 10,
  })),
  topLeagues: [],
  bottomLeagues: [],
  topTeams: [],
  bottomTeams: [],
  oddRangeStats: [],
  comparison: { winRateChange: 0, volumeChange: 0 },
  isFiltered: false,
  generalWinRate: stats.winRate,
};

const { data, error } = await supabase.functions.invoke('analyze-performance', {
  body: { performanceData, structuredOutput: true }
});
```

---

### Nova Ferramenta BTTS - Funcionalidades

```text
┌──────────────────────────────────────────────────────────────┐
│  🎯 BTTS Tracker                                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 Estatísticas Rápidas                                     │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐   │
│  │ Win Rate    │ Lucro Total │ ROI         │ Operações   │   │
│  │ 68.5%       │ +R$ 850     │ +12.3%      │ 45          │   │
│  └─────────────┴─────────────┴─────────────┴─────────────┘   │
│                                                              │
│  ➕ Nova Entrada BTTS                                        │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Liga: [Premier League    ▼]  Data: [05/02/2026]         ││
│  │ Casa: [Liverpool        ]    Fora: [Chelsea            ]││
│  │ Odd: [2.05             ]    Stake: [R$ 100            ]││
│  │ Resultado: ◉ Green ○ Red                                 ││
│  │                                        [Salvar]          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  📋 Histórico de Entradas                                    │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 04/02 | Liverpool x Chelsea    | 2.05 | ✅ +R$105       ││
│  │ 03/02 | Arsenal x Man United   | 2.15 | ❌ -R$100       ││
│  │ 02/02 | Everton x Newcastle    | 2.25 | ✅ +R$125       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ⚠️ Ligas em Quarentena                                      │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Serie B Brasil - Até 15/02/2026 (3 reds seguidos)       ││
│  │ [Remover Quarentena]                                     ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### Hook useBttsEntries

```typescript
interface BttsEntry {
  id: string;
  date: string;
  time: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  odd: number;
  stakeValue: number;
  result: 'Green' | 'Red';
  profit: number;
  method: string;
}

interface UseBttsEntriesResult {
  entries: BttsEntry[];
  loading: boolean;
  stats: {
    total: number;
    greens: number;
    reds: number;
    winRate: number;
    profit: number;
    roi: number;
  };
  addEntry: (entry: Omit<BttsEntry, 'id' | 'profit'>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  quarantine: LeagueQuarantine[];
  addQuarantine: (league: string, days: number, reason: string) => Promise<void>;
  removeQuarantine: (id: string) => Promise<void>;
}
```

---

### Ordem de Implementação

1. **Corrigir erro da análise mensal** - Ajustar formato de dados no `useMonthlyReport.ts`
2. **Criar hook `useBttsEntries`** - CRUD para operações BTTS
3. **Criar página `BttsTracker`** - Interface principal
4. **Criar componentes auxiliares** - Form, Stats, Quarantine
5. **Adicionar navegação** - Rotas e links na sidebar/bottomnav

---

### Benefícios da Ferramenta BTTS

1. **Rastreamento dedicado** - Separar BTTS das outras operações
2. **Estatísticas específicas** - Win rate, ROI, lucro focado em BTTS
3. **Quarentena de ligas** - Pausar ligas com resultados ruins
4. **Histórico organizado** - Ver todas as entradas BTTS em um lugar
5. **Fácil entrada** - Formulário otimizado para adicionar operações

