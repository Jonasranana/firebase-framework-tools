// ─────────────────────────────────────────────────────────────────────────
// Grille de prix de pose remplie par les artisans partenaires (page
// /espace-pro). Aucun tarif IP5 ici : l'artisan saisit SES prix, le
// matériel (Atlantic, Chappée) est fourni et livré par IP5.
//
// Stockage Firestore : artisan_grids/{uid} (voir GRID_FIELDS, la liste des
// champs autorisés est reprise telle quelle dans les règles Firestore).
// Le PDF envoyé par mail est généré côté serveur (notifyArtisanGridSubmitted
// dans functions/index.js) à partir de ARTISAN_GRID_SECTIONS, copiée là-bas
// sous forme JSON : garder les deux identiques si on modifie la grille.
// ─────────────────────────────────────────────────────────────────────────

export type GridLine = { id: string; label: string; unit: string };
export type GridSection = { id: string; title: string; hint?: string; lines: GridLine[] };

const POWERS = ["6 kW", "8 kW", "11 kW", "14 kW", "16 kW et +"];
const PAC_TYPES = [
  { id: "mono", label: "PAC air/eau monobloc" },
  { id: "bibloc", label: "PAC air/eau bi-bloc (split)" },
  { id: "ht", label: "PAC air/eau haute température" },
];

export const ARTISAN_GRID_SECTIONS: GridSection[] = [
  ...PAC_TYPES.map((t) => ({
    id: `pose_${t.id}`,
    title: `Pose — ${t.label}`,
    hint: "Pose complète, matériel fourni par IP5 : unité extérieure, module intérieur, raccordements, mise en eau.",
    lines: POWERS.map((p, i) => ({ id: `pose_${t.id}_${i}`, label: p, unit: "€ HT" })),
  })),
  {
    id: "depose",
    title: "Dépose de l'ancien chauffage",
    lines: [
      { id: "depose_fioul", label: "Dépose chaudière fioul + évacuation", unit: "€ HT" },
      { id: "depose_gaz", label: "Dépose chaudière gaz + évacuation", unit: "€ HT" },
      { id: "cuve_neutralisation", label: "Neutralisation cuve fioul", unit: "€ HT" },
      { id: "cuve_enlevement", label: "Enlèvement cuve fioul", unit: "€ HT" },
    ],
  },
  {
    id: "options",
    title: "Hydraulique et options",
    lines: [
      { id: "ballon_ecs", label: "Pose ballon d'eau chaude séparé", unit: "€ HT" },
      { id: "desembouage", label: "Désembouage du réseau", unit: "€ HT" },
      { id: "filtre", label: "Filtre / pot à boues", unit: "€ HT" },
      { id: "radiateur", label: "Remplacement d'un radiateur", unit: "€ HT / unité" },
      { id: "liaison_m", label: "Liaisons supplémentaires au-delà du standard", unit: "€ HT / m" },
      { id: "plots", label: "Plots / support unité extérieure", unit: "€ HT" },
      { id: "carottage", label: "Carottage mur", unit: "€ HT" },
    ],
  },
  {
    id: "elec",
    title: "Électricité",
    lines: [
      { id: "elec_protection", label: "Protection dédiée au tableau", unit: "€ HT" },
      { id: "elec_ligne_m", label: "Ligne électrique supplémentaire", unit: "€ HT / m" },
      { id: "elec_coffret", label: "Coffret de coupure extérieur", unit: "€ HT" },
    ],
  },
  {
    id: "service",
    title: "Mise en service et suivi",
    lines: [
      { id: "mes", label: "Mise en service + réglages", unit: "€ HT" },
      { id: "visite_tech", label: "Visite technique préalable", unit: "€ HT" },
      { id: "sav", label: "Déplacement SAV (hors garantie)", unit: "€ HT" },
    ],
  },
];

export const COMPANY_FIELDS = [
  { id: "raisonSociale", label: "Raison sociale", required: true },
  { id: "siret", label: "SIRET", required: true },
  { id: "contactNom", label: "Nom et prénom du contact", required: true },
  { id: "telephone", label: "Téléphone", required: true },
  { id: "ville", label: "Ville / code postal de votre dépôt", required: true },
  { id: "rge", label: "N° de certificat RGE QualiPAC (et date de validité)", required: true },
  { id: "decennale", label: "Assureur décennale et n° de contrat", required: true },
  { id: "departements", label: "Départements où vous intervenez", required: false },
  { id: "capacite", label: "Chantiers possibles par semaine", required: false },
] as const;

export const TRAVEL_FIELDS = [
  { id: "rayonInclus", label: "Rayon de déplacement inclus dans vos prix", unit: "km" },
  { id: "prixKm", label: "Prix au-delà de ce rayon", unit: "€ HT / km" },
  { id: "distanceMax", label: "Distance maximale acceptée", unit: "km" },
] as const;

// Matériel fourni et livré par IP5 : l'artisan ne le paie pas.
export const SUPPLIED_MATERIAL = [
  {
    brand: "Atlantic",
    model: "Alféa Excellia",
    image: "/images/marques/produits/atlantic.jpg",
  },
  {
    brand: "Chappée",
    model: "Gamme PAC air/eau",
    image: "/images/artisans/pac-prochainement.jpg",
    soon: true,
  },
];

export const ALL_LINE_IDS = ARTISAN_GRID_SECTIONS.flatMap((s) => s.lines.map((l) => l.id));

// Champs autorisés dans artisan_grids/{uid} (repris dans les règles Firestore).
export const GRID_FIELDS = [
  "email",
  "company",
  "travel",
  "prices",
  "comment",
  "status",
  "updatedAt",
  "submittedAt",
] as const;

export type ArtisanGrid = {
  email: string;
  company: Record<string, string>;
  travel: Record<string, string>;
  prices: Record<string, string>;
  comment: string;
  status: "draft" | "submitted";
};
