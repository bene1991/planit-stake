import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Loader2, Shield, Calendar, Star, Settings2, Plus, Clock, CheckCircle2 } from "lucide-react";
import { useFixturesByDate, ApiFootballFixture, getStatusDisplay } from "@/hooks/useApiFootball";
import { useFavoriteLeagues } from "@/hooks/useFavoriteLeagues";
import { LeagueSelector } from "./LeagueSelector";
import { Method } from "@/types";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowInBrasilia } from "@/utils/timezone";

interface ApiGameBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  methods: Method[];
  onAddGames: (games: SelectedGame[]) => Promise<void>;
  existingFixtureIds?: string[];
}

export interface SelectedGame {
  fixtureId: number;
  date: string;
  time: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string;
  awayTeamLogo: string;
  methodIds: string[];
}

export function ApiGameBrowser({ open, onOpenChange, methods, onAddGames, existingFixtureIds = [] }: ApiGameBrowserProps) {
  const today = format(getNowInBrasilia(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showLeagueSelector, setShowLeagueSelector] = useState(false);
  const [selectedFixtures, setSelectedFixtures] = useState<Set<number>>(new Set());
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"upcoming" | "finished">("upcoming");

  const { data: fixtures, loading, refetch } = useFixturesByDate(selectedDate, open);
  const { favoriteLeagues, isFavorite: isLeagueFavorite } = useFavoriteLeagues();

  // Helper functions for quick date navigation
  const getDateString = (daysFromToday: number) => format(addDays(getNowInBrasilia(), daysFromToday), 'yyyy-MM-dd');
  const isDateSelected = (daysFromToday: number) => selectedDate === getDateString(daysFromToday);
  
  // Format selected date for display
  const formattedSelectedDate = useMemo(() => {
    try {
      return format(new Date(selectedDate + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Convert existingFixtureIds to a Set for quick lookup
  const existingIdsSet = new Set(existingFixtureIds);

  // Status de jogos finalizados
  const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'];

  // Base filter (search + favorites)
  const baseFilteredFixtures = useMemo(() => {
    if (!fixtures) return [];

    return fixtures.filter(f => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          f.teams.home.name.toLowerCase().includes(query) ||
          f.teams.away.name.toLowerCase().includes(query) ||
          f.league.name.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Favorites filter
      if (showFavoritesOnly && favoriteLeagues.length > 0) {
        if (!isLeagueFavorite(f.league.id)) return false;
      }

      return true;
    });
  }, [fixtures, searchQuery, showFavoritesOnly, favoriteLeagues, isLeagueFavorite]);

  // Split into upcoming and finished
  const upcomingFixtures = useMemo(() => 
    baseFilteredFixtures.filter(f => !FINISHED_STATUSES.includes(f.fixture.status.short)),
    [baseFilteredFixtures]
  );

  const finishedFixtures = useMemo(() => 
    baseFilteredFixtures.filter(f => FINISHED_STATUSES.includes(f.fixture.status.short)),
    [baseFilteredFixtures]
  );

  // Current tab fixtures
  const filteredFixtures = activeTab === "upcoming" ? upcomingFixtures : finishedFixtures;

  // Group by league
  const groupedFixtures = useMemo(() => {
    const groups = new Map<string, ApiFootballFixture[]>();
    
    filteredFixtures.forEach(f => {
      const key = `${f.league.country} - ${f.league.name}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(f);
    });

    // Sort by time within each group
    groups.forEach((fixtures) => {
      fixtures.sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredFixtures]);

  const toggleFixture = (fixtureId: number) => {
    // Don't allow selecting already existing fixtures
    if (existingIdsSet.has(fixtureId.toString())) return;
    
    setSelectedFixtures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fixtureId)) {
        newSet.delete(fixtureId);
      } else {
        newSet.add(fixtureId);
      }
      return newSet;
    });
  };

  const toggleMethod = (methodId: string) => {
    setSelectedMethods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(methodId)) {
        newSet.delete(methodId);
      } else {
        newSet.add(methodId);
      }
      return newSet;
    });
  };

  const handleAddGames = async () => {
    if (selectedFixtures.size === 0 || selectedMethods.size === 0) return;

    setAdding(true);
    try {
      const gamesToAdd: SelectedGame[] = [];

      selectedFixtures.forEach(fixtureId => {
        const fixture = fixtures?.find(f => f.fixture.id === fixtureId);
        if (!fixture) return;

        const fixtureDate = new Date(fixture.fixture.date);
        
        gamesToAdd.push({
          fixtureId: fixture.fixture.id,
          date: format(fixtureDate, 'yyyy-MM-dd'),
          time: format(fixtureDate, 'HH:mm'),
          league: `${fixture.league.country} - ${fixture.league.name}`,
          homeTeam: fixture.teams.home.name,
          awayTeam: fixture.teams.away.name,
          homeTeamLogo: fixture.teams.home.logo,
          awayTeamLogo: fixture.teams.away.logo,
          methodIds: Array.from(selectedMethods),
        });
      });

      await onAddGames(gamesToAdd);
      setSelectedFixtures(new Set());
      setSelectedMethods(new Set());
      onOpenChange(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0">
          {/* Fixed Header */}
          <div className="p-4 pb-2 border-b flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Buscar Jogos do Dia
              </DialogTitle>
              <DialogDescription>
                Selecione jogos da API-Football para adicionar ao planejamento
              </DialogDescription>
            </DialogHeader>

            {/* Controls */}
            <div className="space-y-3 mt-3">
              {/* Quick Date Navigation */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={isDateSelected(0) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDate(getDateString(0))}
                  className="h-8"
                >
                  Hoje
                </Button>
                <Button
                  variant={isDateSelected(1) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDate(getDateString(1))}
                  className="h-8"
                >
                  Amanhã
                </Button>
                <Button
                  variant={isDateSelected(2) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDate(getDateString(2))}
                  className="h-8"
                >
                  +2 dias
                </Button>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto h-8"
                />
              </div>

              {/* Selected Date Display */}
              <p className="text-xs text-muted-foreground capitalize">
                {formattedSelectedDate}
              </p>

              {/* Search and Settings */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar time ou liga..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowLeagueSelector(true)}
                  title="Configurar ligas favoritas"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Tabs for Upcoming vs Finished */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upcoming" | "finished")} className="mt-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upcoming" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Ao Vivo / Próximos
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {upcomingFixtures.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="finished" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Finalizados
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {finishedFixtures.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filters */}
            <div className="flex items-center gap-4 mt-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox 
                  checked={showFavoritesOnly} 
                  onCheckedChange={(checked) => setShowFavoritesOnly(!!checked)}
                />
                <Star className="h-4 w-4 text-primary" />
                Apenas ligas favoritas
              </label>
              <span className="text-xs text-muted-foreground">
                {filteredFixtures.length} jogos
              </span>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Fixtures List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : groupedFixtures.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum jogo encontrado</p>
                {showFavoritesOnly && favoriteLeagues.length === 0 && (
                  <Button 
                    variant="link" 
                    className="mt-2"
                    onClick={() => setShowLeagueSelector(true)}
                  >
                    Configurar ligas favoritas
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {groupedFixtures.map(([league, leagueFixtures]) => (
                  <div key={league}>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2 sticky top-0 bg-background py-1 z-10">
                      {league}
                    </h3>
                    <div className="space-y-1">
                      {leagueFixtures.map((fixture) => {
                        const isSelected = selectedFixtures.has(fixture.fixture.id);
                        const fixtureTime = format(new Date(fixture.fixture.date), 'HH:mm');
                        const status = getStatusDisplay(fixture.fixture.status);
                        const isAlreadyAdded = existingIdsSet.has(fixture.fixture.id.toString());

                        return (
                          <div
                            key={fixture.fixture.id}
                            onClick={() => toggleFixture(fixture.fixture.id)}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-lg transition-colors",
                              isAlreadyAdded 
                                ? "bg-muted/30 opacity-60 cursor-not-allowed" 
                                : isSelected 
                                  ? "bg-primary/10 border border-primary/30 cursor-pointer" 
                                  : "hover:bg-muted/50 cursor-pointer"
                            )}
                          >
                            {isAlreadyAdded ? (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
                                Adicionado
                              </Badge>
                            ) : (
                              <Checkbox checked={isSelected} className="pointer-events-none" />
                            )}
                            
                            <span className="text-xs text-muted-foreground w-12">
                              {status.isLive ? (
                                <Badge variant="destructive" className="text-[10px] px-1">
                                  {fixture.fixture.status.elapsed}'
                                </Badge>
                              ) : (
                                fixtureTime
                              )}
                            </span>

                            {/* Home Team */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={fixture.teams.home.logo} />
                                <AvatarFallback><Shield className="h-3 w-3" /></AvatarFallback>
                              </Avatar>
                              <span className="text-xs truncate">{fixture.teams.home.name}</span>
                            </div>

                            {/* Score or VS */}
                            <span className="text-xs font-bold px-2">
                              {fixture.goals.home !== null 
                                ? `${fixture.goals.home} - ${fixture.goals.away}`
                                : 'vs'
                              }
                            </span>

                            {/* Away Team */}
                            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                              <span className="text-xs truncate text-right">{fixture.teams.away.name}</span>
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={fixture.teams.away.logo} />
                                <AvatarFallback><Shield className="h-3 w-3" /></AvatarFallback>
                              </Avatar>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Method Selection - inside scrollable area */}
            {selectedFixtures.size > 0 && (
              <Card className="p-3 bg-muted/30 mt-4">
                <p className="text-xs font-medium mb-2">
                  {selectedFixtures.size} jogo(s) selecionado(s) - Escolha o(s) método(s):
                </p>
                <div className="flex flex-wrap gap-2">
                  {methods.map((method) => (
                    <Button
                      key={method.id}
                      variant={selectedMethods.has(method.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleMethod(method.id)}
                      className="h-7 text-xs"
                    >
                      {method.name}
                    </Button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="p-4 border-t bg-background flex-shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {selectedFixtures.size > 0 && selectedMethods.size > 0 && (
                  <>
                    Adicionar {selectedFixtures.size} jogo(s) com {selectedMethods.size} método(s)
                  </>
                )}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddGames}
                  disabled={selectedFixtures.size === 0 || selectedMethods.size === 0 || adding}
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <LeagueSelector
        open={showLeagueSelector}
        onOpenChange={setShowLeagueSelector}
      />
    </>
  );
}
