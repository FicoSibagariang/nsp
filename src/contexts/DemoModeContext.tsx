import React, { useState, useCallback } from 'react';
import { DemoModeContext, type DemoModeContextType } from './DemoModeContextDef';

export type { DemoModeContextType };

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
