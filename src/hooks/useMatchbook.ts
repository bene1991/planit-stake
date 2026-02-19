import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface MatchbookEvent {
  event_id: number;
  event_name: string;
  start_time: string;
}

interface CorrectScoreLay {
  score: string;
  lay_price: number;
  lay_available: number;
}

export function useMatchbook() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<MatchbookEvent[]>([]);
  const [scores, setScores] = useState<CorrectScoreLay[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const invoke = useCallback(async (params: Record<string, string>) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const qs = new URLSearchParams(params).toString();
    const url = `https://${projectId}.supabase.co/functions/v1/matchbook-api?${qs}`;
    
    const res = await fetch(url, {
      headers: {
        'apikey': anonKey,
        'Content-Type': 'application/json',
      },
    });
    
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error || `Request failed (${res.status})`);
    }
    return json;
  }, []);

  const login = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await invoke({ action: 'login' });
      setConnected(true);
      toast.success('Conectado à Matchbook');
    } catch (err: any) {
      setError(err.message);
      setConnected(false);
      toast.error('Falha ao conectar: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    setError(null);
    try {
      const data = await invoke({ action: 'events', sport: '1' });
      setEvents(data.events || []);
      setConnected(true);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message);
      toast.error('Erro ao buscar eventos: ' + err.message);
    } finally {
      setEventsLoading(false);
    }
  }, [invoke]);

  const fetchCorrectScoreLay = useCallback(async (eventId: number) => {
    setScoresLoading(true);
    setError(null);
    try {
      const data = await invoke({ action: 'correct-score-lay', event_id: String(eventId) });
      setScores(data.scores || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message);
      toast.error('Erro ao buscar odds: ' + err.message);
    } finally {
      setScoresLoading(false);
    }
  }, [invoke]);

  return {
    connected,
    events,
    scores,
    loading,
    eventsLoading,
    scoresLoading,
    error,
    lastUpdated,
    login,
    fetchEvents,
    fetchCorrectScoreLay,
  };
}
