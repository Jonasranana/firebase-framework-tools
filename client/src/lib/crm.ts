// ─────────────────────────────────────────────────────────────────────────
// CRM maison (remplace progressivement Monday) — types et utilitaires
// partagés. Collection Firestore : crm_leads (un document par lead).
// Les leads du site y sont copiés automatiquement par la Cloud Function
// copyLeadToCrm (functions/index.js) ; les autres sources (import Monday,
// Facebook, saisie manuelle) y écrivent directement.
// ─────────────────────────────────────────────────────────────────────────

export const CRM_LEADS_COLLECTION = "crm_leads";

// Statuts « 📞 Statut Appel » : exactement ceux du tableau Monday « Pac Pac »
// (mêmes libellés, même ordre, mêmes couleurs). La clé est ce qui est stocké.
// off : étiquette désactivée dans Monday (n'apparaît plus dans la liste de choix, mais les lignes qui l'ont gardent son affichage).
export type Opt = { key: string; label: string; hex: string; off?: boolean };

export const LEAD_STATUSES = [
  { key: "a_appeler", label: "À appeler", hex: "#225091" },
  { key: "rappel_demande", label: "Rappel demandé", hex: "#9d50dd" },
  { key: "interesse", label: "Intéressé", hex: "#037f4c" },
  { key: "rdv_pris", label: "RDV pris", hex: "#007eb5" },
  { key: "vt_faite_bets", label: "VT faite par bets", hex: "#216edf" },
  { key: "en_cours_bets", label: "En cours chez BETS", hex: "#66ccff" },
  { key: "en_cours", label: "en cours", hex: "#fdab3d" },
  { key: "attente_docs", label: "Attente docs", hex: "#579bfc" },
  { key: "docs_recu", label: "Docs recu", hex: "#00c875" },
  { key: "a_relancer", label: "A Relancer", hex: "#ff5ac4" },
  { key: "manque_revenu", label: "Manque les Revenu", hex: "#175a63" },
  { key: "manque_info", label: "Manque les info", hex: "#9d99b9" },
  { key: "nrp", label: "NRP", hex: "#cab641" },
  { key: "nrp2", label: "NRP 2", hex: "#cd9282" },
  { key: "mauvais_numero", label: "Mauvais numéro", hex: "#784bd1" },
  { key: "pas_interesse", label: "Pas intéressé", hex: "#bb3354" },
  { key: "pas_eligible_revenu", label: "Pas éligible revenu", hex: "#563e3e" },
  { key: "pas_eligible_pac", label: "Pas eligible a la Pac", hex: "#401694" },
  { key: "panneau_solaire", label: "Panneau solaire", hex: "#ff7575" },
  { key: "proposition_envoyee", label: "Proposition envoyer", hex: "#bda8f9" },
  { key: "me_rappelle", label: "ME RAPELLE", hex: "#ffadad" },
  { key: "instal_prevu", label: "Instal Prevu", hex: "#9cd326" },
  { key: "propal_praimy", label: "PROPAL PRAIMY A  FAIRE", hex: "#74afcc" },
  { key: "nouveau_lead", label: "🆕 Nouveau lead", hex: "#ff6d3b" },
  { key: "complique", label: "Compliqué", hex: "#5559df" },
  { key: "pas_adapte", label: "Pas adapté", hex: "#e484bd" },
  { key: "propal_recu", label: "PROPAL RECU", hex: "#4eccc6" },
  { key: "installer_bets", label: "installer bets", hex: "#9aadbd" },
  { key: "pas_bon", label: "PAS BON", hex: "#a9bee8" },
  { key: "whatsapp_envoye", label: "whattapp envoyé", hex: "#a1e3f6" },
  { key: "attente_revenus", label: "Attente revenus", hex: "#bca58a" },
  { key: "vt_praimy", label: "VT PRAIMY", hex: "#9cd326" },
  { key: "a_rap_carole", label: "A RAP CAROLE", hex: "#faa1f1" },
  { key: "vide", label: "", hex: "#c4c4c4" },
] as const satisfies readonly Opt[];

export type LeadStatus = (typeof LEAD_STATUSES)[number]["key"];

export const statusInfo = (key: string): Opt =>
  LEAD_STATUSES.find((s) => s.key === key) ?? LEAD_STATUSES[LEAD_STATUSES.length - 1];

// Ancien jeu de statuts (avant l'alignement sur Monday) → équivalent.
const LEGACY_STATUS: Record<string, LeadStatus> = {
  nouveau: "nouveau_lead",
  a_rappeler: "a_appeler",
  injoignable: "nrp",
  interesse: "interesse",
  rdv: "rdv_pris",
  dossier: "en_cours",
  gagne: "instal_prevu",
  perdu: "pas_interesse",
};

// Statuts « dossier clos / perdu » : plus de rappel à faire.
export const CLOSED_STATUSES: string[] = [
  "pas_interesse",
  "mauvais_numero",
  "pas_eligible_revenu",
  "pas_eligible_pac",
  "pas_adapte",
  "pas_bon",
  "instal_prevu",
  "installer_bets",
];
export const isClosedStatus = (k: string) => CLOSED_STATUSES.includes(k);
export const LOST_STATUSES = ["pas_interesse", "mauvais_numero", "pas_eligible_revenu", "pas_eligible_pac", "pas_adapte", "pas_bon"];
// Avancement d'un lead d'après son statut (pour les statistiques).
export const STATUS_RANK: Record<string, number> = {
  nouveau_lead: 0, vide: 0, a_appeler: 0,
  rappel_demande: 1, a_relancer: 1, me_rappelle: 1, nrp: 1, nrp2: 1, whatsapp_envoye: 1,
  mauvais_numero: 1, pas_interesse: 1, pas_eligible_revenu: 1, pas_eligible_pac: 1, pas_adapte: 1, pas_bon: 1,
  interesse: 2, manque_revenu: 2, manque_info: 2, attente_revenus: 2, complique: 2, en_cours: 2,
  proposition_envoyee: 2, propal_praimy: 2, propal_recu: 2, panneau_solaire: 2,
  rdv_pris: 3,
  attente_docs: 4, docs_recu: 4, en_cours_bets: 4, vt_faite_bets: 4,
  installer_bets: 5, instal_prevu: 5,
};

// Types de lead (le produit visé), déduits de la source pour les leads du site.
export const LEAD_TYPES = ["PAC", "Solaire", "SMS", "Gonflage", "Autre"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const TYPE_BADGE: Record<string, string> = {
  PAC: "bg-orange-100 text-orange-700",
  Solaire: "bg-yellow-100 text-yellow-700",
  SMS: "bg-blue-100 text-blue-700",
  Gonflage: "bg-purple-100 text-purple-700",
  Autre: "bg-gray-100 text-gray-600",
};

export type LeadNote = {
  id: string;
  text: string;
  by: string;
  at: string; // ISO
  kind?: "note" | "statut" | "message" | "mail"; // « statut »/« message »/« mail » = traces automatiques
};

// Fichier rangé dans une cellule « Fichiers » d'un tableau (copié depuis Monday ou ajouté dans le CRM).
export type FileRef = { id: string; name: string; url: string; path?: string; size?: number; ext?: string };

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
  // Autres colonnes du tableau (clé de colonne → valeur), voir LEAD_COLUMNS.
  fields: Record<string, string>;
  // Groupe du tableau (identifiant d'un LeadGroup), comme les groupes Monday.
  group: string;
  // Cellules « Fichiers » : clé de colonne → fichiers.
  fileCols: Record<string, FileRef[]>;
  // Tableau auquel appartient le lead (« leads » = Pac Pac, par défaut ; sinon identifiant d'un tableau créé dans le menu).
  board: string;
  // Date de rappel prévue (AAAA-MM-JJ), vide si aucune.
  rappelLe: string;
  // Boîte mail : un client a répondu et personne n'a encore ouvert la fiche.
  mailNonLu: boolean;
  // Documents rangés dans la fiche (tenus à jour à chaque ajout/suppression).
  docCount: number;
  docCats: string[];
  // Informations de qualification (revenus, chauffage…) : libellé → valeur.
  details: Record<string, string>;
  notes: LeadNote[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
  updatedBy: string;
  // Corbeille : date de mise à la corbeille (vide = fiche active). Purge après 30 jours.
  deletedAt: string;
  deletedBy: string;
  mergedInto: string;
  // Appels suivis automatiquement (qui a appelé, quand, avec quel statut).
  calls: { n: number; by: string; name: string; at: string; status: string }[];
  // Identifiant du client créé dans PRAIMY (rempli après « Envoyer à PRAIMY »).
  praimyClientId?: string;
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
  const status: LeadStatus = LEAD_STATUSES.some((s) => s.key === d.status)
    ? d.status
    : LEGACY_STATUS[d.status] ?? "vide";
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
    group: String(d.group ?? ""),
    board: String(d.board || LEADS_BOARD_ID),
    fileCols: d.fileCols && typeof d.fileCols === "object" ? d.fileCols : {},
    fields: d.fields && typeof d.fields === "object" ? d.fields : {},
    rappelLe: String(d.rappelLe ?? ""),
    mailNonLu: !!d.mailNonLu,
    docCount: Number(d.docCount ?? 0),
    docCats: Array.isArray(d.docCats) ? d.docCats : [],
    details: d.details && typeof d.details === "object" ? d.details : {},
    notes: Array.isArray(d.notes) ? d.notes : [],
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    updatedBy: String(d.updatedBy ?? ""),
    deletedAt: toIso(d.deletedAt),
    deletedBy: String(d.deletedBy ?? ""),
    mergedInto: String(d.mergedInto ?? ""),
    calls: Array.isArray(d.calls) ? d.calls : [],
    ...(d.praimyClientId ? { praimyClientId: String(d.praimyClientId) } : {}),
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

// ─────────────────────────────────────────────────────────────────────────
// Artisans partenaires (collection crm_artisans) — pipeline de recrutement
// des poseurs RGE QualiPAC, repris du tableau Monday « Recrutement
// sous-traitants PAC ».
// ─────────────────────────────────────────────────────────────────────────
export const CRM_ARTISANS_COLLECTION = "crm_artisans";

export const ARTISAN_STATUSES = [
  { key: "a_contacter", hex: "#7f8794", label: "À contacter", badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  { key: "mail1", hex: "#579bfc", label: "Proposition envoyée", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  { key: "relance", hex: "#66ccff", label: "Relancé", badge: "bg-cyan-100 text-cyan-700", dot: "bg-cyan-500" },
  { key: "dernier", hex: "#fdab3d", label: "Dernier message", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  { key: "a_rappeler", hex: "#9d50dd", label: "À rappeler", badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
  { key: "nrp", hex: "#cab641", label: "Injoignable", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { key: "potentiel", hex: "#00c875", label: "Potentiel", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  { key: "grille", hex: "#007eb5", label: "Grille remplie", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  { key: "signe", hex: "#037f4c", label: "Signé", badge: "bg-green-100 text-green-700", dot: "bg-green-600" },
  { key: "dead", hex: "#333333", label: "Abandonné", badge: "bg-gray-200 text-gray-500", dot: "bg-gray-300" },
] as const;

export type ArtisanStatus = (typeof ARTISAN_STATUSES)[number]["key"];

export const artisanStatusInfo = (key: string) =>
  ARTISAN_STATUSES.find((s) => s.key === key) ?? ARTISAN_STATUSES[0];

export type Artisan = {
  id: string;
  name: string;
  email: string;
  telephone: string;
  siret: string;
  ville: string;
  zone: string;
  status: ArtisanStatus;
  relanceLe: string;
  rgeVerifie: boolean;
  mailNonLu: boolean;
  docCount: number;
  docCats: string[];
  grille: {
    prices: Record<string, string>;
    travel: Record<string, string>;
    comment: string;
    submittedAt: string;
  } | null;
  notes: LeadNote[];
  source: string;
  mondayUrl: string;
  createdAt: string;
  updatedAt: string;
};

export function artisanFromDoc(id: string, d: Record<string, any>): Artisan {
  return {
    id,
    name: String(d.name ?? ""),
    email: String(d.email ?? ""),
    telephone: String(d.telephone ?? ""),
    siret: String(d.siret ?? ""),
    ville: String(d.ville ?? ""),
    zone: String(d.zone ?? ""),
    status: ARTISAN_STATUSES.some((s) => s.key === d.status) ? d.status : "a_contacter",
    relanceLe: String(d.relanceLe ?? ""),
    rgeVerifie: !!d.rgeVerifie,
    mailNonLu: !!d.mailNonLu,
    docCount: Number(d.docCount ?? 0),
    docCats: Array.isArray(d.docCats) ? d.docCats : [],
    grille: d.grille && typeof d.grille === "object" ? d.grille : null,
    notes: Array.isArray(d.notes) ? d.notes : [],
    source: String(d.source ?? ""),
    mondayUrl: String(d.mondayUrl ?? ""),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

export const isoToYmd = (iso: string) => (iso ? iso.slice(0, 10) : "");

// ─────────────────────────────────────────────────────────────────────────
// Groupes du tableau Leads (façon Monday). La liste des groupes est stockée
// dans Firestore (crm_boards/leads) et modifiable depuis le tableau ; tant
// qu'elle n'existe pas, DEFAULT_LEAD_GROUPS est utilisée (reprend les groupes
// du tableau Monday « Pac Pac »). Un lead dont le groupe est inconnu ou
// supprimé s'affiche dans le premier groupe.
// ─────────────────────────────────────────────────────────────────────────
export const CRM_BOARDS_COLLECTION = "crm_boards";
export const LEADS_BOARD_ID = "leads";

export type LeadGroup = { id: string; title: string; color: string; archived?: boolean };

export const DEFAULT_LEAD_GROUPS: LeadGroup[] = [
  { id: "nouveaux", title: "📥 Nouveaux leads", color: "#579bfc" },
  { id: "contacts", title: "0/ Contacts", color: "#9d50dd" },
  { id: "mebarek", title: "1/ Leads Mebarek", color: "#00c875" },
  { id: "rdv_mebarek", title: "RDV pris par Mebarek", color: "#007eb5" },
  { id: "docs_demandes", title: "2/ Docs demandés", color: "#fdab3d" },
  { id: "docs_recus", title: "3/ Docs reçus", color: "#66ccff" },
  { id: "previsite", title: "4/ Accord prévisite", color: "#ff642e" },
  { id: "installation", title: "5/ Date d'installation", color: "#037f4c" },
  { id: "nrp", title: "NRP", color: "#cab641" },
  { id: "pas_eligible", title: "Pas éligibles", color: "#7f8794" },
];

// Palette proposée pour colorer un groupe (couleurs Monday).
export const GROUP_COLORS = [
  "#579bfc", "#66ccff", "#00c875", "#037f4c", "#cab641", "#fdab3d",
  "#ff642e", "#df2f4a", "#ff5ac4", "#9d50dd", "#7f8794", "#333333",
];

export const groupOf = (lead: Lead, groups: LeadGroup[]) =>
  groups.find((g) => g.id === lead.group) ?? groups.find((g) => !g.archived) ?? groups[0];
