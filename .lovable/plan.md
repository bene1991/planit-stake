

## Adicionar Widget Radar Futebol nos Jogos

### O que muda

Adicionar um campo para colar o link do Radar Futebol (ex: `https://www.radarfutebol.com/radar/reggiana-mantova/14317763`) em cada jogo. O link sera exibido como um iframe embutido, similar ao widget SofaScore que ja existe.

### Ressalva importante

Sites como radarfutebol.com podem bloquear embeds via iframe (header `X-Frame-Options`). Se o iframe nao carregar, sera exibido um botao para abrir o link em nova aba como fallback.

### Etapas

**1. Migracao do banco de dados**

Adicionar coluna `radar_url` (text, nullable) na tabela `games`.

**2. `src/types/index.ts` - Adicionar campo no tipo Game**

Adicionar `radarUrl?: string` na interface `Game`.

**3. `src/hooks/useSupabaseGames.ts` - Mapear campo**

- No fetch: mapear `radar_url` para `radarUrl`
- No insert: mapear `radarUrl` para `radar_url`
- No update: suportar atualizacao de `radar_url`

**4. Criar `src/components/RadarFutebolWidget.tsx`**

Componente similar ao `SofaScoreWidget`, mas simplificado (sem controles de crop):
- Input para colar o link
- Iframe embutido com altura fixa (~350px)
- Botao X para remover
- Fallback: se iframe falhar, mostrar botao "Abrir no Radar Futebol"
- Aceita URLs no formato `https://www.radarfutebol.com/radar/...`

**5. `src/components/GameListItem.tsx` - Integrar o widget**

Adicionar o `RadarFutebolWidget` no painel expandido do jogo, abaixo do SofaScore widget, com o mesmo padrao de `onSave` para persistir o link.

### Secao Tecnica

Arquivos modificados:
- Migracao SQL: `ALTER TABLE games ADD COLUMN radar_url text`
- `src/types/index.ts`: adicionar `radarUrl?: string`
- `src/hooks/useSupabaseGames.ts`: mapear `radar_url` nos 3 pontos (fetch, insert, update)
- `src/components/GameListItem.tsx`: renderizar `RadarFutebolWidget`

Arquivo criado:
- `src/components/RadarFutebolWidget.tsx`
