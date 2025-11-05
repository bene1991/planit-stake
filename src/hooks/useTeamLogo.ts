import { useState, useEffect } from 'react';
import { searchTeamLogo } from '@/services/teamLogoService';

export const useTeamLogo = (teamName: string) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamName || teamName.trim().length < 2) {
      setLogoUrl(null);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      
      try {
        const url = await searchTeamLogo(teamName);
        if (!cancelled) {
          setLogoUrl(url);
        }
      } catch (error) {
        console.error('Error loading team logo:', error);
        if (!cancelled) {
          setLogoUrl(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 500); // Debounce 500ms

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [teamName]);

  return { logoUrl, loading };
};
