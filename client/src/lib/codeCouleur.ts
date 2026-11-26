// ─────────────────────────────────────────────────────────────────────────
// Code couleur des étiquettes : la couleur suit le SENS de l'étiquette.
// Quand quelqu'un ajoute ou renomme une étiquette, on devine son sens d'après
// son nom et on ne propose que les couleurs de cette famille :
//   vert = ça avance · ambre = en attente / à relancer · rouge = perdu / pas bon · gris = neutre.
// (Même règle que index.css « CODE COULEUR DU CRM ».)
// ─────────────────────────────────────────────────────────────────────────
export type Famille = "vert" | "ambre" | "rouge" | "gris";

export const FAMILLES: { key: Famille; label: string; aide: string }[] = [
  { key: "vert", label: "🟢 Ça avance", aide: "intéressé, RDV, signé, docs reçus…" },
  { key: "ambre", label: "🟡 En attente", aide: "à rappeler, NRP, attente docs…" },
  { key: "rouge", label: "🔴 Perdu", aide: "pas intéressé, pas éligible, faux numéro…" },
  { key: "gris", label: "⚪ Neutre", aide: "information sans urgence" },
];

export const NUANCES: Record<Famille, string[]> = {
  vert: ["#16a34a", "#0d9488", "#65a30d", "#059669", "#15803d", "#14b8a6", "#4d7c0f", "#22c55e"],
  ambre: ["#f59e0b", "#ea580c", "#eab308", "#b45309", "#fb923c", "#ca8a04", "#c2410c", "#fcd34d", "#92400e", "#f97316", "#d97706", "#a16207"],
  rouge: ["#dc2626", "#e11d48", "#b91c1c", "#be123c", "#ef4444", "#9f1239", "#f43f5e", "#7f1d1d"],
  gris: ["#94a3b8", "#64748b", "#a8a29e", "#78716c", "#cbd5e1", "#57534e"],
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Famille devinée d'après le nom de l'étiquette (null tant que le nom est vide).
export function familleDuNom(nom: string): Famille | null {
  const l = norm(nom).trim();
  if (!l) return null;
  if (/pas interess|perdu|pas bon|pas eligible|non eligible|pas adapt|mauvais num|faux num|prospe pas|panneau solaire|annul|refus|abandon|bloque|litige|impaye/.test(l)) return "rouge";
  if (/nrp|repond pas|rappel|rapel|relanc|attente|attend|a rap|whats|whatt|immediat|manque|complique|a appeler|a faire|a envoyer|envoy|proposition|propal|deja appele|en pause|plus tard|reporte/.test(l)) return "ambre";
  if (/interess|rdv|recu|qualifi|sign|instal|pose|vt\b|visite|valid|en cours|traitement|accept|termin|paye|gagne|ok\b|fait\b|chaud/.test(l)) return "vert";
  return "gris";
}

export const familleDeCouleur = (hex: string): Famille | null =>
  (Object.keys(NUANCES) as Famille[]).find((f) => NUANCES[f].includes(hex.toLowerCase())) ?? null;

// Couleurs proposées pour une famille : d'abord celles encore libres dans la colonne ;
// si toutes sont prises, toute la famille (le sens prime sur l'unicité).
export function couleursPour(famille: Famille, prises: Iterable<string>): string[] {
  const p = new Set(Array.from(prises, (x) => x.toLowerCase()));
  const libres = NUANCES[famille].filter((c) => !p.has(c));
  return libres.length ? libres : NUANCES[famille];
}
