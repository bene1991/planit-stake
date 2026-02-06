import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from './useSettings';

export const useFixtureSearch = () => {
  const { settings } = useSettings();

  const autoLinkGame = useCallback(async (
    gameId: string,
    homeTeam: string,
    awayTeam: string,
    date: string
  ): Promise<{ success: boolean; fixtureId?: string }> => {
    if (!settings?.api_key) {
      return { success: false };
    }

    try {
      const { data, error } = await supabase.functions.invoke('api-football', {
        body: {
          endpoint: 'fixtures',
          params: {
            date,
            timezone: 'America/Sao_Paulo',
          },
          apiKey: settings.api_key,
        },
      });

      if (error || !data?.response) {
        return { success: false };
      }

      // Try to find match by team names
      const normalizeTeam = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const homeNorm = normalizeTeam(homeTeam);
      const awayNorm = normalizeTeam(awayTeam);

      const match = data.response.find((fixture: any) => {
        const fHome = normalizeTeam(fixture.teams?.home?.name || '');
        const fAway = normalizeTeam(fixture.teams?.away?.name || '');
        return (fHome.includes(homeNorm) || homeNorm.includes(fHome)) &&
               (fAway.includes(awayNorm) || awayNorm.includes(fAway));
      });

      if (match) {
        const fixtureId = match.fixture.id.toString();
        await supabase.from('games').update({ api_fixture_id: fixtureId }).eq('id', gameId);
        return { success: true, fixtureId };
      }

      return { success: false };
    } catch {
      return { success: false };
    }
  }, [settings?.api_key]);

  return { autoLinkGame };
};
