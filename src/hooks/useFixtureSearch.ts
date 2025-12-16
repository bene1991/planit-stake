import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ApiFootballFixture } from './useApiFootball';

interface SearchResult {
  fixture: ApiFootballFixture;
  matchScore: number;
}

export function useFixtureSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize team name for comparison
  const normalizeTeamName = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/fc|sc|cf|ac|as|ss|us|cd|rc|rcd|ud|sd|ca|ec|se|cr|club|athletic|atletico|sporting|real|united|city|town/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  // Calculate match score between two team names
  const calculateMatchScore = (name1: string, name2: string): number => {
    const n1 = normalizeTeamName(name1);
    const n2 = normalizeTeamName(name2);
    
    // Exact match
    if (n1 === n2) return 100;
    
    // One contains the other
    if (n1.includes(n2) || n2.includes(n1)) return 80;
    
    // Check for common words
    const words1 = n1.split(/\s+/).filter(w => w.length > 2);
    const words2 = n2.split(/\s+/).filter(w => w.length > 2);
    const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
    
    if (commonWords.length > 0) {
      return 50 + (commonWords.length * 10);
    }
    
    // Levenshtein distance for fuzzy matching
    const distance = levenshteinDistance(n1, n2);
    const maxLen = Math.max(n1.length, n2.length);
    const similarity = 1 - (distance / maxLen);
    
    return similarity * 60;
  };

  // Levenshtein distance
  const levenshteinDistance = (str1: string, str2: string): number => {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
        }
      }
    }
    return dp[m][n];
  };

  // Search for fixture by team names and date
  const searchFixture = useCallback(async (
    homeTeam: string,
    awayTeam: string,
    date: string
  ): Promise<SearchResult[]> => {
    setLoading(true);
    setError(null);

    try {
      // First try to find by date
      const { data: response, error: invokeError } = await supabase.functions.invoke('api-football', {
        body: { 
          endpoint: 'fixtures',
          params: { date }
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      const fixtures: ApiFootballFixture[] = response?.response || [];
      
      // Score each fixture based on team name matching
      const scoredResults: SearchResult[] = fixtures
        .map(fixture => {
          const homeScore = calculateMatchScore(homeTeam, fixture.teams.home.name);
          const awayScore = calculateMatchScore(awayTeam, fixture.teams.away.name);
          const totalScore = (homeScore + awayScore) / 2;
          
          return {
            fixture,
            matchScore: totalScore
          };
        })
        .filter(result => result.matchScore > 40) // Minimum threshold
        .sort((a, b) => b.matchScore - a.matchScore);

      return scoredResults;
    } catch (err) {
      console.error('Error searching fixtures:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar partida');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Link game to fixture
  const linkGameToFixture = useCallback(async (
    gameId: string,
    fixtureId: number,
    homeTeamLogo?: string,
    awayTeamLogo?: string
  ): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('games')
        .update({
          api_fixture_id: fixtureId.toString(),
          home_team_logo: homeTeamLogo,
          away_team_logo: awayTeamLogo
        })
        .eq('id', gameId);

      if (updateError) throw updateError;
      return true;
    } catch (err) {
      console.error('Error linking game:', err);
      setError(err instanceof Error ? err.message : 'Erro ao vincular partida');
      return false;
    }
  }, []);

  // Auto-link game (search and link automatically if good match found)
  const autoLinkGame = useCallback(async (
    gameId: string,
    homeTeam: string,
    awayTeam: string,
    date: string
  ): Promise<{ success: boolean; fixtureId?: number }> => {
    const results = await searchFixture(homeTeam, awayTeam, date);
    
    if (results.length > 0 && results[0].matchScore >= 70) {
      const bestMatch = results[0];
      const success = await linkGameToFixture(
        gameId,
        bestMatch.fixture.fixture.id,
        bestMatch.fixture.teams.home.logo,
        bestMatch.fixture.teams.away.logo
      );
      
      return { 
        success, 
        fixtureId: success ? bestMatch.fixture.fixture.id : undefined 
      };
    }
    
    return { success: false };
  }, [searchFixture, linkGameToFixture]);

  return {
    searchFixture,
    linkGameToFixture,
    autoLinkGame,
    loading,
    error
  };
}
