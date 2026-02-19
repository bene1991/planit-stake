import { useState, useEffect, useMemo } from 'react';
import { useSupabaseGames } from '@/hooks/useSupabaseGames';
import { useMatchbookMonitor, MarketData, OddFlash } from '@/hooks/useMatchbookMonitor';
import { useMatchbookEventLinker } from '@/hooks/useMatchbookEventLinker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp, Link2, Clock,
  Eye, EyeOff, LogOut, Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const SESSION_KEY = 'matchbook_creds';
function loadCreds() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function saveCreds(u: string, p: string) { localStorage.setItem(SESSION_KEY, JSON.stringify({ username: u, password: p })); }
function clearCreds() { localStorage.removeItem(SESSION_KEY); }

// Odd cell component with flash
const OddCell = ({ value, flashKey, flashes, suffix }: {
  value: number | null; flashKey: string; flashes: OddFlash; suffix?: string;
}) => {
  const flash = flashes[flashKey];
  return (
    <span className={cn(
      'font-mono text-sm transition-colors duration-300',
      flash === 'up' && 'text-red-400 bg-red-500/20 rounded px-1',
      flash === 'down' && 'text-emerald-400 bg-emerald-500/20 rounded px-1',
      !flash && 'text-foreground',
    )}>
      {value != null ? `${value.toFixed(2)}${suffix || ''}` : '—'}
    </span>
  );
};

// Market block component
const MarketBlock = ({ title, runners, flashes, prefix, showLiquidity }: {
  title: string;
  runners: MarketData[keyof MarketData];
  flashes: OddFlash;
  prefix: string;
  showLiquidity?: boolean;
}) => {
  if (!runners || runners.length === 0) {
    return (
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
        <p className="text-xs text-muted-foreground/60 italic">Mercado indisponível</p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
      <div className="border border-border/40 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs py-1.5 h-auto">{showLiquidity ? 'Score' : 'Runner'}</TableHead>
              <TableHead className="text-xs text-right py-1.5 h-auto text-blue-400">Back</TableHead>
              <TableHead className="text-xs text-right py-1.5 h-auto text-pink-400">Lay</TableHead>
              {showLiquidity && <TableHead className="text-xs text-right py-1.5 h-auto">Liq. Lay</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {runners.map((r) => (
              <TableRow key={r.name} className="hover:bg-muted/20">
                <TableCell className="text-xs font-medium py-1.5">{r.name}</TableCell>
                <TableCell className="text-right py-1.5">
                  <OddCell value={r.back_price} flashKey={`${prefix}_${r.name}_back`} flashes={flashes} />
                </TableCell>
                <TableCell className="text-right py-1.5">
                  <OddCell value={r.lay_price} flashKey={`${prefix}_${r.name}_lay`} flashes={flashes} />
                </TableCell>
                {showLiquidity && (
                  <TableCell className="text-right py-1.5">
                    <span className="font-mono text-xs text-muted-foreground">
                      €{r.lay_available?.toFixed(0) ?? '0'}
                    </span>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const MonitorTrader = () => {
  const { games, updateGame } = useSupabaseGames();
  const monitor = useMatchbookMonitor();
  const linker = useMatchbookEventLinker();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());
  const [linkingGameId, setLinkingGameId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');

  // Filter planned games
  const plannedGames = useMemo(() => {
    return games.filter(g => {
      const status = (g.status || '').toLowerCase();
      return status === 'not started' || status === 'live' || status === 'planejado';
    });
  }, [games]);

  // Set event IDs for monitoring
  useEffect(() => {
    const ids = plannedGames
      .map(g => (g as any).matchbook_event_id)
      .filter(Boolean) as string[];
    monitor.setEventIds(ids);
  }, [plannedGames, monitor.setEventIds]);

  // Auto-login from saved creds
  useEffect(() => {
    const creds = loadCreds();
    if (creds && !monitor.connected && !monitor.loading) {
      setUsername(creds.username);
      setPassword(creds.password);
      monitor.login(creds.username, creds.password);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show toast on error
  useEffect(() => {
    if (monitor.error) {
      toast({ title: 'Erro Matchbook', description: monitor.error, variant: 'destructive' });
    }
  }, [monitor.error]);

  const handleConnect = async () => {
    if (!username.trim() || !password.trim()) return;
    saveCreds(username, password);
    await monitor.login(username, password);
  };

  const handleDisconnect = () => {
    monitor.disconnect();
    clearCreds();
    setPassword('');
  };

  const toggleExpand = (id: string) => {
    setExpandedGames(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAutoLink = async (gameId: string, homeTeam: string, awayTeam: string) => {
    const matchId = await linker.autoMatch(homeTeam, awayTeam);
    if (matchId) {
      await updateGame(gameId, { matchbook_event_id: String(matchId) } as any);
    } else {
      setLinkingGameId(gameId);
      setLinkSearch(`${homeTeam} vs ${awayTeam}`);
      linker.searchEvents(`${homeTeam} vs ${awayTeam}`);
    }
  };

  const handleManualLink = async (gameId: string, eventId: number) => {
    await updateGame(gameId, { matchbook_event_id: String(eventId) } as any);
    setLinkingGameId(null);
    setLinkSearch('');
  };

  const getGameStatus = (game: any) => {
    const s = (game.status || '').toLowerCase();
    if (s === 'live') return { label: 'AO VIVO', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    if (s === 'finished' || s === 'ft') return { label: 'ENCERRADO', color: 'bg-muted text-muted-foreground border-border' };
    return { label: 'PRÉ-JOGO', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Monitor Trader
          </h1>
          <p className="text-sm text-muted-foreground">Odds em tempo real dos jogos planejados</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={monitor.connected ? 'default' : 'secondary'} className="gap-1.5">
            {monitor.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {monitor.connected ? 'Online' : 'Offline'}
          </Badge>
          {monitor.connected && (
            <>
              <Button variant="outline" size="sm" onClick={monitor.manualRefresh} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-muted-foreground">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Login */}
      {!monitor.connected && !monitor.loading && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Login Matchbook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Username</Label>
                <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    className="h-9 pr-9"
                    onKeyDown={e => e.key === 'Enter' && handleConnect()}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <Button onClick={handleConnect} disabled={!username.trim() || !password.trim()} size="sm" className="w-full sm:w-auto">
              Conectar
            </Button>
            {monitor.error && (
              <p className="text-sm text-destructive mt-1">{monitor.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {monitor.loading && (
        <Card><CardContent className="p-4 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Autenticando...</span>
        </CardContent></Card>
      )}

      {/* Games list */}
      {monitor.connected && plannedGames.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum jogo planejado encontrado. Adicione jogos no Planejamento.
          </CardContent>
        </Card>
      )}

      {monitor.connected && plannedGames.map(game => {
        const mbId = (game as any).matchbook_event_id as string | undefined;
        const isExpanded = expandedGames.has(game.id);
        const status = getGameStatus(game);
        const markets = mbId ? monitor.marketsByEvent[mbId] : null;
        const flashes = mbId ? (monitor.flashesByEvent[mbId] || {}) : {};
        const lastUp = mbId ? monitor.lastUpdatedByEvent[mbId] : null;

        return (
          <Card key={game.id} className="border-border/40 overflow-hidden">
            {/* Game header */}
            <button
              className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-muted/20 transition-colors text-left"
              onClick={() => mbId && toggleExpand(game.id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm truncate">
                    {game.homeTeam} vs {game.awayTeam}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{game.league}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {game.date} {game.time}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5', status.color)}>
                  {status.label}
                </Badge>
                {mbId ? (
                  <>
                    {lastUp && (
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        {format(lastUp, 'HH:mm:ss')}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </>
                ) : null}
              </div>
            </button>

            {/* Link button if no matchbook_event_id */}
            {!mbId && (
              <div className="px-4 pb-3">
                {linkingGameId === game.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={linkSearch}
                        onChange={e => setLinkSearch(e.target.value)}
                        placeholder="Buscar evento..."
                        className="h-8 text-xs"
                        onKeyDown={e => e.key === 'Enter' && linker.searchEvents(linkSearch)}
                      />
                      <Button size="sm" variant="outline" onClick={() => linker.searchEvents(linkSearch)}
                        disabled={linker.searching} className="h-8 text-xs shrink-0">
                        {linker.searching ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Buscar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setLinkingGameId(null)} className="h-8 text-xs shrink-0">
                        Cancelar
                      </Button>
                    </div>
                    {linker.searchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border border-border/40 rounded-md">
                        {linker.searchResults.map(ev => (
                          <button key={ev.id} onClick={() => handleManualLink(game.id, ev.id)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex justify-between">
                            <span>{ev.name}</span>
                            <span className="text-muted-foreground">{ev.start ? format(new Date(ev.start), 'dd/MM HH:mm') : ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => handleAutoLink(game.id, game.homeTeam, game.awayTeam)}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Vincular ao Matchbook
                  </Button>
                )}
              </div>
            )}

            {/* Expanded markets */}
            {mbId && isExpanded && (
              <div className="px-4 pb-4 border-t border-border/20 pt-3">
                {!markets ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <MarketBlock title="Match Odds" runners={markets.match_odds} flashes={flashes} prefix="mo" />
                      <MarketBlock title="BTTS" runners={markets.btts} flashes={flashes} prefix="btts" />
                      <MarketBlock title="Over 1.5 Goals" runners={markets.over_15} flashes={flashes} prefix="o15" />
                    </div>
                    <div>
                      <MarketBlock title="Correct Score" runners={markets.correct_score} flashes={flashes} prefix="cs" showLiquidity />
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default MonitorTrader;
