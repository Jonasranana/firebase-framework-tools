// ─────────────────────────────────────────────────────────────────────────
// Chronomètre invisible du CRM : rien ne s'affiche. Il note les temps réels
// (ouverture, arrivée des fiches, recherche, ouverture d'une fiche, enregistrement,
// moments où la page « gèle ») et les envoie de temps en temps dans Firestore
// (crm_perf), pour savoir précisément ce qui est lent et le corriger.
// Désactivable d'un coup : ACTIF = false.
// ─────────────────────────────────────────────────────────────────────────
import { crmFirestore } from "@/lib/crmDb";

const ACTIF = true;
type Mesure = { n: string; ms: number; x?: string | number };
let file: Mesure[] = [];
let email = "";
let gels = { nb: 0, ms: 0 };
// L'onglet a-t-il été caché depuis l'ouverture ? (Chrome ralentit les onglets en arrière-plan : mesure à part.)
let ongletCache = typeof document !== "undefined" && document.visibilityState === "hidden";
const debuts = new Map<string, number>();
const dejaFait = new Set<string>();

export const chrono = {
  utilisateur(e: string) {
    email = e.toLowerCase();
  },
  // Temps écoulé depuis l'ouverture de la page (une seule fois par nom).
  depuisOuverture(n: string, x?: string | number) {
    if (!ACTIF || dejaFait.has(n)) return;
    dejaFait.add(n);
    chrono.noter(ongletCache ? `${n} (onglet caché)` : n, performance.now(), x);
  },
  debut(n: string) {
    if (ACTIF) debuts.set(n, performance.now());
  },
  // Fin d'une action commencée par debut() : mesurée après l'affichage (image suivante).
  fin(n: string, x?: string | number) {
    const t = debuts.get(n);
    if (!ACTIF || t === undefined) return;
    debuts.delete(n);
    requestAnimationFrame(() => setTimeout(() => chrono.noter(n, performance.now() - t, x), 0));
  },
  noter(n: string, ms: number, x?: string | number) {
    if (!ACTIF) return;
    file.push(x === undefined ? { n, ms: Math.round(ms) } : { n, ms: Math.round(ms), x });
    if (file.length >= 40) envoyer();
  },
};

function appareil() {
  const nav = navigator as any;
  return {
    mobile: matchMedia("(max-width: 767px)").matches,
    largeur: innerWidth,
    coeurs: nav.hardwareConcurrency ?? null,
    memoire: nav.deviceMemory ?? null,
    reseau: nav.connection?.effectiveType ?? null,
    navigateur: (navigator.userAgent.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/)?.[0] ?? "").slice(0, 30),
  };
}

let envoiEnCours = false;
async function envoyer() {
  if (!ACTIF || envoiEnCours || !email || (!file.length && !gels.nb)) return;
  const lot = file;
  const g = gels;
  file = [];
  gels = { nb: 0, ms: 0 };
  envoiEnCours = true;
  try {
    const { m, db } = await crmFirestore();
    await m.addDoc(m.collection(db, "crm_perf"), { email, at: new Date().toISOString(), appareil: appareil(), mesures: lot, gels: g });
  } catch {
    /* mesure perdue : sans importance */
  } finally {
    envoiEnCours = false;
  }
}

if (ACTIF && typeof window !== "undefined") {
  // « Gels » : tâches de plus de 50 ms qui bloquent la page (clics qui ne répondent pas).
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        gels.nb++;
        gels.ms += Math.round(e.duration);
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    /* navigateur sans cette mesure (Safari) */
  }
  // Fluidité du défilement (tableau à droite / à gauche, haut / bas) : pendant chaque défilement,
  // on compte les images trop lentes (> 50 ms entre deux images = saccade visible).
  let enCours = false;
  let dernier = 0;
  let finScroll = 0;
  let images = 0;
  let saccades = 0;
  let pire = 0;
  let debutScroll = 0;
  const boucle = (t: number) => {
    if (dernier) {
      const ecart = t - dernier;
      images++;
      if (ecart > 50) saccades++;
      if (ecart > pire) pire = ecart;
    }
    dernier = t;
    if (performance.now() < finScroll) requestAnimationFrame(boucle);
    else {
      enCours = false;
      if (images > 5) chrono.noter("defilement", pire, `${saccades}/${images} saccades en ${Math.round(t - debutScroll)} ms`);
    }
  };
  addEventListener(
    "scroll",
    () => {
      finScroll = performance.now() + 250;
      if (enCours) return;
      enCours = true;
      dernier = 0;
      images = 0;
      saccades = 0;
      pire = 0;
      debutScroll = performance.now();
      requestAnimationFrame(boucle);
    },
    { capture: true, passive: true },
  );
  setInterval(envoyer, 90_000);
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      ongletCache = true;
      envoyer();
    }
  });
}
