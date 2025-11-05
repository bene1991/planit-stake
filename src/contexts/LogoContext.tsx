import { createContext, useContext, ReactNode } from 'react';
import { useLogoVariant, LogoVariant } from '@/hooks/useLogoVariant';

interface LogoContextType {
  variant: LogoVariant;
  setVariant: (variant: LogoVariant) => void;
}

const LogoContext = createContext<LogoContextType | undefined>(undefined);

export function LogoProvider({ children }: { children: ReactNode }) {
  const { variant, setVariant } = useLogoVariant();

  return (
    <LogoContext.Provider value={{ variant, setVariant }}>
      {children}
    </LogoContext.Provider>
  );
}

export function useLogo() {
  const context = useContext(LogoContext);
  if (context === undefined) {
    throw new Error('useLogo must be used within a LogoProvider');
  }
  return context;
}
