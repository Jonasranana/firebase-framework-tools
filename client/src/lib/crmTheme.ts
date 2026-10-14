import { useEffect, useState } from "react";

// Mode clair / sombre du CRM (/admin). Le choix est mémorisé sur l'appareil ; au premier
// lancement on suit le réglage de l'ordinateur. Le mode sombre n'est actif que dans /admin.
export type Theme = "light" | "dark";
const KEY = "crm-theme";

const initial = (): Theme => {
  try {
    const s = localStorage.getItem(KEY);
    if (s === "light" || s === "dark") return s;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
};

export function useAdminTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(initial);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("crm-dark", theme === "dark");
    root.classList.toggle("dark", theme === "dark");
    return () => {
      root.classList.remove("crm-dark", "dark");
    };
  }, [theme]);
  const set = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* non essentiel */
    }
  };
  return [theme, set];
}
