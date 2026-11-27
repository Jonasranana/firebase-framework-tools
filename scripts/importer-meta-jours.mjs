// Importe l'export Meta jour par jour (scripts/meta-jours.json) dans crm_meta_jours.
// Un document par jour et par campagne (id = jour_campagne) : réimporter remplace, ne double jamais. N'efface rien.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
if (!getApps().length) initializeApp();
const db = getFirestore();
const lignes = JSON.parse(readFileSync(new URL("./meta-jours.json", import.meta.url), "utf8"));
const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
let batch = db.batch();
let n = 0;
for (const l of lignes) {
  batch.set(db.collection("crm_meta_jours").doc(`${l.jour}_${slug(l.campagne)}`), { ...l, importePar: "claude", importeLe: FieldValue.serverTimestamp() });
  if (++n % 400 === 0) {
    await batch.commit();
    batch = db.batch();
  }
}
await batch.commit();
const total = lignes.reduce((s, l) => s + l.depense, 0);
console.log(`✅ ${n} lignes importées · ${Math.round(total)} € · ${lignes.reduce((s, l) => s + l.leads, 0)} leads Meta · du ${lignes.map((l) => l.jour).sort()[0]} au ${lignes.map((l) => l.jour).sort().pop()}`);
