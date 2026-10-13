// ─────────────────────────────────────────────────────────────────────────
// Stockage des documents du CRM.
// - Fichiers : Firebase Storage, dossier crm/leads/<id>/ ou crm/artisans/<id>/
// - Index : collection Firestore crm_documents (un document par fichier) :
//   c'est lui qui alimente les listes (rapide, recherchable, sans lister le
//   Storage fichier par fichier). Les fichiers arrivés par mail (fonction
//   syncMailbox) ou repris de Monday y sont indexés de la même façon.
// ─────────────────────────────────────────────────────────────────────────
export const CRM_DOCUMENTS_COLLECTION = "crm_documents";

export const DOC_CATEGORIES = [
  "Avis d'imposition",
  "Pièce d'identité",
  "Facture énergie",
  "Taxe foncière / titre de propriété",
  "Devis / contrat",
  "Photos du chantier",
  "Dossier CEE / MaPrimeRénov'",
  "Assurance / RGE",
  "Autre",
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

// Pièces à réunir pour un dossier PAC particulier (fiche lead).
export const REQUIRED_LEAD_DOCS: DocCategory[] = [
  "Avis d'imposition",
  "Pièce d'identité",
  "Facture énergie",
];
// Pièces attendues d'un artisan partenaire.
export const REQUIRED_ARTISAN_DOCS: DocCategory[] = ["Assurance / RGE"];

export type OwnerType = "lead" | "artisan";

export type CrmDocument = {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  ownerName: string;
  name: string;
  category: DocCategory;
  size: number;
  contentType: string;
  path: string;
  url: string;
  source: "upload" | "mail" | "monday";
  uploadedBy: string;
  createdAt: string; // ISO
};

// Devine la catégorie d'après le nom du fichier (modifiable ensuite).
export function guessCategory(fileName: string): DocCategory {
  const n = fileName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/avis|impot|imposition|revenu|dgfip/.test(n)) return "Avis d'imposition";
  if (/identite|cni|passeport|carte.?id|permis/.test(n)) return "Pièce d'identité";
  if (/facture|edf|engie|totalenergies|energie|gaz|fioul|electricite/.test(n)) return "Facture énergie";
  if (/taxe.?fonciere|propriete|acte|titre/.test(n)) return "Taxe foncière / titre de propriété";
  if (/devis|contrat|bon.?de.?commande|propal/.test(n)) return "Devis / contrat";
  if (/mpr|maprimerenov|cee|c2e|attestation|cadre.?de.?contribution/.test(n)) return "Dossier CEE / MaPrimeRénov'";
  if (/assurance|decennale|rge|qualipac|kbis|urssaf/.test(n)) return "Assurance / RGE";
  if (/\.(jpe?g|png|heic|webp)$/.test(n) || /photo|img_|dsc/.test(n)) return "Photos du chantier";
  return "Autre";
}

export function documentFromDoc(id: string, d: Record<string, any>): CrmDocument {
  const created = d.createdAt;
  return {
    id,
    ownerType: d.ownerType === "artisan" ? "artisan" : "lead",
    ownerId: String(d.ownerId ?? ""),
    ownerName: String(d.ownerName ?? ""),
    name: String(d.name ?? ""),
    category: (DOC_CATEGORIES as readonly string[]).includes(d.category) ? d.category : "Autre",
    size: Number(d.size ?? 0),
    contentType: String(d.contentType ?? ""),
    path: String(d.path ?? ""),
    url: String(d.url ?? ""),
    source: d.source === "mail" || d.source === "monday" ? d.source : "upload",
    uploadedBy: String(d.uploadedBy ?? ""),
    createdAt:
      typeof created === "string"
        ? created
        : typeof created?.toDate === "function"
          ? created.toDate().toISOString()
          : "",
  };
}

export const isImage = (d: { contentType: string; name: string }) =>
  d.contentType.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(d.name);

export function formatSize(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} Go`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(b / 1e3))} Ko`;
}

// Réduit les grosses photos (> 1,5 Mo, côté max 2 400 px) avant l'envoi :
// l'envoi est plus rapide et le stockage moins chargé. Les PDF et les petites
// images partent tels quels. En cas d'échec, on envoie l'original.
export async function compressImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1_500_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
