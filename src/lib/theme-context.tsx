"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "system-c" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: "system-c", setTheme: () => {} });

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme?: string }) {
  const [theme, setThemeState] = useState<Theme>((initialTheme as Theme) || "system-c");

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("constructa-theme", t);
    // Persist to DB via fetch (fire and forget)
    fetch("/api/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: t }) }).catch(() => {});
  };

  useEffect(() => {
    const stored = localStorage.getItem("constructa-theme") as Theme | null;
    if (stored && stored !== theme) setThemeState(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
