import { useState, useEffect } from 'react';
import { useMatchbook } from '@/hooks/useMatchbook';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wifi, WifiOff, RefreshCw, Search, ArrowLeft, Clock, LogOut, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';

const SESSION_KEY = 'matchbook_creds';

function loadCreds(): { username: string; password: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveCreds(username: string, password: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username, password }));
}

function clearCreds() {
  sessionStorage.removeItem(SESSION_KEY);
}

const MatchbookOdds = () => {
  const {
    connected, events, scores, loading, eventsLoading, scoresLoading,
    error, lastUpdated, login, fetchEvents, fetchCorrectScoreLay, disconnect,
  } = useMatchbook();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<{ id: number; name: string } | null>(null);

  // Auto-login with saved creds
  useEffect(() => {
    const saved = loadCreds();
    if (saved && !connected) {
      setUsername(saved.username);
      setPassword(saved.password);
      (async () => {
        await login(saved.username, saved.password);
        await fetchEvents(saved.username, saved.password);
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEvents = events.filter(e =>
    e.event_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleConnect = async () => {
    if (!username.trim() || !password.trim()) return;
    await login(username, password);
    saveCreds(username, password);
    await fetchEvents(username, password);
  };

  const handleDisconnect = () => {
    disconnect();
    clearCreds();
    setPassword('');
    setSelectedEvent(null);
  };

  const handleSelectEvent = async (eventId: number, eventName: string) => {
    setSelectedEvent({ id: eventId, name: eventName });
    const saved = loadCreds();
    await fetchCorrectScoreLay(eventId, saved?.username, saved?.password);
  };

  const handleRefreshScores = async () => {
    if (selectedEvent) {
      const saved = loadCreds();
      await fetchCorrectScoreLay(selectedEvent.id, saved?.username, saved?.password);
    }
  };

  const handleRefreshEvents = async () => {
    const saved = loadCreds();
    await fetchEvents(saved?.username, saved?.password);
  };

  return (
    <div className="min-h-screen space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Matchbook Exchange</h1>
          <p className="text-sm text-muted-foreground">Correct Score — LAY Odds</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={connected ? 'default' : 'secondary'} className="gap-1.5">
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? 'Conectado' : 'Desconectado'}
          </Badge>
          {connected && (
            <Button variant="ghost" size="sm" onClick={handleDisconnect} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Login form */}
      {!connected && !loading && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Login Matchbook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mb-user">Username</Label>
              <Input
                id="mb-user"
                placeholder="Seu username da Matchbook"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mb-pass">Password</Label>
              <div className="relative">
                <Input
                  id="mb-pass"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Sua password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Credenciais armazenadas apenas na sessão do navegador. Fechou a aba? Precisa logar novamente.
            </p>
            <Button onClick={handleConnect} disabled={!username.trim() || !password.trim()} className="w-full">
              Conectar
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-6 flex items-center justify-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            <span className="text-muted-foreground">Autenticando na Matchbook...</span>
          </CardContent>
        </Card>
      )}

      {/* Event list or Score table */}
      {connected && !selectedEvent && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Eventos de Futebol</CardTitle>
              <Button variant="outline" size="sm" onClick={handleRefreshEvents} disabled={eventsLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${eventsLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar evento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {eventsLoading && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}
            {!eventsLoading && filteredEvents.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum evento encontrado</p>
            )}
            <div className="space-y-1">
              {filteredEvents.map((ev) => (
                <button
                  key={ev.event_id}
                  onClick={() => handleSelectEvent(ev.event_id, ev.event_name)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="font-medium text-sm text-foreground">{ev.event_name}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {ev.start_time ? format(new Date(ev.start_time), 'dd/MM HH:mm') : '—'}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {connected && selectedEvent && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => { setSelectedEvent(null); setSearch(''); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <CardTitle className="text-lg">{selectedEvent.name}</CardTitle>
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Atualizado: {format(lastUpdated, 'HH:mm:ss')}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleRefreshScores} disabled={scoresLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${scoresLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {scoresLoading && (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
            {!scoresLoading && scores.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma odd LAY disponível para Correct Score
              </p>
            )}
            {!scoresLoading && scores.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Lay Price</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.map((s) => (
                    <TableRow key={s.score}>
                      <TableCell className="font-medium">{s.score}</TableCell>
                      <TableCell className="text-right font-mono text-primary">
                        {s.lay_price?.toFixed(2) ?? '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        €{s.lay_available?.toFixed(2) ?? '0.00'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MatchbookOdds;
