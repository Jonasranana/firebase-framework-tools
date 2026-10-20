import { LEAD_STATUSES, LEAD_TYPES, type Lead, type Opt } from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// Colonnes du tableau Leads : les mêmes que le tableau Monday « Pac Pac »,
// dans le même ordre, avec les mêmes libellés, options et couleurs.
// - « core » : champ principal de la fiche (nom, statut, téléphone…)
// - sinon la valeur est dans lead.fields[key] (écrite via fields.<key>)
// - « formula » : calculée ici comme dans Monday, jamais stockée
// ─────────────────────────────────────────────────────────────────────────
export type ColType =
  | "name"
  | "status"
  | "text"
  | "longtext"
  | "number"
  | "date"
  | "phone"
  | "email"
  | "formula"
  | "files"
  | "autodate"
  | "people"
  | "timeline"
  | "tags"
  | "appels"
  | "filecol";

export type LeadColumn = {
  key: string;
  title: string;
  type: ColType;
  width: number;
  core?: "name" | "status" | "phone" | "email" | "postalCode" | "rappelLe" | "type" | "source" | "projet";
  options?: readonly Opt[];
  unit?: string;
  // Colonne ajoutée depuis le menu de la colonne (valeur dans fields.<key>).
  custom?: boolean;
  // Retour à la ligne dans les cellules / colonne réduite.
  wrap?: boolean;
  collapsed?: boolean;
};

const o = (key: string, hex: string, label = key): Opt => ({ key, label, hex });

export const PIPELINE: Opt[] = [
  o("Docs demandés", "#74afcc"),
  o("Docs reçus", "#007eb5"),
  o("Attente conf. VT", "#579bfc"),
  o("VT programmée", "#216edf"),
  o("Devis en signature", "#bda8f9"),
  o("Mandat MPR à signer", "#ff5ac4"),
  o("Audit / Validé", "#00a2ae"),
  o("Pose programmée", "#037f4c"),
  o("Installé", "#00c875"),
  o("Pas bon", "#df2f4a"),
  o("BETSALEL", "#fdab3d"),
  o("PRAIMY", "#ff5ac4"),
];
export const COMMERCIAL: Opt[] = [
  o("Mebarek", "#007eb5"),
  o("Julien", "#579bfc"),
  o("Carole", "#9d50dd"),
  o("Alexis", "#ff6d3b"),
  o("Jonas", "#00c875"),
];
// « Attribué à » : clients donnés à appeler à quelqu'un (onglets « Mes clients »), sans toucher à « Commercial ».
export const ATTRIBUE: Opt[] = [
  o("Mebarek", "#007eb5"),
  o("Carole", "#9d50dd"),
  o("Alexis", "#ff6d3b"),
];
export const ATTRIBUE_KEY = "attribue";
export const MAIL_AUTO: Opt[] = [
  o("1 - Relance injoignable", "#fdab3d"),
  o("2 - Relance injoignable", "#ff007f"),
  o("3 - Relance injoignable", "#bb3354"),
  o("Confirmation + fiche technique", "#579bfc"),
  o("📎 Demande avis d'imposition", "#66ccff"),
  o("🙏 Remerciement appel", "#00c875"),
  o("🏠 Explication éligibilité", "#5559df"),
  o("⚠️ Infos manquantes", "#df2f4a"),
];
export const TYPE_DEMANDE: Opt[] = [
  o("📞 Rappel demandé", "#00c875"),
  o("🧮 Simulation", "#579bfc"),
  o("✉️ Réactivation", "#9d50dd"),
];
export const POSEUR: Opt[] = [o("NousGeorges", "#9cd326"), o("Premy", "#cab641"), o("PRAIMY", "#cab641"), o("BETS", "#757575")];
export const RESSENTI: Opt[] = [
  o("Positif", "#00c875"),
  o("Neutre", "#fdab3d"),
  o("Négatif", "#df2f4a"),
  o("Pas éligible à la PAC", "#7f5347"),
  o("Tres Positif", "#037f4c"),
  o("Revenus élevés", "#784bd1"),
  o("Eligible", "#007eb5"),
];
export const CHAUFFAGE: Opt[] = [
  o("FIOUL", "#6b7280"),
  o("GAZ", "#6b7280"),
  o("BOIS", "#6b7280"),
  o("ELECTRIC", "#6b7280"),
  o("GRANULER", "#6b7280"),
];
const TYPE_LEAD_OPTS: Opt[] = [
  o("PAC", "#fdab3d", "🔥 PAC"),
  o("Solaire", "#ffcb00", "☀️ Solaire"),
  o("SMS", "#579bfc", "📲 SMS"),
  o("Gonflage", "#9d50dd", "🚗 Gonflage"),
  o("Autre", "#757575"),
];

export const BASE_LEAD_COLUMNS: LeadColumn[] = [
  { key: "name", title: "Noms sociétés", type: "name", width: 300, core: "name" },
  { key: "status", title: "📞 Statut Appel", type: "status", width: 170, core: "status", options: LEAD_STATUSES },
  { key: "rappel", title: "Rappel", type: "date", width: 130, core: "rappelLe" },
  { key: "pipeline", title: "🔧 Pipeline", type: "status", width: 150, options: PIPELINE },
  { key: "commercial", title: "👤 Commercial", type: "status", width: 130, options: COMMERCIAL },
  { key: "appels", title: "📞 Appels", type: "appels", width: 150 },
  { key: "phone", title: "📞 Téléphone", type: "phone", width: 175, core: "phone" },
  { key: "mailAuto", title: "📧 Mail+SMS (Auto)", type: "status", width: 200, options: MAIL_AUTO },
  { key: "dernierMail", title: "📅 Dernier mail envoyé", type: "date", width: 150 },
  { key: "email", title: "📧 Email", type: "email", width: 220, core: "email" },
  { key: "cp", title: "📍 Code postal", type: "text", width: 100, core: "postalCode" },
  { key: "zoneCalc", title: "🌡️ Zone Climatique (calcul)", type: "formula", width: 150 },
  { key: "tranche", title: "Tranche (Site)", type: "text", width: 120 },
  { key: "revenuFiscal", title: "💰 Revenu fiscal (Calcul)", type: "number", width: 150, unit: "€" },
  { key: "profilAides", title: "🎨 Profil aides (Calcul)", type: "formula", width: 150 },
  { key: "foyerCalc", title: "👨‍👩‍👧 Foyer (Calcul)", type: "number", width: 110 },
  { key: "foyerSite", title: "👨‍👩‍👧 Foyer (Site)", type: "text", width: 110 },
  { key: "chauffageSite", title: "🔥 Chauffage (Site)", type: "text", width: 140 },
  { key: "chauffage", title: "🔥 Chauffage", type: "status", width: 120, options: CHAUFFAGE },
  { key: "surface", title: "📐 Surface", type: "number", width: 100, unit: "m²" },
  { key: "notesRapides", title: "📝 Notes rapides appel", type: "text", width: 220 },
  { key: "resume", title: "🧠 Résumé d'appel", type: "longtext", width: 240 },
  { key: "projet", title: "🔧 Projet", type: "text", width: 150, core: "projet" },
  { key: "source", title: "Source", type: "text", width: 150, core: "source" },
  { key: "docs", title: "📄 Documents", type: "files", width: 110 },
  { key: "opportunite", title: "🎯 Opportunité", type: "formula", width: 140 },
  { key: "maj", title: "Dernière mise à jour", type: "autodate", width: 140 },
  { key: "creation", title: "Journal de création", type: "autodate", width: 140 },
  { key: "typeDemande", title: "📥 Type de demande", type: "status", width: 160, options: TYPE_DEMANDE },
  { key: "type", title: "🏷️ Type de lead", type: "status", width: 130, core: "type", options: TYPE_LEAD_OPTS },
  { key: "personnes", title: "Personnes", type: "text", width: 130 },
  { key: "statutLed", title: "STATUT LED", type: "text", width: 120 },
  { key: "villeChantier", title: "VILLE CHANTIER", type: "text", width: 140 },
  { key: "premierContact", title: "Date 1er contact", type: "date", width: 140 },
  { key: "appelsMois", title: "📞 Appels (mois)", type: "number", width: 110 },
  { key: "poseur", title: "👷 Poseur", type: "status", width: 120, options: POSEUR },
  { key: "dateVt", title: "🗓 Date VT", type: "date", width: 130 },
  { key: "datePose", title: "🔧 Date Pose", type: "date", width: 130 },
  { key: "montant", title: "💶 Montant", type: "number", width: 110, unit: "€" },
  { key: "prenom", title: "🙋 Prénom (Auto)", type: "formula", width: 130 },
  { key: "region", title: "🗺️ Région", type: "formula", width: 140 },
  { key: "ressenti", title: "🎭 Ressenti de l'appel", type: "status", width: 160, options: RESSENTI },
  { key: ATTRIBUE_KEY, title: "🎯 Attribué à", type: "status", width: 130, options: ATTRIBUE },
];

// Colonnes affichées = colonnes d'origine + colonnes ajoutées, dans l'ordre choisi
// (voir lib/crmColumnsConfig.ts). Tableau modifié « en place » à chaque changement
// de configuration, pour que tout le CRM (filtres, tri, export…) voie les mêmes colonnes.
export const LEAD_COLUMNS: LeadColumn[] = [...BASE_LEAD_COLUMNS];

export type ColTrashEntry = {
  key: string;
  title: string;
  kind: "archive" | "delete";
  at: string;
  // Colonne ajoutée à la main (définition complète gardée ici) ; sinon colonne d'origine (simplement masquée).
  col?: LeadColumn;
  // Colonne qui la précédait, pour la remettre à la même place.
  after?: string;
};

export const COL_TRASH_DAYS = { archive: 60, delete: 30 } as const;
export const colDaysLeft = (e: ColTrashEntry, now = Date.now()) =>
  Math.max(0, COL_TRASH_DAYS[e.kind] - Math.floor((now - new Date(e.at).getTime()) / 86400000));

export type ColumnsConfig = {
  custom?: LeadColumn[];
  order?: string[];
  titles?: Record<string, string>;
  widths?: Record<string, number>;
  wrap?: Record<string, boolean>;
  collapsed?: Record<string, boolean>;
  deleted?: string[];
  // Corbeille des colonnes : « supprimée » (30 jours) ou « archivée » (60 jours), restaurables avec leurs valeurs
  // (les valeurs restent dans les fiches : seule la définition de la colonne est mise de côté).
  colTrash?: ColTrashEntry[];
  // Étiquettes modifiées d'une colonne de statut (clé de colonne → options).
  options?: Record<string, Opt[]>;
  // Tableau à part (ex. intégré depuis Monday) : seules ces colonnes d'origine sont gardées, le reste vient de « custom ».
  baseOnly?: string[];
};

const BASE_STATUSES: Opt[] = LEAD_STATUSES.map((x) => ({ ...x }));

export function applyColumnsConfig(cfg: ColumnsConfig | null | undefined, boardId = "leads") {
  const c = cfg ?? {};
  // « Statut Appel » : la liste partagée des statuts suit les étiquettes modifiées
  // (mise à jour sur place : tout le CRM la lit).
  const st = (LEAD_STATUSES as unknown) as Opt[];
  st.length = 0;
  st.push(...(c.options?.status ?? BASE_STATUSES).map((x) => ({ ...x })));
  const deleted = new Set(c.deleted ?? []);
  const all: LeadColumn[] = [...BASE_LEAD_COLUMNS.filter((x) => !deleted.has(x.key) && (!c.baseOnly || c.baseOnly.includes(x.key) || (x.key === ATTRIBUE_KEY && boardId === "leads"))), ...(c.custom ?? []).map((x) => ({ ...x, custom: true }))];
  const byKey = new Map(all.map((x) => [x.key, x]));
  const ordered: LeadColumn[] = [];
  for (const k of c.order ?? []) {
    const col = byKey.get(k);
    if (col) {
      ordered.push(col);
      byKey.delete(k);
    }
  }
  for (const col of Array.from(byKey.values())) ordered.push(col);
  // Le nom reste toujours la première colonne.
  ordered.sort((a, b) => (a.key === "name" ? -1 : b.key === "name" ? 1 : 0));
  const next = ordered.map((col) => ({
    ...col,
    title: c.titles?.[col.key] ?? col.title,
    width: col.key === "name" ? Math.max(300, c.widths?.[col.key] ?? 300) : c.collapsed?.[col.key] ? 52 : c.widths?.[col.key] ?? col.width,
    wrap: !!c.wrap?.[col.key],
    collapsed: !!c.collapsed?.[col.key],
    options: col.key === "status" ? LEAD_STATUSES : c.options?.[col.key] ?? col.options,
  }));
  LEAD_COLUMNS.length = 0;
  LEAD_COLUMNS.push(...next);
}

// ── Lecture / écriture d'une cellule ───────────────────────────────────────
// Colonne « Appels » : qui a fait le 1er, le 2e, le 3e appel (stocké dans fields.premierAppel…).
export const APPEL_SLOTS = [
  { key: "premierAppel", label: "1er appel", short: "1er" },
  { key: "deuxiemeAppel", label: "2e appel", short: "2e" },
  { key: "troisiemeAppel", label: "3e appel", short: "3e" },
  { key: "quatriemeAppel", label: "4e appel", short: "4e" },
  { key: "cinquiemeAppel", label: "5e appel", short: "5e" },
] as const;

export function cellValue(l: Lead, c: LeadColumn): string {
  if (c.type === "appels") return APPEL_SLOTS.filter((s) => l.fields[s.key]).map((s) => `${s.short} : ${l.fields[s.key]}`).join(" | ");
  if (c.type === "filecol") {
    const n = l.fileCols?.[c.key]?.length ?? 0;
    return n ? `${n} fichier${n > 1 ? "s" : ""}` : "";
  }
  if (c.core) return String((l as any)[c.core] ?? "");
  return String(l.fields[c.key] ?? "");
}

// Patch Firestore pour modifier une cellule (chemin pointé pour les colonnes
// « fields » : ne touche pas aux autres colonnes).
export function cellPatch(c: LeadColumn, value: string): Record<string, unknown> {
  if (c.core) return { [c.core]: value };
  return { [`fields.${c.key}`]: value };
}

// ── Formules (reprises des formules du tableau Monday) ─────────────────────
const dept = (cp: string) => String(cp ?? "").trim().slice(0, 2);
const IDF = ["75", "77", "78", "91", "92", "93", "94", "95"];
const H3 = ["06", "11", "13", "20", "30", "34", "66", "83"];
const H2 = [
  "04", "07", "09", "12", "16", "17", "18", "22", "24", "26", "28", "29", "31", "32", "33", "35", "36", "37",
  "40", "41", "44", "46", "47", "48", "49", "50", "53", "56", "61", "64", "65", "72", "79", "81", "82", "84", "85", "86",
];

export const zoneClimatique = (cp: string) => {
  if (!String(cp ?? "").trim()) return "";
  const d = dept(cp);
  return H3.includes(d) ? "☀️ Zone H3" : H2.includes(d) ? "⛅ Zone H2" : "☁️ Zone H1";
};

export const region = (cp: string) => (!String(cp ?? "").trim() ? "" : IDF.includes(dept(cp)) ? "Île-de-France" : "Hors Île-de-France");

// Seuils MaPrimeRénov' 2026 : [Bleu, Jaune, Violet] selon le foyer (1, 2, 3, 4, 5+).
const SEUILS_IDF = [[24031, 29253, 40851], [35270, 42933, 60051], [42357, 51564, 71846], [49455, 60208, 84562], [56580, 68877, 96817]];
const SEUILS_PROV = [[17363, 22259, 31185], [25393, 32553, 45842], [30540, 39148, 55196], [35676, 45735, 64550], [40835, 52348, 73907]];

export const profilAides = (cp: string, revenu: number, foyer: number) => {
  if (!(revenu > 0) || !(foyer > 0) || !String(cp ?? "").trim()) return "";
  const table = IDF.includes(dept(cp)) ? SEUILS_IDF : SEUILS_PROV;
  const [b, j, v] = table[Math.min(Math.max(Math.round(foyer), 1), 5) - 1];
  return revenu <= b ? "🔵 Bleu" : revenu <= j ? "🟡 Jaune" : revenu <= v ? "🟣 Violet" : "🌸 Rose";
};

export const prenomAuto = (name: string) => {
  const w = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  return w[0] === w[0].toUpperCase() && w[0].length > 1 && w[1] ? w[1] : w[0];
};

const num = (v: string) => {
  const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
};

const NEG_STATUS = ["pas_interesse", "pas_eligible_revenu", "pas_eligible_pac", "mauvais_numero", "nrp"];
const POS_STATUS = ["interesse", "rdv_pris", "docs_recu", "attente_docs"];
const WARM_STATUS = [...POS_STATUS, "rappel_demande", "a_relancer", "en_cours"];
const NEG_RESSENTI = ["Négatif", "Pas éligible à la PAC", "Nrp"];
const POS_RESSENTI = ["Positif", "Tres Positif", "Eligible", "Revenus élevés"];

export const profilOf = (l: Lead) =>
  profilAides(l.postalCode, num(l.fields.revenuFiscal), num(l.fields.foyerCalc));

export function opportunite(l: Lead): string {
  const ressenti = l.fields.ressenti ?? "";
  const profil = profilOf(l);
  const negS = NEG_STATUS.includes(l.status);
  const negR = NEG_RESSENTI.includes(ressenti);
  if (POS_STATUS.includes(l.status) && !negS && !negR && (POS_RESSENTI.includes(ressenti) || profil)) return "🔥 Chaude";
  if (!negS && !negR && (WARM_STATUS.includes(l.status) || POS_RESSENTI.includes(ressenti) || profil)) return "🟡 À suivre";
  return "⚪ Non prioritaire";
}

export function formulaValue(l: Lead, c: LeadColumn): string {
  switch (c.key) {
    case "zoneCalc":
      return zoneClimatique(l.postalCode);
    case "region":
      return region(l.postalCode);
    case "profilAides":
      return profilOf(l);
    case "prenom":
      return prenomAuto(l.name);
    case "opportunite":
      return opportunite(l);
    default:
      return "";
  }
}

export const DEFAULT_VISIBLE = BASE_LEAD_COLUMNS.map((c) => c.key);
export { LEAD_TYPES };
