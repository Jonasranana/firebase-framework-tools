// Ajoute des dépenses pub Meta (captures Ads Manager) dans crm_meta_depenses.
// DEPENSES_B64 = JSON [{du, au, canal: "site"|"formulaire", campagne, montant, leadsMeta?}] en base64.
// Une dépense identique (mêmes dates, canal et pub) est remplacée, pas doublée. DRY_RUN=true : n'écrit rien.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const list = JSON.parse(Buffer.from(process.env.DEPENSES_B64 || "", "base64").toString("utf8"));
const dry = String(process.env.DRY_RUN) === "true";
// REMPLACER=true : retire d'abord toutes les dépenses ajoutées par Claude (createdBy « claude »),
// pour remplacer des totaux mensuels par le détail jour par jour sans rien compter en double.
if (String(process.env.REMPLACER) === "true") {
  const old = await db.collection("crm_meta_depenses").where("createdBy", "==", "claude").get();
  console.log(`${dry ? "(essai) " : ""}🗑️ ${old.size} dépense(s) ajoutée(s) par Claude remplacée(s)`);
  if (!dry) for (const d of old.docs) await d.ref.delete();
}
for (const d of list) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.du) || !/^\d{4}-\d{2}-\d{2}$/.test(d.au) || !["site", "formulaire"].includes(d.canal) || !(Number(d.montant) >= 0)) {
    console.log("❌ ignorée (format) :", JSON.stringify(d));
    continue;
  }
  const id = `${d.du}_${d.au}_${d.canal}_${String(d.campagne || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
  const n = list.length;
  const doc = { du: d.du, au: d.au, canal: d.canal, campagne: String(d.campagne || ""), montant: Number(d.montant), createdBy: "claude", createdAt: FieldValue.serverTimestamp() };
  if (d.leadsMeta !== undefined) doc.leadsMeta = Number(d.leadsMeta);
  if (n <= 20) console.log(`${dry ? "(essai) " : ""}✅ ${d.du} → ${d.au} | ${d.canal} | ${doc.campagne} | ${doc.montant} €`);
  if (!dry) await db.collection("crm_meta_depenses").doc(id).set(doc);
}
const total = list.reduce((s, d) => s + (Number(d.montant) || 0), 0);
console.log(`${dry ? "(essai) " : ""}Total : ${list.length} ligne(s), ${Math.round(total * 100) / 100} €`);
