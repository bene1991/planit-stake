

## Tres Validacoes Estatisticas para Analise de Metodo

### Resumo

Adicionar tres camadas de validacao (Robustez, Estabilidade Temporal, Dependencia de Variancia) calculadas no hook `useMethodAnalysis`, exibidas como selos nos cards e detalhadas na view de detalhe. A IA (edge function `analyze-method`) recebera os dados das validacoes e gerara uma frase de diagnostico integrada.

### Arquitetura

Toda a logica das 3 validacoes sera calculada no frontend (hook `useMethodAnalysis`), pois os dados necessarios ja estao disponiveis localmente (operacoes, ligas, odds, datas, lucros). A IA apenas interpreta os resultados.

---

### Validacao 1 -- Robustez do Metodo

**Logica (no hook):**
- Agrupar operacoes por liga e faixa de odds (ja existem em `contextAnalysis`)
- Calcular o desvio padrao do Win Rate entre os contextos com 5+ operacoes
- Se desvio < 10%: Robusto
- Se desvio 10-20%: Sensivel a Contexto
- Se desvio > 20%: Fragil

**Saida:** `{ label: 'Robusto' | 'Sensivel' | 'Fragil', score: number, details: string }`

---

### Validacao 2 -- Estabilidade Temporal

**Logica (no hook):**
- Comparar Win Rate e ROI das ultimas 30 operacoes vs historico total
- Se diferenca < 5pp: Estavel
- Se diferenca 5-15pp: Oscilante
- Se diferenca > 15pp (negativa): Em Deterioracao

**Saida:** `{ label: 'Estavel' | 'Oscilante' | 'Deterioracao', recentWinRate: number, recentRoi: number }`

---

### Validacao 3 -- Dependencia de Variancia

**Logica (no hook):**
- Ordenar operacoes por lucro decrescente
- Calcular % do lucro total vindo do top 10% das operacoes
- Se top10% < 40% do lucro: Distribuido
- Se top10% entre 40-70%: Concentrado
- Se top10% > 70%: Evento Raro

**Saida:** `{ label: 'Distribuido' | 'Concentrado' | 'EventoRaro', topPercentContribution: number }`

---

### Integracao com Status do Metodo

Na funcao `determinePhase`, adicionar regra:
- Metodo com 51+ ops, edge positivo, MAS marcado como "Fragil" ou "Deterioracao" nao pode ser "Validado" -- permanece "Sinal Fraco"
- Metodo "Robusto" + "Estavel" + "Distribuido" reforça "Validado"

---

### Alteracoes por Arquivo

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useMethodAnalysis.ts` | Adicionar interface `MethodValidations`, 3 funcoes de calculo, incluir no retorno de `MethodAnalysisData`, ajustar `determinePhase` |
| `src/components/MethodAnalysis/MethodAnalysisCard.tsx` | Exibir 3 selos compactos abaixo dos scores (ex: "Robusto", "Estavel", "Lucro Distribuido") |
| `src/components/MethodAnalysis/MethodAnalysisDetail.tsx` | Adicionar card de "Validacoes Avancadas" com detalhes das 3 classificacoes e explicacoes |
| `supabase/functions/analyze-method/index.ts` | Incluir dados das validacoes no prompt da IA para que a recomendacao considere robustez, estabilidade e variancia |

---

### Detalhes Tecnicos

#### Nova interface em `useMethodAnalysis.ts`

```text
interface MethodValidations {
  robustness: {
    label: 'Robusto' | 'Sensivel' | 'Fragil';
    stdDev: number;
    contextCount: number;
  };
  stability: {
    label: 'Estavel' | 'Oscilante' | 'Deterioracao';
    recentWinRate: number;
    recentRoi: number;
    deltaWinRate: number;
    deltaRoi: number;
  };
  variance: {
    label: 'Distribuido' | 'Concentrado' | 'EventoRaro';
    topPercentContribution: number;
  };
}
```

Este campo `validations` sera adicionado a `MethodAnalysisData`.

#### Selos no Card (MethodAnalysisCard)

Tres badges pequenos em uma linha horizontal abaixo da sequencia atual:

```text
[check Robusto] [relogio Estavel] [check Lucro Distribuido]
```

Cores: verde para positivo, amarelo para medio, vermelho para negativo. Sem ocupar espaco extra significativo.

#### Detalhes na View (MethodAnalysisDetail)

Um novo Card "Validacoes Avancadas" entre os Alertas e a Recomendacao da IA, com 3 colunas mostrando cada validacao com icone, classificacao e uma linha de detalhe.

#### Edge Function (analyze-method)

Adicionar ao prompt do usuario as classificacoes:

```text
VALIDACOES:
- Robustez: Fragil (desvio padrao 25% entre contextos)
- Estabilidade: Em Deterioracao (WR recente 45% vs historico 62%)
- Variancia: Concentrado (top 10% = 55% do lucro)
```

A IA ja tem a funcao `provide_recommendation` -- ela naturalmente incorporara esses dados na explicacao.

### Ordem de Implementacao

1. `useMethodAnalysis.ts` -- adicionar calculos e interface
2. `MethodAnalysisCard.tsx` -- adicionar selos
3. `MethodAnalysisDetail.tsx` -- adicionar card de validacoes
4. `analyze-method/index.ts` -- enriquecer prompt com validacoes

