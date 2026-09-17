import { useEffect, useRef } from "react";
import { pushBackLevel } from "@/lib/backNav";

// À utiliser à chaque niveau de navigation interne (onglet, modale...) :
// tant que `active` est vrai, le bouton "précédent" du navigateur ferme ce
// niveau (appelle onBack) au lieu de quitter la page.
export function useBrowserBackLevel(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    return pushBackLevel(() => onBackRef.current());
  }, [active]);
}
