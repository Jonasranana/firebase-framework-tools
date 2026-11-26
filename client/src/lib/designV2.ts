import { useCallback, useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Nouveau design du CRM, en essai : visible seulement pour les comptes de la
// liste ci-dessous (interrupteur « Nouveau design » en bas du menu pour le
// couper). Pour le donner à toute l'équipe : POUR_TOUS = true.
// Le style est dans index.css, sous la classe .crm-v2 posée sur le CRM.
// ─────────────────────────────────────────────────────────────────────────
export const DESIGN_V2_TESTEURS = ["alexis.sitbon@gmail.com", "jonassitbon8@gmail.com"];
export const DESIGN_V2_POUR_TOUS = true;
const KEY = "crm-design-v2";
const EVT = "crm-design-v2-change";

export function useDesignV2(email: string) {
  const allowed = DESIGN_V2_POUR_TOUS || DESIGN_V2_TESTEURS.includes(email.toLowerCase());
  const lire = () => {
    try {
      return localStorage.getItem(KEY) !== "0";
    } catch {
      return true;
    }
  };
  const [pref, setPref] = useState(lire);
  useEffect(() => {
    const on = () => setPref(lire());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  const toggle = useCallback(() => {
    try {
      localStorage.setItem(KEY, lire() ? "0" : "1");
    } catch {
      /* non essentiel */
    }
    window.dispatchEvent(new Event(EVT));
  }, []);
  return { allowed, on: allowed && pref, toggle };
}
