

## Remover Widgets SofaScore e Radar Futebol dos Jogos

### O que muda

Remover completamente os inputs/widgets do SofaScore e do Radar Futebol dos cards de jogo. Os usuarios nao precisarao mais colar links para esses servicos.

### Etapas

**1. `src/components/GameListItem.tsx`**

Remover todas as referencias aos dois widgets:
- Linhas 409-420: Remover o SofaScore displayOnly no desktop
- Linhas 491-501: Remover o SofaScore displayOnly no mobile
- Linhas 572-585: Remover os widgets SofaScore e Radar Futebol do painel expandido
- Remover os imports de `SofaScoreWidget` e `RadarFutebolWidget` (linhas 9-10)

**2. Arquivos que podem ser deletados (opcionalmente)**

- `src/components/SofaScoreWidget.tsx`
- `src/components/RadarFutebolWidget.tsx`

Esses componentes nao serao mais usados em nenhum lugar apos a remocao.

### O que NAO muda

- Os campos `sofascore_url`, `sofascore_crop_top`, `sofascore_crop_height` e `radar_url` continuam no banco de dados (nenhuma migracao necessaria)
- Os mapeamentos em `useSupabaseGames.ts` e `types/index.ts` permanecem intactos (nao causa erro, apenas ficam sem uso visual)

