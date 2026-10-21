import { useEffect } from "react";

// Le CRM (/admin) n'a que le mode clair : le mode sombre est retiré (traits et couleurs peu lisibles).
// On enlève aussi un éventuel ancien choix « sombre » gardé sur l'appareil.
export type Theme = "light";

export function useAdminTheme(): [Theme] {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("crm-dark", "dark");
    try {
      localStorage.removeItem("crm-theme");
    } catch {
      /* non essentiel */
    }
  }, []);
  return ["light"];
}
