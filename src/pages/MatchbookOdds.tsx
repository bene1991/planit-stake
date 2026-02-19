import { useState } from 'react';
import { useMatchbook } from '@/hooks/useMatchbook';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wifi, WifiOff, RefreshCw, Search, ArrowLeft, Clock } from 'lucide-react';
import { format } from 'date-fns';

const MatchbookOdds = () => {
  const {
    connected, events, scores, loading, eventsLoading, scoresLoading,
    error, lastUpdated, login, fetchEvents, fetchCorrectScoreLay,
  } = useMatchbook();

  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<{ id: number; name: string } | null>(null);

  const filteredEvents = events.filter(e =>
    e.event_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleConnect = async () => {
    await login();
    await fetchEvents();
  };

  const handleSelectEvent = async (eventId: number, eventName: string) => {
    setSelectedEvent({ id: eventId, name: eventName });
    await fetchCorrectScoreLay(eventId);
  };

  const handleRefreshScores = async () => {
    if (selectedEvent) {
      await fetchCorrectScoreLay(selectedEvent.id);
    }
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
          {!connected && (
            <Button onClick={handleConnect} disabled={loading} size="sm">
              {loading ? 'Conectando...' : 'Conectar'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Event list or Score table */}
      {!selectedEvent ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Eventos de Futebol</CardTitle>
              {connected && (
                <Button variant="outline" size="sm" onClick={fetchEvents} disabled={eventsLoading}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${eventsLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              )}
            </div>
            {connected && (
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar evento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!connected && !loading && (
              <p className="text-center text-muted-foreground py-8">
                Clique em "Conectar" para autenticar na Matchbook
              </p>
            )}
            {eventsLoading && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}
            {connected && !eventsLoading && filteredEvents.length === 0 && (
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
      ) : (
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
