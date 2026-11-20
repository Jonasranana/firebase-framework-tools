import type { Lead } from "@/lib/crm";
import { ceeSeule, mprRecue } from "@/lib/chantiers";

// ─────────────────────────────────────────────────────────────────────────
// « Notre suivi » des dossiers Praimy : nos propres étapes, à côté de l'étape
// affichée par Praimy. Plusieurs étiquettes peuvent être posées en même temps
// (la demande MaPrimeRénov' et la pré-visite avancent chacune à leur rythme).
// Enregistré sur la fiche du client dans le CRM : fields.suiviPraimy = "clé,clé,…".
// ─────────────────────────────────────────────────────────────────────────
export const SUIVI_KEY = "suiviPraimy";
export const SUIVI: { key: string; label: string; hex: string }[] = [
  { key: "propal_envoyee", label: "1. Propal envoyée", hex: "#579bfc" },
  { key: "propal_signee", label: "2. Propal signée", hex: "#00c875" },
  { key: "mpr_a_demander", label: "3. MPR à demander", hex: "#fdab3d" },
  { key: "mpr_completee", label: "4. MPR complétée", hex: "#9d50dd" },
  { key: "previsite_a_programmer", label: "5. Prévisite à programmer", hex: "#ff642e" },
  { key: "previsite_programmee", label: "6. Prévisite programmée", hex: "#00a2ae" },
  { key: "installation_programmee", label: "7. Installation programmée", hex: "#037f4c" },
  { key: "installe", label: "8. Installé", hex: "#333333" },
];
export const suiviOf = (l?: Lead | null): string[] =>
  String(l?.fields[SUIVI_KEY] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((k) => SUIVI.some((o) => o.key === k));
export const suiviLabel = (k: string) => SUIVI.find((o) => o.key === k)?.label ?? k;

const f = (l: Lead, k: string) => String(l.fields[k] ?? "").trim();
export const dateVtOf = (l?: Lead | null) => (l ? f(l, "dateVt").slice(0, 10) : "");
export const datePoseOf = (l?: Lead | null) => (l ? f(l, "datePose").slice(0, 10) : "");

// Ce qu'il reste à faire de notre côté, d'après nos étiquettes et les dates du planning.
export function prochainesEtapes(l?: Lead | null): string[] {
  if (!l) return [];
  const t = new Set(suiviOf(l));
  const installe = t.has("installe") || l.fields.pipeline === "Installé";
  if (installe) return ["✅ Terminé"];
  if (!t.has("propal_signee")) return [t.has("propal_envoyee") ? "Relancer pour la signature" : "Envoyer la proposition"];
  const out: string[] = [];
  if (!t.has("mpr_completee") && !mprRecue(l)) out.push("Faire la demande MaPrimeRénov'");
  const vt = dateVtOf(l);
  const pose = datePoseOf(l);
  if (!vt && !t.has("previsite_programmee")) out.push("Programmer la pré-visite");
  else if (!pose && !t.has("installation_programmee")) {
    const cee = ceeSeule(l);
    // La CEE ne couvre pas le fourni-posé : on attend l'octroi MaPrimeRénov' avant d'installer.
    if (cee !== null && cee < 0 && !mprRecue(l)) out.push("Attendre l'octroi MaPrimeRénov' avant la pose");
    else out.push("Programmer l'installation");
  }
  return out.length ? out : ["Suivre la pose"];
}

// Rapprochement dossier Praimy ↔ fiche du CRM : référence Praimy enregistrée sur la fiche,
// sinon nom identique (sans accents ni majuscules, prénom/nom dans n'importe quel ordre) avec une seule fiche.
const normName = (s?: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
export function makeMatcher(leads: Lead[]) {
  const actifs = leads.filter((l) => !l.deletedAt && (l.board || "leads") === "leads");
  const byRef = new Map<string, Lead>();
  const byName = new Map<string, Lead[]>();
  for (const l of actifs) {
    const ref = f(l, "refPraimy");
    if (ref) byRef.set(ref, l);
    const k = normName(l.name);
    if (k) byName.set(k, [...(byName.get(k) ?? []), l]);
  }
  return (reference?: string, clientNom?: string): Lead | null => {
    const r = reference ? byRef.get(String(reference)) : undefined;
    if (r) return r;
    const c = byName.get(normName(clientNom)) ?? [];
    return c.length === 1 ? c[0] : null;
  };
}
