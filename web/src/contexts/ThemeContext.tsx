import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "auto";

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  isDark: boolean;
}

const Ctx = createContext<ThemeCtx>({ theme: "auto", setTheme: () => {}, isDark: false });

function systemIsDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return systemIsDark();
}

function applyClass(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem("simla_theme") as Theme) ?? "auto"
  );
  const [isDark, setIsDark] = useState(() => resolve(
    (localStorage.getItem("simla_theme") as Theme) ?? "auto"
  ));

  function setTheme(t: Theme) {
    localStorage.setItem("simla_theme", t);
    setThemeState(t);
    const d = resolve(t);
    setIsDark(d);
    applyClass(d);
  }

  // Apply on mount
  useEffect(() => {
    applyClass(isDark);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for system preference changes when in auto mode
  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
      applyClass(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return <Ctx.Provider value={{ theme, setTheme, isDark }}>{children}</Ctx.Provider>;
}

export function useTheme() { return useContext(Ctx); }
export function useIsDark() { return useContext(Ctx).isDark; }
