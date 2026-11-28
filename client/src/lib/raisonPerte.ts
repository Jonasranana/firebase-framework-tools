// ─────────────────────────────────────────────────────────────────────────
// Raison de perte d'un lead : demandée (en un clic) à la personne qui vient de passer
// un lead en « perdu » (pas intéressé, pas bon, pas éligible, mauvais numéro…).
// Enregistrée dans fields.raisonPerte ; les totaux sont dans la page Pub Meta.
// ─────────────────────────────────────────────────────────────────────────
import { statusInfo, type Lead } from "@/lib/crm";

export const RAISON_KEY = "raisonPerte";

export const RAISONS: { k: string; label: string; emoji: string }[] = [
  { k: "locataire", label: "Locataire", emoji: "🏢" },
  { k: "appartement", label: "Appartement", emoji: "🏬" },
  { k: "revenus", label: "Revenus trop élevés", emoji: "💶" },
  { k: "curieux", label: "Pas de projet / curieux", emoji: "🤷" },
  { k: "deja", label: "Déjà équipé ou devis ailleurs", emoji: "🔧" },
  { k: "prix", label: "Trop cher / reste à charge", emoji: "💸" },
  { k: "numero", label: "Faux numéro / faux contact", emoji: "☎️" },
  { k: "injoignable", label: "Ne répond plus", emoji: "📵" },
  { k: "zone", label: "Hors zone", emoji: "🗺️" },
  { k: "autre", label: "Autre", emoji: "✏️" },
];

const PERDU_CLES = new Set(["pas_interesse", "pas_eligible_revenu", "pas_eligible_pac", "mauvais_numero", "pas_bon", "pas_adapte"]);
export const estPerdu = (status: string) =>
  PERDU_CLES.has(status) || /pas\s+int[ée]ress|pas\s+(bon|[ée]ligible|adapt)|perdu|mauvais\s+num/i.test(String(statusInfo(status).label ?? ""));

// Leads que je viens de passer en « perdu » (moins de 2 h) sans raison : la fenêtre les demande un par un.
export const aExpliquer = (leads: Lead[], email: string) => {
  const moi = email.toLowerCase();
  const depuis = Date.now() - 2 * 3600000;
  return leads.filter(
    (l) =>
      !l.deletedAt &&
      estPerdu(l.status) &&
      !String(l.fields?.[RAISON_KEY] ?? "").trim() &&
      String(l.updatedBy ?? "").toLowerCase() === moi &&
      Date.parse(l.statusChangedAt || "") >= depuis,
  );
};
