import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (enabled: boolean) => void;
}

const DemoModeContext = createContext<DemoModeContextType | null>(null);

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('demo-mode') === 'true';
    } catch {
      return false;
    }
  });

  const setDemoMode = useCallback((enabled: boolean) => {
    setIsDemoModeState(enabled);
    try {
      localStorage.setItem('demo-mode', String(enabled));
    } catch {
      // ignore storage error
    }
  }, []);

  const toggleDemoMode = useCallback(() => {
    setIsDemoModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('demo-mode', String(next));
      } catch {
        // ignore storage error
      }
      return next;
    });
  }, []);

  return (
    <DemoModeContext.Provider value={{ isDemoMode, toggleDemoMode, setDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
}

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
