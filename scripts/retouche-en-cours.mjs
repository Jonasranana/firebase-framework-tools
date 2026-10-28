// Ponctuel (demandé par Jonas) : 1) ressort de la corbeille Eric Gardelle (étape « En cours »),
// sauf s'il a été fusionné dans une autre fiche ; 2) place l'étape générale « En cours » juste avant
// « En cours chez BETS / Praimy / Georges ». Ne change aucune autre donnée.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const dry = process.env.DRY_RUN !== "false";
const BY = "retouche en cours";

const leadRef = db.doc("crm_leads/monday_12965178940");
const x = (await leadRef.get()).data();
console.log(`Fiche : ${x?.name} | corbeille=${!!x?.deletedAt} | fusionnée dans=${x?.mergedInto ?? "-"} | étape=${x?.fields?.c_sxgefs}`);
const canRestore = x && x.deletedAt && !x.mergedInto;

const ref = db.doc("crm_boards/leads_columns");
const cfg = (await ref.get()).data()?.config ?? {};
const etape = (cfg.custom ?? []).find((c) => c.key === "c_sxgefs");
const before = etape.options.map((o) => o.label).join(" › ");
const enCours = etape.options.find((o) => o.key === "en_cours");
etape.options = etape.options.filter((o) => o.key !== "en_cours");
etape.options.splice(etape.options.findIndex((o) => o.key === "e_bets"), 0, enCours);
console.log("Avant : " + before);
console.log("Après : " + etape.options.map((o) => o.label).join(" › "));

if (dry) { console.log(`ESSAI À BLANC (restauration ${canRestore ? "possible" : "IMPOSSIBLE"}).`); process.exit(0); }
if (canRestore) {
  await leadRef.update({
    deletedAt: FieldValue.delete(),
    deletedBy: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: BY,
    notes: FieldValue.arrayUnion({ id: Math.random().toString(36).slice(2, 9), kind: "statut", text: "Fiche ressortie de la corbeille", by: BY, at: new Date().toISOString() }),
  });
  console.log("Fiche ressortie de la corbeille.");
} else console.log("Fiche NON restaurée (pas dans la corbeille, ou fusionnée).");
await ref.set({ config: cfg, updatedAt: FieldValue.serverTimestamp(), updatedBy: BY }, { merge: true });
console.log("Ordre des étapes enregistré.");
