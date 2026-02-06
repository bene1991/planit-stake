import { useRef, useEffect, useState } from 'react';

export interface LdiSnapshot {
  minute: number;
  ldi: number;
}

export function useLdiHistory(
  fixtureId: number | string | undefined,
  minuteNow: number | undefined | null,
  ldi: number | null
): LdiSnapshot[] {
  const historyRef = useRef<LdiSnapshot[]>([]);
  const lastFixtureRef = useRef<number | string | undefined>(undefined);
  const [, setTick] = useState(0);

  useEffect(() => {
    // Reset history if fixture changed
    if (fixtureId !== lastFixtureRef.current) {
      historyRef.current = [];
      lastFixtureRef.current = fixtureId;
    }
  }, [fixtureId]);

  useEffect(() => {
    if (fixtureId == null || minuteNow == null || ldi == null) return;

    const history = historyRef.current;
    const last = history[history.length - 1];

    // Only add if minute changed (avoid duplicates)
    if (!last || last.minute !== minuteNow) {
      history.push({ minute: minuteNow, ldi });
      setTick(t => t + 1); // trigger re-render
    } else if (last.ldi !== ldi) {
      // Same minute but LDI changed — update in place
      last.ldi = ldi;
      setTick(t => t + 1);
    }
  }, [fixtureId, minuteNow, ldi]);

  return historyRef.current;
}
