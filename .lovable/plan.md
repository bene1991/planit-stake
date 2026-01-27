
## Plano: Indicador Visual para Odd e Valor de Entrada

### Objetivo
Adicionar um indicador visual que sinalize claramente quais jogos/métodos já tiveram a **odd** e o **valor de entrada (stake)** preenchidos, facilitando a gestão de múltiplos jogos.

### Implementação

#### 1. Criar indicador de "dados financeiros preenchidos" no pill de método

Nos componentes `GameListItem.tsx` e `GameMethodEditor.tsx`, adicionar um ícone ou badge que indique o status de preenchimento:

**Estados visuais:**
- Sem dados (odd + stake vazios): Pill neutro sem ícone adicional
- Parcial (só odd OU só stake): Ícone de alerta amarelo
- Completo (odd + stake preenchidos): Ícone de moeda/check verde

#### 2. Modificar `GameListItem.tsx` - Pills de Método

**Localização:** Linha ~376-392 onde os pills de método são renderizados

**Mudanças:**
```tsx
// Adicionar lógica para verificar preenchimento
const hasFinancialData = (op: MethodOperation) => {
  const hasOdd = op.odd && op.odd > 0;
  const hasStake = op.stakeValue && op.stakeValue > 0;
  return { hasOdd, hasStake, complete: hasOdd && hasStake };
};

// No pill, adicionar indicador visual
{operation.result === 'Green' && <Check className="h-2.5 w-2.5" />}
{operation.result === 'Red' && <X className="h-2.5 w-2.5" />}
{/* NOVO: Indicador de dados financeiros */}
{!operation.result && hasFinancialData(operation).complete && (
  <DollarSign className="h-2.5 w-2.5 text-emerald-400" />
)}
{!operation.result && !hasFinancialData(operation).complete && 
 (hasFinancialData(operation).hasOdd || hasFinancialData(operation).hasStake) && (
  <AlertCircle className="h-2.5 w-2.5 text-amber-400" />
)}
```

#### 3. Modificar `GameMethodEditor.tsx` - Cards de Método no Modal

**Localização:** Linha ~170-230 onde os cards de método são renderizados

**Mudanças:**
- Adicionar badge visual indicando status de preenchimento
- Quando odd + stake estiverem preenchidos, mostrar badge verde "Dados OK"
- Quando parcialmente preenchido, mostrar badge amarelo "Incompleto"

```tsx
// Adicionar badge ao lado do nome do método
{data.odd && data.stakeValue ? (
  <Badge variant="default" className="text-[9px] bg-emerald-500/20 text-emerald-400 gap-0.5">
    <DollarSign className="h-2.5 w-2.5" />
    Completo
  </Badge>
) : (data.odd || data.stakeValue) ? (
  <Badge variant="secondary" className="text-[9px] bg-amber-500/20 text-amber-400 gap-0.5">
    <AlertCircle className="h-2.5 w-2.5" />
    Incompleto
  </Badge>
) : null}
```

#### 4. Adicionar resumo na seção expandida do `GameListItem.tsx`

Na seção expandida (linha ~396-443), adicionar info visual:

```tsx
// Ao lado de cada método na área expandida, mostrar valores preenchidos
{operation.stakeValue && operation.odd && (
  <span className="text-[9px] text-muted-foreground">
    R$ {operation.stakeValue.toFixed(2)} @ {operation.odd.toFixed(2)}
  </span>
)}
```

#### 5. Contador global na página de Planejamento (opcional)

Adicionar um contador no topo mostrando quantos jogos têm dados completos vs pendentes:

```
📊 15 jogos | 8 com dados | 7 pendentes
```

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/GameListItem.tsx` | Adicionar indicadores nos pills e seção expandida |
| `src/components/GameMethodEditor.tsx` | Adicionar badges de status nos cards de método |

### Resultado Esperado

- Pill de método com ícone de $ verde = odd + stake preenchidos
- Pill de método com ícone de alerta amarelo = dados parciais
- Pill de método sem ícone extra = sem dados financeiros
- Na seção expandida: valores de stake e odd visíveis
- No modal de edição: badge indicando status de cada método

### Benefícios

- Identificação instantânea de quais jogos precisam de atenção
- Feedback visual imediato ao preencher odd/stake
- Não precisa abrir cada jogo para verificar se dados foram inseridos
