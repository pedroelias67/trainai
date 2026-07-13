'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'dim' | 'light';

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

export function ThemeProvider({
  children,
  initialTheme = 'dark',
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    const cookieTheme = getCookie('trainai_theme') as Theme | undefined;
    const resolved = cookieTheme || initialTheme;
    setThemeState(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, [initialTheme]);

  const setTheme = (newTheme: Theme) => {
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
