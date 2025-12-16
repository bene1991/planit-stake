import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, Loader2, Star, Trophy } from "lucide-react";
import { useFavoriteLeagues } from "@/hooks/useFavoriteLeagues";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface League {
  league: {
    id: number;
    name: string;
    type: string;
    logo: string;
  };
  country: {
    name: string;
    code: string | null;
    flag: string | null;
  };
}

interface LeagueSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Popular leagues to show first
const POPULAR_LEAGUE_IDS = [
  39,  // Premier League
  140, // La Liga
  78,  // Bundesliga
  135, // Serie A
  61,  // Ligue 1
  71,  // Brasileirão Série A
  72,  // Brasileirão Série B
  2,   // Champions League
  3,   // Europa League
  848, // Conference League
  253, // MLS
  94,  // Primeira Liga Portugal
];

export function LeagueSelector({ open, onOpenChange }: LeagueSelectorProps) {
  const { favoriteLeagues, addFavoriteLeague, removeFavoriteLeague, isFavorite, loading: favoritesLoading } = useFavoriteLeagues();
  const [searchQuery, setSearchQuery] = useState("");
  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && allLeagues.length === 0) {
      fetchLeagues();
    }
  }, [open]);

  const fetchLeagues = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-football', {
        body: { endpoint: 'leagues', params: { current: 'true' } }
      });

      if (error) throw error;
      setAllLeagues(data?.response || []);
    } catch (error) {
      console.error('Error fetching leagues:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeagues = allLeagues.filter(l => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      l.league.name.toLowerCase().includes(query) ||
      l.country.name.toLowerCase().includes(query)
    );
  });

  // Sort: favorites first, then popular, then alphabetically
  const sortedLeagues = [...filteredLeagues].sort((a, b) => {
    const aFav = isFavorite(a.league.id);
    const bFav = isFavorite(b.league.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;

    const aPopular = POPULAR_LEAGUE_IDS.includes(a.league.id);
    const bPopular = POPULAR_LEAGUE_IDS.includes(b.league.id);
    if (aPopular && !bPopular) return -1;
    if (!aPopular && bPopular) return 1;

    return a.league.name.localeCompare(b.league.name);
  });

  const handleToggle = (league: League) => {
    if (isFavorite(league.league.id)) {
      removeFavoriteLeague(league.league.id);
    } else {
      addFavoriteLeague({
        league_id: league.league.id,
        league_name: league.league.name,
        country: league.country.name,
        logo: league.league.logo,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Ligas Favoritas
          </DialogTitle>
          <DialogDescription>
            Selecione as ligas que deseja acompanhar. Jogos dessas ligas aparecerão primeiro no browser.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar liga ou país..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selected Count */}
        {favoriteLeagues.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4 text-primary fill-primary" />
            <span>{favoriteLeagues.length} liga(s) selecionada(s)</span>
          </div>
        )}

        {/* Leagues List */}
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1">
              {sortedLeagues.map((league) => {
                const isChecked = isFavorite(league.league.id);
                const isPopular = POPULAR_LEAGUE_IDS.includes(league.league.id);

                return (
                  <div
                    key={league.league.id}
                    onClick={() => handleToggle(league)}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                      isChecked ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50",
                      isPopular && !isChecked && "bg-muted/30"
                    )}
                  >
                    <Checkbox checked={isChecked} className="pointer-events-none" />
                    
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={league.league.logo} alt={league.league.name} />
                      <AvatarFallback className="text-xs">
                        <Trophy className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{league.league.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {league.country.flag && <span className="mr-1">{league.country.flag}</span>}
                        {league.country.name}
                      </p>
                    </div>

                    {isPopular && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                        Popular
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Concluído
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
