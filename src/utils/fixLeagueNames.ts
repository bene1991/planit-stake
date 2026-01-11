import { supabase } from "@/integrations/supabase/client";

// Mapping of known leagues to their countries
const leagueCountryMap: Record<string, string> = {
  // Major European Leagues
  'Bundesliga': 'Germany',
  'La Liga': 'Spain',
  'Premier League': 'England',
  'Championship': 'England',
  'Ligue 1': 'France',
  'Premiership': 'Scotland',
  'Segunda División': 'Spain',
  'Primeira Liga': 'Portugal',
  'Eredivisie': 'Netherlands',
  'Serie A': 'Italy',
  'Serie B': 'Brazil',
  'Super Lig': 'Turkey',
  'Jupiler Pro League': 'Belgium',
  
  // South American Leagues
  'Paulista - A1': 'Brazil',
  'Carioca - A1': 'Brazil',
  'Gauchão': 'Brazil',
  'Copa do Brasil': 'Brazil',
  'Libertadores': 'South America',
  'Sudamericana': 'South America',
  
  // International
  'Africa Cup of Nations': 'World',
  'Cup': 'World',
  'Friendlies': 'World',
  'World Cup': 'World',
  'Euro': 'Europe',
  'Champions League': 'Europe',
  'Europa League': 'Europe',
  'Conference League': 'Europe',
  
  // Middle East
  'Division 1': 'Saudi Arabia',
  'Pro League': 'Saudi Arabia',
  
  // Other
  'A-League': 'Australia',
  'MLS': 'USA',
  'Liga MX': 'Mexico',
  'J-League': 'Japan',
  'K-League': 'South Korea',
};

// Map of known teams to help identify countries for ambiguous leagues
const teamCountryMap: Record<string, string> = {
  // Italian Serie A
  'Inter': 'Italy',
  'Milan': 'Italy',
  'Juventus': 'Italy',
  'Roma': 'Italy',
  'Napoli': 'Italy',
  'Lazio': 'Italy',
  'Fiorentina': 'Italy',
  'Atalanta': 'Italy',
  'Bologna': 'Italy',
  'Torino': 'Italy',
  
  // Brazilian Serie B
  'Goiás': 'Brazil',
  'Ceará': 'Brazil',
  'Sport': 'Brazil',
  'Guarani': 'Brazil',
  'Ponte Preta': 'Brazil',
  'CRB': 'Brazil',
  'Operário': 'Brazil',
  'Ituano': 'Brazil',
  'Amazonas': 'Brazil',
  'Brusque': 'Brazil',
  
  // French Ligue 1
  'PSG': 'France',
  'Paris Saint-Germain': 'France',
  'Lyon': 'France',
  'Marseille': 'France',
  'Monaco': 'France',
  'Lille': 'France',
  'Nice': 'France',
  'Lens': 'France',
  'Rennes': 'France',
  'Strasbourg': 'France',
};

export interface FixLeagueNamesResult {
  updated: number;
  skipped: number;
  errors: number;
  details: string[];
}

export async function fixLeagueNames(): Promise<FixLeagueNamesResult> {
  const result: FixLeagueNamesResult = {
    updated: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  try {
    // Fetch all games
    const { data: games, error } = await supabase
      .from('games')
      .select('id, league, home_team, away_team, api_fixture_id');

    if (error) {
      result.errors++;
      result.details.push(`Erro ao buscar jogos: ${error.message}`);
      return result;
    }

    if (!games || games.length === 0) {
      result.details.push('Nenhum jogo encontrado');
      return result;
    }

    // Group games by league to process efficiently
    const gamesByLeague = games.reduce((acc, game) => {
      if (!acc[game.league]) {
        acc[game.league] = [];
      }
      acc[game.league].push(game);
      return acc;
    }, {} as Record<string, typeof games>);

    for (const [league, leagueGames] of Object.entries(gamesByLeague)) {
      // Skip if already has country prefix (contains " - ")
      if (league.includes(' - ')) {
        result.skipped += leagueGames.length;
        result.details.push(`Pulando "${league}" - já tem país`);
        continue;
      }

      // Try to find country from leagueCountryMap
      let country = leagueCountryMap[league];

      // If not found, try to infer from team names
      if (!country) {
        const firstGame = leagueGames[0];
        for (const [team, teamCountry] of Object.entries(teamCountryMap)) {
          if (
            firstGame.home_team.includes(team) ||
            firstGame.away_team.includes(team)
          ) {
            country = teamCountry;
            break;
          }
        }
      }

      // If still not found, mark as Unknown
      if (!country) {
        country = 'Unknown';
        result.details.push(`⚠️ Liga "${league}" sem país identificado - usando "Unknown"`);
      }

      const newLeagueName = `${country} - ${league}`;

      // Update all games with this league
      const gameIds = leagueGames.map(g => g.id);
      const { error: updateError } = await supabase
        .from('games')
        .update({ league: newLeagueName })
        .in('id', gameIds);

      if (updateError) {
        result.errors += leagueGames.length;
        result.details.push(`❌ Erro ao atualizar "${league}": ${updateError.message}`);
      } else {
        result.updated += leagueGames.length;
        result.details.push(`✅ "${league}" → "${newLeagueName}" (${leagueGames.length} jogos)`);
      }
    }

    return result;
  } catch (error) {
    result.errors++;
    result.details.push(`Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    return result;
  }
}
