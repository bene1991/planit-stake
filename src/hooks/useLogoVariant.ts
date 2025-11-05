import { useState, useEffect } from 'react';

export type LogoVariant = 'chart' | 'candlestick' | 'minimal';

const STORAGE_KEY = 'vt-logo-variant';

export function useLogoVariant() {
  const [variant, setVariant] = useState<LogoVariant>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as LogoVariant) || 'chart';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, variant);
  }, [variant]);

  return { variant, setVariant };
}
