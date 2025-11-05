// Team logo service - fetches logos from TheSportsDB API
const CACHE_KEY = 'team-logos-cache';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedLogo {
  url: string;
  timestamp: number;
}

interface TeamSearchResult {
  teams?: Array<{
    strTeam: string;
    strBadge: string;
  }>;
}

// Get cached logo from localStorage
const getCachedLogo = (teamName: string): string | null => {
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    if (!cache) return null;
    
    const parsed = JSON.parse(cache) as Record<string, CachedLogo>;
    const cached = parsed[teamName.toLowerCase()];
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.url;
    }
  } catch (error) {
    console.error('Error reading logo cache:', error);
  }
  return null;
};

// Save logo to localStorage cache
const cacheLogo = (teamName: string, url: string) => {
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    const parsed = cache ? JSON.parse(cache) : {};
    
    parsed[teamName.toLowerCase()] = {
      url,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.error('Error caching logo:', error);
  }
};

// Search for team logo via TheSportsDB API
export const searchTeamLogo = async (teamName: string): Promise<string | null> => {
  if (!teamName || teamName.trim().length < 2) return null;
  
  const trimmedName = teamName.trim();
  
  // Check cache first
  const cached = getCachedLogo(trimmedName);
  if (cached) return cached;
  
  try {
    const response = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(trimmedName)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) return null;
    
    const data: TeamSearchResult = await response.json();
    
    if (data.teams && data.teams.length > 0) {
      const logoUrl = data.teams[0].strBadge;
      if (logoUrl) {
        cacheLogo(trimmedName, logoUrl);
        return logoUrl;
      }
    }
  } catch (error) {
    console.error('Error fetching team logo:', error);
  }
  
  return null;
};
