import { useEffect, useRef, useState, useCallback } from 'react';
import type { Game } from '@/hooks/useSupabaseGames';

// Momentos (em minutos desde o apito inicial) em que atualizamos placar/status via API.
// Escolhidos pra dar cobertura balanceada: 2 no 1T + 2 no 2T + finalização.
const MATCH_CHECKPOINTS = [15, 35, 48, 70, 85, 92, 100, 110];

// Enquanto o jogo não começa: checa a cada 5 min pra ver se virou Live.
const PRE_KICKOFF_POLL_MS = 5 * 60 * 1000;
// Depois do 110' sem estar Finished ainda: checa a cada 3 min.
const POST_MATCH_POLL_MS = 3 * 60 * 1000;
// Depois de tudo: nunca mais.
const MIN_DELAY_MS = 5 * 1000; // não dispara rajada
const MAX_DELAY_MS = 60 * 60 * 1000; // teto de 1h

function kickoffMs(game: Game): number | null {
  if (!game.date || !game.time) return null;
  const t = new Date(`${game.date}T${game.time}`).getTime();
  return Number.isFinite(t) ? t : null;
}

function nextCheckForGame(game: Game, now: number): number | null {
  // Já resolveu — sem mais checks
  if (game.status === 'Finished') return null;

  const ko = kickoffMs(game);
  if (ko == null) {
    // Sem horário conhecido: espaça bastante
    return now + PRE_KICKOFF_POLL_MS;
  }

  const elapsedMs = now - ko;
  const elapsedMin = elapsedMs / 60000;

  // Ainda não começou: polling suave até o apito
  if (elapsedMin < -1) {
    const untilKickoff = -elapsedMs; // ms
    // Confere no apito inicial (com pequena margem)
    return now + Math.min(untilKickoff + 30_000, PRE_KICKOFF_POLL_MS);
  }

  // Está no jogo — próxima milestone à frente
  for (const cp of MATCH_CHECKPOINTS) {
    if (elapsedMin < cp) {
      return ko + cp * 60_000;
    }
  }

  // Passou de todas as milestones e ainda não é Finished — insiste devagar
  return now + POST_MATCH_POLL_MS;
}

interface UseSmartMatchRefreshResult {
  secondsUntilRefresh: number;
  isRefreshing: boolean;
  isSmart: true;
}

/**
 * Refresh sob demanda por jogo: agenda um único timeout até o próximo "momento chave"
 * (kickoff, milestones internas, ou finalização) de qualquer jogo ativo.
 * Evita polling contínuo e economiza chamadas de API.
 */
export function useSmartMatchRefresh(
  games: Game[],
  onRefresh: () => Promise<void> | void,
  options: { enabled?: boolean } = {}
): UseSmartMatchRefreshResult {
  const { enabled = true } = options;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  // Snapshot leve de fixture_id + status + date+time — muda só quando algo relevante muda,
  // evita reagendar a cada render se `games` for uma referência diferente mas conteúdo igual.
  const activeSignature = games
    .filter(g => g.status !== 'Finished')
    .map(g => `${g.id}|${g.status}|${g.date}|${g.time}`)
    .sort()
    .join(',');

  const scheduleNext = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }

    const now = Date.now();
    const active = games.filter(g => g.status !== 'Finished');
    if (active.length === 0) {
      setSecondsUntilRefresh(0);
      return;
    }

    let nextAt = Infinity;
    for (const g of active) {
      const t = nextCheckForGame(g, now);
      if (t != null && t < nextAt) nextAt = t;
    }
    if (!Number.isFinite(nextAt)) {
      setSecondsUntilRefresh(0);
      return;
    }

    const delay = Math.min(Math.max(nextAt - now, MIN_DELAY_MS), MAX_DELAY_MS);
    setSecondsUntilRefresh(Math.floor(delay / 1000));

    countdownRef.current = setInterval(() => {
      setSecondsUntilRefresh(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    timeoutRef.current = setTimeout(async () => {
      setIsRefreshing(true);
      try {
        await onRefreshRef.current();
      } catch (err) {
        console.error('[useSmartMatchRefresh] erro no refresh:', err);
      } finally {
        setIsRefreshing(false);
        scheduleNext();
      }
    }, delay);
  }, [games, activeSignature]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      setSecondsUntilRefresh(0);
      return;
    }
    scheduleNext();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, activeSignature]);

  return { secondsUntilRefresh, isRefreshing, isSmart: true };
}
