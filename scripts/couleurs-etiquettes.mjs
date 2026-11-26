// Range les couleurs des étiquettes « Statut Appel » de Pac Pac selon le code couleur du CRM :
// vert = ça avance, ambre = en attente / à relancer, rouge = perdu / pas bon, gris = neutre.
// Plusieurs nuances par famille pour que les étiquettes voisines restent distinctes.
// ECRIRE=oui écrit (avec copie de sécurité), sinon essai à blanc.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const ecrire = process.env.ECRIRE === "oui";

const NUANCES = {
  vert: ["#16a34a", "#0d9488", "#65a30d", "#059669", "#15803d", "#14b8a6", "#4d7c0f", "#22c55e"],
  ambre: ["#f59e0b", "#d97706", "#eab308", "#f97316", "#ca8a04", "#b45309", "#fbbf24", "#ea580c"],
  rouge: ["#dc2626", "#e11d48", "#b91c1c", "#be123c", "#ef4444", "#9f1239", "#f43f5e", "#7f1d1d"],
  gris: ["#94a3b8", "#64748b", "#a8a29e", "#78716c"],
};
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function famille(o) {
  const l = norm(`${o.label} ${o.key}`);
  if (o.key === "vide" || !o.label) return null;
  if (o.key === "nouveau_lead") return null; // étiquette de la marque (orange qui se voit), inchangée
  if (/pas interess|perdu|pas bon|pas eligible|pas adapt|mauvais num|prospe pas|panneau solaire|annul|refus/.test(l)) return "rouge";
  if (/nrp|rappel|rapel|relanc|attente|a rap|whats|whatt|immediat|manque|complique|a appeler|a faire|envoy|proposition|deja appele/.test(l)) return "ambre";
  if (/interess|rdv|recu|qualifi|sign|instal|vt |vt$|valid|en cours|traitement|accept|termin|pose/.test(l)) return "vert";
  return "gris";
}

const ref = db.doc("crm_boards/leads_columns");
const snap = await ref.get();
const data = snap.data() ?? {};
const cfg = data.config ?? {};
const opts = cfg.options?.status;
if (!opts) { console.log("Pas d'étiquettes enregistrées pour Statut Appel (liste d'origine du code)."); process.exit(0); }
const compte = { vert: 0, ambre: 0, rouge: 0, gris: 0 };
const next = opts.map((o) => {
  const f = famille(o);
  if (!f) { console.log(`= ${o.label || "(vide)"} [${o.key}] ${o.hex} (inchangée)`); return o; }
  const hex = NUANCES[f][compte[f]++ % NUANCES[f].length];
  console.log(`${f.toUpperCase().padEnd(5)} ${o.label} [${o.key}] ${o.hex} → ${hex}${o.off ? " (masquée)" : ""}`);
  return { ...o, hex };
});
console.log("Familles :", JSON.stringify(compte));
if (ecrire) {
  const jour = new Date().toISOString().slice(0, 10);
  await db.doc(`crm_boards/leads_columns_avant_couleurs_${jour}`).set(data);
  await ref.set({ ...data, config: { ...cfg, options: { ...cfg.options, status: next } }, updatedAt: new Date(), updatedBy: "contact@ip5energie.com" });
  console.log(`Écrit. Copie de sécurité : crm_boards/leads_columns_avant_couleurs_${jour}`);
} else console.log("ESSAI À BLANC : rien n'est écrit.");
