// Copie serveur de la grille artisans (client/src/lib/artisanGrid.ts),
// utilisée pour générer le PDF. Garder les deux identiques.
const POWERS = ["6 kW", "8 kW", "11 kW", "14 kW", "16 kW et +"];
const PAC_TYPES = [
  { id: "mono", label: "PAC air/eau monobloc" },
  { id: "bibloc", label: "PAC air/eau bi-bloc (split)" },
  { id: "ht", label: "PAC air/eau haute température" },
];

const ARTISAN_GRID_SECTIONS = [
  ...PAC_TYPES.map((t) => ({
    id: `pose_${t.id}`,
    title: `Pose — ${t.label}`,
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

const COMPANY_FIELDS = [
  { id: "raisonSociale", label: "Raison sociale" },
  { id: "siret", label: "SIRET" },
  { id: "contactNom", label: "Contact" },
  { id: "telephone", label: "Téléphone" },
  { id: "ville", label: "Dépôt" },
  { id: "rge", label: "RGE QualiPAC" },
  { id: "decennale", label: "Décennale" },
  { id: "departements", label: "Départements" },
  { id: "capacite", label: "Chantiers / semaine" },
];

const TRAVEL_FIELDS = [
  { id: "rayonInclus", label: "Rayon de déplacement inclus", unit: "km" },
  { id: "prixKm", label: "Prix au-delà de ce rayon", unit: "€ HT / km" },
  { id: "distanceMax", label: "Distance maximale acceptée", unit: "km" },
];

module.exports = { ARTISAN_GRID_SECTIONS, COMPANY_FIELDS, TRAVEL_FIELDS };
