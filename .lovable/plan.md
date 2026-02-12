
## Remover Widgets SofaScore e Radar Futebol dos Jogos

### O que será removido

Remover completamente os inputs/widgets do SofaScore e do Radar Futebol dos cards de jogo. Os usuários não precisarão mais colar links para esses serviços.

### Arquivos que serão modificados

**`src/components/GameListItem.tsx`**
- Linha 9-10: Remover imports `SofaScoreWidget` e `RadarFutebolWidget`
- Linhas 408-421: Remover a seção SofaScore displayOnly no desktop (hidden sm:flex)
- Linhas 491-502: Remover a seção SofaScore displayOnly no mobile (sm:hidden)
- Linhas 572-585: Remover os widgets SofaScore e Radar Futebol do painel expandido

### Arquivos que podem ser deletados (opcionais)

- `src/components/SofaScoreWidget.tsx` - não será mais usado
- `src/components/RadarFutebolWidget.tsx` - não será mais usado

### O que NÃO muda

- Os campos `sofascore_url`, `sofascore_crop_top`, `sofascore_crop_height` e `radar_url` continuam no banco de dados (nenhuma migração necessária)
- Os mapeamentos em `useSupabaseGames.ts` e `types/index.ts` permanecem intactos (não causa erro, apenas ficam sem uso visual)

### Resultado esperado

Os cards de jogo ficarão mais limpos, sem os inputs de URL para SofaScore e Radar Futebol. O painel expandido não terá mais essas seções.
