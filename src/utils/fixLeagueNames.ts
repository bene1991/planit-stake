import { supabase } from "@/integrations/supabase/client";

// Mapping of teams to their countries for disambiguation
const teamCountryMap: Record<string, string> = {
  // Italian Serie A
  'Inter': 'Italy',
  'Milan': 'Italy',
  'AC Milan': 'Italy',
  'Juventus': 'Italy',
  'Roma': 'Italy',
  'Napoli': 'Italy',
  'Lazio': 'Italy',
  'Fiorentina': 'Italy',
  'Atalanta': 'Italy',
  'Bologna': 'Italy',
  'Torino': 'Italy',
  'Genoa': 'Italy',
  'Udinese': 'Italy',
  'Cagliari': 'Italy',
  'Lecce': 'Italy',
  'Parma': 'Italy',
  'Verona': 'Italy',
  'Monza': 'Italy',
  'Pisa': 'Italy',
  'Juve Stabia': 'Italy',
  'Virtus Entella': 'Italy',
  
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
  'Pescara': 'Brazil',
  
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
  'Nantes': 'France',
  
  // Algerian Ligue 1
  'MC Alger': 'Algeria',
  'JS Kabylie': 'Algeria',
  'CR Belouizdad': 'Algeria',
  'USM Alger': 'Algeria',
  'MC Oran': 'Algeria',
  'CS Constantine': 'Algeria',
  'Ben Aknoun': 'Algeria',
  'MB Rouisset': 'Algeria',
  'Oued Akbou': 'Algeria',
  
  // Spanish La Liga
  'Real Madrid': 'Spain',
  'Barcelona': 'Spain',
  'Atletico Madrid': 'Spain',
  'Sevilla': 'Spain',
  'Valencia': 'Spain',
  'Villarreal': 'Spain',
  'Real Sociedad': 'Spain',
  'Athletic Club': 'Spain',
  'Betis': 'Spain',
  'Celta Vigo': 'Spain',
  'Getafe': 'Spain',
  'Osasuna': 'Spain',
  'Alaves': 'Spain',
  'Mallorca': 'Spain',
  'Las Palmas': 'Spain',
  'Elche': 'Spain',
  'Girona': 'Spain',
  'Oviedo': 'Spain',
  
  // Spanish Segunda Division
  'Deportivo La Coruna': 'Spain',
  'Eibar': 'Spain',
  'Burgos': 'Spain',
  'Huesca': 'Spain',
  'Castellón': 'Spain',
  'Sporting Gijon': 'Spain',
  'Cadiz': 'Spain',
  
  // English Championship
  'Derby': 'England',
  'Wrexham': 'England',
  'Preston': 'England',
  'Sheffield Wednesday': 'England',
  'QPR': 'England',
  'West Brom': 'England',
  'Swansea': 'England',
  'Oxford United': 'England',
  'Ipswich': 'England',
  'Millwall': 'England',
  'Charlton': 'England',
  'Blackburn': 'England',
  
  // German Bundesliga
  'Union Berlin': 'Germany',
  'FSV Mainz 05': 'Germany',
  'Bayern Munich': 'Germany',
  'Borussia Dortmund': 'Germany',
  'RB Leipzig': 'Germany',
  'Bayer Leverkusen': 'Germany',
  
  // Scottish Premiership
  'Linfield': 'Scotland',
  'Bangor': 'Scotland',
  'Celtic': 'Scotland',
  'Rangers': 'Scotland',
  
  // Greek Cup
  'PAOK': 'Greece',
  'Atromitos': 'Greece',
  'Aris Thessalonikis': 'Greece',
  'Panetolikos': 'Greece',
  
  // Saudi Division 1
  'Al Zulfi': 'Saudi Arabia',
  'Jeddah Club': 'Saudi Arabia',
};

// Mapping of known leagues to their countries (when unambiguous)
const leagueCountryMap: Record<string, string> = {
  'Bundesliga': 'Germany',
  'La Liga': 'Spain',
  'Premier League': 'England',
  'Championship': 'England',
  'Premiership': 'Scotland',
  'Segunda División': 'Spain',
  'Primeira Liga': 'Portugal',
  'Eredivisie': 'Netherlands',
  'Super Lig': 'Turkey',
  'Jupiler Pro League': 'Belgium',
  'Paulista - A1': 'Brazil',
  'Carioca - A1': 'Brazil',
  'Gauchão': 'Brazil',
  'Copa do Brasil': 'Brazil',
  'Libertadores': 'South America',
  'Sudamericana': 'South America',
  'Africa Cup of Nations': 'World',
  'Friendlies': 'World',
  'World Cup': 'World',
  'Euro': 'Europe',
  'Champions League': 'Europe',
  'Europa League': 'Europe',
  'Conference League': 'Europe',
  'Division 1': 'Saudi Arabia',
  'Pro League': 'Saudi Arabia',
  'A-League': 'Australia',
  'MLS': 'USA',
  'Liga MX': 'Mexico',
  'J-League': 'Japan',
  'K-League': 'South Korea',
};

export interface FixLeagueNamesResult {
  updated: number;
  skipped: number;
  errors: number;
  details: string[];
}

function getCountryFromTeam(homeTeam: string, awayTeam: string): string | null {
  // Check exact match first
  if (teamCountryMap[homeTeam]) return teamCountryMap[homeTeam];
  if (teamCountryMap[awayTeam]) return teamCountryMap[awayTeam];
  
  // Check partial match
  for (const [team, country] of Object.entries(teamCountryMap)) {
    if (homeTeam.includes(team) || awayTeam.includes(team)) {
      return country;
    }
  }
  
  return null;
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

    // Group games by league
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
        result.details.push(`✓ "${league}" - já tem país (${leagueGames.length} jogos)`);
        continue;
      }

      // Separate games by country detected from teams
      const gamesByCountry: Record<string, typeof games> = {};
      
      for (const game of leagueGames) {
        let country = leagueCountryMap[league];
        
        // If league is ambiguous (like "Ligue 1", "Serie A", "Serie B", "Cup"), check teams
        if (!country || ['Ligue 1', 'Serie A', 'Serie B', 'Cup'].includes(league)) {
          const teamCountry = getCountryFromTeam(game.home_team, game.away_team);
          if (teamCountry) {
            country = teamCountry;
          } else if (!country) {
            country = 'Unknown';
          }
        }
        
        if (!gamesByCountry[country]) {
          gamesByCountry[country] = [];
        }
        gamesByCountry[country].push(game);
      }

      // Update games for each country
      for (const [country, countryGames] of Object.entries(gamesByCountry)) {
        const newLeagueName = `${country} - ${league}`;
        const gameIds = countryGames.map(g => g.id);
        
        const { error: updateError } = await supabase
          .from('games')
          .update({ league: newLeagueName })
          .in('id', gameIds);

        if (updateError) {
          result.errors += countryGames.length;
          result.details.push(`❌ Erro "${league}" → "${newLeagueName}": ${updateError.message}`);
        } else {
          result.updated += countryGames.length;
          result.details.push(`✅ "${league}" → "${newLeagueName}" (${countryGames.length} jogos)`);
        }
      }
    }

    return result;
  } catch (error) {
    result.errors++;
    result.details.push(`Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    return result;
  }
}
