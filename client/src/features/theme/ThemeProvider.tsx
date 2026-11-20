import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void; toggleTheme: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'ampec-sales-portal-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* private browsing */ }
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme, setTheme, toggleTheme: () => setTheme(current => current === 'dark' ? 'light' : 'dark'),
  }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
