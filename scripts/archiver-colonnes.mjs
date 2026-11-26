// Archive des colonnes du tableau Pac Pac (comme « ··· → Archiver la colonne », pour plusieurs à la fois).
// Les colonnes vont dans « Pac Pac archivé », avec leurs valeurs (rien n'est effacé dans les fiches) ;
// chacune peut y être réactivée ou supprimée définitivement. Copie de sécurité de la configuration
// avant changement : crm_boards/leads_columns_avant_archivage_<date>.
// ARCHIVER=oui pour écrire ; sinon essai à blanc (liste seulement).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const ecrire = process.env.ARCHIVER === "oui";
const CLES = (process.env.COLONNES || "").split(",").map((s) => s.trim()).filter(Boolean);
const ref = db.doc("crm_boards/leads_columns");
const snap = await ref.get();
const cfg = snap.data()?.config ?? {};
const order = [...(cfg.order ?? [])];
const trash = [...(cfg.colTrash ?? [])];
const deleted = new Set(cfg.deleted ?? []);
let custom = [...(cfg.custom ?? [])];
const now = new Date().toISOString();
const faites = [];
for (const key of CLES) {
  if (trash.some((e) => e.key === key)) { console.log(`déjà archivée/supprimée : ${key}`); continue; }
  const perso = custom.find((c) => c.key === key);
  const idx = order.indexOf(key);
  trash.push({ key, title: cfg.titles?.[key] ?? perso?.title ?? key, kind: "archive", at: now, after: idx > 0 ? order[idx - 1] : undefined, ...(perso ? { col: perso } : {}) });
  if (idx >= 0) order.splice(idx, 1);
  if (perso) custom = custom.filter((c) => c.key !== key);
  else deleted.add(key);
  faites.push(key);
}
// Firestore n'accepte pas undefined
const propre = JSON.parse(JSON.stringify({ ...cfg, order, colTrash: trash, deleted: [...deleted], custom }));
console.log(`${ecrire ? "ARCHIVAGE" : "ESSAI À BLANC"} : ${faites.length} colonne(s) → ${faites.join(", ")}`);
if (ecrire && faites.length) {
  const jour = now.slice(0, 10);
  await db.doc(`crm_boards/leads_columns_avant_archivage_${jour}`).set({ config: cfg, savedAt: FieldValue.serverTimestamp() });
  await ref.set({ config: propre, updatedAt: FieldValue.serverTimestamp(), updatedBy: "contact@ip5energie.com" });
  console.log("Fait. Copie de sécurité : crm_boards/leads_columns_avant_archivage_" + jour);
}
