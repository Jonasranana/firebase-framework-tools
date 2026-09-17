import { useEffect } from "react";
import { LogoIP5 } from "./site-chrome";
import { MargesPremi } from "./OutilDevis";

// ─────────────────────────────────────────────────────────────────────────
// Accès direct au simulateur de marge Econergos / Prémi, SANS connexion
// Google — protégé uniquement par le secret de l'URL (comme /pac ou
// /gonflage). Non lié depuis le site public, non indexé. Ne jamais ajouter
// de lien vers cette page dans la navigation ou dans un contenu public :
// quiconque a l'URL y a accès.
//
// Ne contient aucune donnée client (voir OutilDevis.tsx pour l'onglet
// Clients, protégé par une vraie connexion Google + règles Firestore).
// ─────────────────────────────────────────────────────────────────────────

function useNoIndex() {
  useEffect(() => {
    document.title = "Marges Prémi — IP5 Énergie";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);
}

export default function MargesPremiPublic() {
  useNoIndex();
  return (
    <div className="min-h-screen bg-gray-50 pb-16" dir="ltr">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <LogoIP5 className="h-9" />
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <MargesPremi />
      </div>
    </div>
  );
}
