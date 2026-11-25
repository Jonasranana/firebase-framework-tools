// Écriture validée par Jonas le 2026-11-19.
// Range le menu de gauche du CRM (crm_boards/sidebar) selon le plan A choisi par Jonas le 2026-11-19 :
// Au quotidien / Argent & PRAIMY / Outils / Archives (replié). Aucun tableau ni lead n'est supprimé :
// les éléments sont seulement déplacés. Copie de sauvegarde dans crm_boards/sidebar_sauvegarde_2026-11-19.
// Essai à blanc tant que DRY_RUN != "false".
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const dry = process.env.DRY_RUN !== "false";
initializeApp();
const db = getFirestore();
const ref = db.doc("crm_boards/sidebar");
const snap = await ref.get();
const config = snap.get("config");
if (!config?.folders?.length) throw new Error("Menu introuvable.");

const show = (c) => c.folders.map((f) => `[${f.title}]${f.collapsed ? " (replié)" : ""}\n` + f.items.map((i) => `   ${i.title}${i.archived ? " (archivé)" : ""}${i.deletedAt ? " (corbeille)" : ""}`).join("\n")).join("\n");
console.log("=== AVANT ===\n" + show(config));

const all = config.folders.flatMap((f) => f.items);
const used = new Set();
const take = (pred) => {
  const out = all.filter((i) => !used.has(i) && pred(i));
  out.forEach((i) => used.add(i));
  return out;
};
const page = (p) => (i) => i.core && i.page === p;
const depot = (i) => /d[ée]p[ôo]t/i.test(i.title ?? "");

// L'ordre compte : les archives d'abord (pour que « Tableau pour dépôt » ne reste pas en haut).
const archives = [...take(depot), ...take(page("archives")), ...take(page("clients")), ...take(page("gonflage"))];
const quotidien = [...take(page("leads")), ...take(page("planning")), ...take(page("actus"))];
const argent = [...take(page("renta")), ...take(page("praimy")), ...take(page("marges")), ...take(page("bareme"))];
const outils = [...take(page("documents")), ...take(page("stats")), ...take(page("corbeille"))];
// Tableaux déjà à la corbeille (ex. Artisans) : cachés, rangés dans Archives.
archives.push(...take((i) => !!i.deletedAt));
// Tout le reste (, tableaux créés à la main…) : gardé, à la fin d'« Au quotidien ».
const reste = all.filter((i) => !used.has(i));
console.log(`Éléments non prévus dans le plan (gardés en fin d'« Au quotidien ») : ${reste.length}`);

const next = {
  ...config,
  folders: [
    // f_tableau garde son identifiant (le CRM le recrée sinon).
    { id: "f_tableau", title: "Au quotidien", color: "#579bfc", items: [...quotidien, ...reste] },
    { id: "f_argent", title: "Argent & PRAIMY", color: "#fdab3d", items: argent },
    { id: "f_outils", title: "Outils", color: "#fb275d", items: outils },
    { id: "f_archives", title: "Archives", color: "#7f8794", collapsed: true, items: archives },
  ],
};
const count = (c) => c.folders.reduce((n, f) => n + f.items.length, 0);
if (count(next) !== all.length) throw new Error(`Compte différent : ${count(next)} au lieu de ${all.length}.`);
console.log("\n=== APRÈS ===\n" + show(next));
console.log(`\nÉléments : ${all.length} avant, ${count(next)} après. Mode : ${dry ? "ESSAI À BLANC" : "ÉCRITURE"}`);
if (!dry) {
  await db.doc("crm_boards/sidebar_sauvegarde_2026-11-19").set({ config, savedAt: FieldValue.serverTimestamp() });
  await ref.set({ config: next, updatedAt: FieldValue.serverTimestamp(), updatedBy: "contact@ip5energie.com" }, { merge: true });
  console.log("Menu rangé. Sauvegarde : crm_boards/sidebar_sauvegarde_2026-11-19");
}
