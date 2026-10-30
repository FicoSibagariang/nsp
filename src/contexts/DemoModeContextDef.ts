import { createContext, useContext } from 'react';

export interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (enabled: boolean) => void;
}

export const DemoModeContext = createContext<DemoModeContextType | null>(null);

export function useDemoMode(): DemoModeContextType {
  const context = useContext(DemoModeContext);
  if (!context) {
    // Return a safe fallback if used outside provider (e.g. in tests)
    return {
      isDemoMode: false,
      toggleDemoMode: () => {},
      setDemoMode: () => {},
    };
  }
  return context;
}
