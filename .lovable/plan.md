
## Plano: Score Combinado para Determinar o Melhor Método

### Problema Atual
Atualmente, o "Melhor Método" é determinado exclusivamente pelo **Win Rate** (taxa de acerto). Isso pode ser enganoso porque:
- Um método com 100% WR em apenas 2 operações é considerado "melhor" que um com 85% WR em 100 operações
- Não considera o lucro financeiro real
- Ignora a consistência e volume de operações

### Solução: Score Combinado (0-100)

Criar uma métrica ponderada que considera três fatores principais:

| Fator | Peso | Justificativa |
|-------|------|---------------|
| **Win Rate relativo** | 35% | Taxa de acerto comparada ao breakeven |
| **Volume de operações** | 25% | Significância estatística e consistência |
| **Lucro total (R$)** | 40% | Resultado financeiro real |

### Fórmula do Score

```
Score = (WR_Score × 0.35) + (Volume_Score × 0.25) + (Profit_Score × 0.40)
```

**Componentes:**

1. **WR_Score (0-100)**:
   - Se WR >= breakeven: `50 + min(50, (WR - breakeven) × 5)`
   - Se WR < breakeven: `max(0, 50 - (breakeven - WR) × 5)`

2. **Volume_Score (0-100)**:
   - Volume mínimo para consideração: 5 operações
   - Normalizado: `min(100, (operações / média_operações) × 50)`
   - Bonus para consistência: +10 se presente em >50% dos dias ativos

3. **Profit_Score (0-100)**:
   - Lucro >= 0: `50 + min(50, lucro_normalizado)`
   - Lucro < 0: `max(0, 50 + lucro_normalizado)`
   - Normalização: baseada no maior lucro/prejuízo entre métodos

### Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/hooks/useFilteredStatistics.ts` | Calcular lucro e score por método, atualizar interface `bestMethod` |
| `src/pages/Performance.tsx` | Exibir score no card "Melhor Método" |

### Detalhes Técnicos

#### 1. Nova Interface MethodDetailStats
```typescript
interface MethodDetailStats extends MethodStats {
  // ... campos existentes ...
  profitReais: number;      // Lucro total em R$
  combinedScore: number;    // Score combinado 0-100
  activeDays: number;       // Dias com operações
}
```

#### 2. Nova Interface BestMethod
```typescript
bestMethod: { 
  name: string; 
  winRate: number;
  volume: number;
  profitReais: number;
  combinedScore: number;
} | null;
```

#### 3. Lógica de Cálculo
- Calcular lucro em R$ por método (usando a lógica existente de `dailyMethodProfitMap`)
- Calcular média de volume entre todos os métodos ativos
- Normalizar todos os fatores para 0-100
- Aplicar pesos e somar
- Ordenar métodos por `combinedScore` (não mais por WR)

### UI Atualizada

O card "Melhor Método" mostrará:
```
┌─────────────────────────────┐
│ 🏆 Melhor Método            │
│ ─────────────────────────── │
│ BTTS                        │
│                             │
│ Score: 78/100               │
│ WR: 65% • Vol: 42 • +R$510  │
└─────────────────────────────┘
```

### Benefícios

1. **Decisão mais inteligente** - Considera múltiplos fatores
2. **Evita falsos positivos** - Métodos com poucas operações não dominam
3. **Foco no resultado real** - Lucro financeiro tem peso maior
4. **Transparência** - Usuário vê os componentes do score

### Volume Mínimo

Métodos com menos de 5 operações receberão penalidade automática no score (volume_score muito baixo), evitando que apareçam como "melhor" apenas por sorte estatística.
