// ─────────────────────────────────────────────────────────────────────────
// CRM maison (remplace progressivement Monday) — types et utilitaires
// partagés. Collection Firestore : crm_leads (un document par lead).
// Les leads du site y sont copiés automatiquement par la Cloud Function
// copyLeadToCrm (functions/index.js) ; les autres sources (import Monday,
// Facebook, saisie manuelle) y écrivent directement.
// ─────────────────────────────────────────────────────────────────────────

export const CRM_LEADS_COLLECTION = "crm_leads";

// Étapes du suivi, dans l'ordre du tableau. Pour renommer/ajouter une étape,
// il suffit de modifier cette liste (la clé est ce qui est stocké en base).
export const LEAD_STATUSES = [
  { key: "nouveau", label: "Nouveau", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  { key: "a_rappeler", label: "À rappeler", badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
  { key: "injoignable", label: "Injoignable", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { key: "interesse", label: "Intéressé", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  { key: "rdv", label: "RDV pris", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  { key: "dossier", label: "Dossier en cours", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  { key: "gagne", label: "Gagné", badge: "bg-green-100 text-green-700", dot: "bg-green-500" },
  { key: "perdu", label: "Perdu", badge: "bg-gray-200 text-gray-600", dot: "bg-gray-400" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["key"];

export const statusInfo = (key: string) =>
  LEAD_STATUSES.find((s) => s.key === key) ?? LEAD_STATUSES[0];

// Types de lead (le produit visé), déduits de la source pour les leads du site.
export const LEAD_TYPES = ["PAC", "Solaire", "Gonflage", "Autre"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const TYPE_BADGE: Record<string, string> = {
  PAC: "bg-orange-100 text-orange-700",
  Solaire: "bg-yellow-100 text-yellow-700",
  Gonflage: "bg-purple-100 text-purple-700",
  Autre: "bg-gray-100 text-gray-600",
};

export type LeadNote = {
  id: string;
  text: string;
  by: string;
  at: string; // ISO
  kind?: "note" | "statut" | "message"; // « statut »/« message » = traces automatiques
};

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  postalCode: string;
  city: string;
  type: LeadType;
  source: string;
  projet: string;
  status: LeadStatus;
  // Date de rappel prévue (AAAA-MM-JJ), vide si aucune.
  rappelLe: string;
  // Informations de qualification (revenus, chauffage…) : libellé → valeur.
  details: Record<string, string>;
  notes: LeadNote[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
  updatedBy: string;
};

// Convertit un Timestamp Firestore (ou une chaîne) en ISO.
export function toIso(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  const anyV = v as { toDate?: () => Date };
  if (typeof anyV.toDate === "function") return anyV.toDate().toISOString();
  return "";
}

// Normalise un document Firestore en Lead (tolérant aux champs manquants).
export function leadFromDoc(id: string, d: Record<string, any>): Lead {
  const status = LEAD_STATUSES.some((s) => s.key === d.status) ? d.status : "nouveau";
  return {
    id,
    name: String(d.name ?? ""),
    phone: String(d.phone ?? ""),
    email: String(d.email ?? ""),
    postalCode: String(d.postalCode ?? ""),
    city: String(d.city ?? ""),
    type: (LEAD_TYPES as readonly string[]).includes(d.type) ? d.type : "Autre",
    source: String(d.source ?? ""),
    projet: String(d.projet ?? ""),
    status,
    rappelLe: String(d.rappelLe ?? ""),
    details: d.details && typeof d.details === "object" ? d.details : {},
    notes: Array.isArray(d.notes) ? d.notes : [],
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    updatedBy: String(d.updatedBy ?? ""),
  };
}

// ── Téléphone ──────────────────────────────────────────────────────────────
// Chiffres uniquement, au format international sans « + » (ex. 33612345678),
// ce que demande wa.me. Les numéros français 0X… sont convertis en 33X….
export function phoneDigitsIntl(raw: string): string {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.slice(1).replace(/\D/g, "");
  d = d.replace(/\D/g, "");
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0") && d.length === 10) return "33" + d.slice(1);
  if (d.startsWith("33") && d.length === 11) return d;
  return d;
}

export const telHref = (raw: string) => {
  const d = phoneDigitsIntl(raw);
  return d ? `tel:+${d}` : "";
};

export const whatsappHref = (raw: string) => {
  const d = phoneDigitsIntl(raw);
  return d ? `https://wa.me/${d}` : "";
};

// Affichage « 06 12 34 56 78 » pour les numéros français.
export function formatPhone(raw: string): string {
  const d = phoneDigitsIntl(raw);
  if (d.startsWith("33") && d.length === 11) {
    return ("0" + d.slice(2)).replace(/(\d{2})(?=\d)/g, "$1 ");
  }
  return raw;
}

// ── Dates ──────────────────────────────────────────────────────────────────
export const todayYmd = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function formatShortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const formatYmd = (ymd: string) => {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return y && m && d ? `${d}/${m}/${y}` : ymd;
};
