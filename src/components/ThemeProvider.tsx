'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'dim' | 'light';
/** "system" means the athlete has not chosen yet, so the device decides. */
export type ThemePreference = Theme | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find(row => row.startsWith(name + '='))
    ?.split('=')[1];
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({
  children,
  initialTheme = 'system',
}: {
  children: React.ReactNode;
  initialTheme?: ThemePreference;
}) {
  const [preference, setPreference] = useState<ThemePreference>(initialTheme);
  const [theme, setThemeState] = useState<Theme>(
    initialTheme === 'system' ? 'dark' : initialTheme
  );

  useEffect(() => {
    const cookie = getCookie('trainai_theme') as ThemePreference | undefined;
    const pref = cookie ?? initialTheme;
    const resolved = pref === 'system' ? systemTheme() : pref;
    setPreference(pref);
    setThemeState(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, [initialTheme]);

  // Track the device only while no explicit choice has been made, so someone
  // who picked dark keeps it when their phone switches to light at sunrise.
  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const resolved: Theme = mq.matches ? 'light' : 'dark';
      setThemeState(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setTheme = (newTheme: Theme) => {
    setPreference(newTheme);
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    document.cookie = `trainai_theme=${newTheme}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    // Persist to DB
    fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme }),
    }).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
