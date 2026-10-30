'use client';

import React, { useState, useEffect } from 'react';
import { ThemeContext, type ThemeMode } from './ThemeContextDef';

export type { ThemeMode };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const className = mode === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(className);
    document.documentElement.style.colorScheme = mode;
    document.documentElement.setAttribute('data-color-scheme', mode);
    document.documentElement.setAttribute('data-astryx-theme', 'neutral');
  }, [mode]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('theme-mode', newMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
