
## Calibracao Adaptativa dos Thresholds pela IA

### Objetivo

Alem de ajustar os **pesos** dos criterios (ja implementado), a IA passara a ajustar automaticamente os **thresholds de filtragem** durante cada ciclo de calibracao:

- `min_home_goals_avg` (default 1.5)
- `min_away_conceded_avg` (default 1.5)
- `min_over15_combined` (default 70%)
- `max_h2h_0x1` (default 0)

**NAO sera alterado:** `max_away_odd` (odd do visitante permanece fixo conforme solicitado)

### Logica de Ajuste dos Thresholds

Para cada threshold, a IA analisa os jogos resolvidos e calcula:

1. **Distribuicao dos valores do criterio nos Greens vs Reds**
   - Ex: nos jogos Green, a media de gols do mandante foi 1.8; nos Red, foi 1.4
2. **Novo threshold = media ponderada entre o percentil 25 dos Greens e o percentil 75 dos Reds**
   - Isso encontra o "ponto de corte otimo" que maximiza a separacao Green/Red
3. **Limites de seguranca** para evitar thresholds extremos:
   - `min_home_goals_avg`: entre 1.0 e 2.5
   - `min_away_conceded_avg`: entre 1.0 e 2.5
   - `min_over15_combined`: entre 50 e 120
   - `max_h2h_0x1`: entre 0 e 2
4. **Suavizacao**: novo threshold = 70% do calculado + 30% do atual (evita mudancas bruscas)

### Detalhes Tecnicos

**Arquivo modificado: `supabase/functions/calibrate-lay0x1/index.ts`**

Apos o calculo dos pesos (ja existente), adicionar bloco de calibracao de thresholds:

- Extrair valores reais de cada criterio do `criteria_snapshot` de cada analise resolvida
- Separar em dois grupos: Greens e Reds
- Para cada threshold ajustavel:
  - Calcular a mediana dos valores nos Greens
  - Calcular a mediana dos valores nos Reds
  - Definir ponto de corte otimo entre os dois grupos
  - Aplicar suavizacao e limites de seguranca
- Incluir os novos thresholds no upsert do `lay0x1_weights`
- Retornar thresholds antigos e novos na resposta

**Arquivo modificado: `src/components/Lay0x1/Lay0x1Evolution.tsx`**

- Exibir na interface que os thresholds sao ajustados automaticamente pela IA
- Mostrar indicador visual quando um threshold foi alterado na ultima calibracao

### Exemplo Pratico

Se apos 30 jogos:
- Jogos Green tinham media de gols mandante de 1.9
- Jogos Red tinham media de 1.3
- Ponto de corte calculado: ~1.6
- Novo threshold (suavizado): 70% de 1.6 + 30% de 1.5 (atual) = 1.57, arredondado para 1.6

A IA eleva o `min_home_goals_avg` de 1.5 para 1.6, filtrando jogos com mandantes menos ofensivos.

### Resumo de Arquivos

- `supabase/functions/calibrate-lay0x1/index.ts` - Adicionar logica de calibracao de thresholds
- `src/components/Lay0x1/Lay0x1Evolution.tsx` - Exibir thresholds ajustados pela IA
