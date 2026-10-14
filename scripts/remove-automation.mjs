// Retire une automatisation du CRM (crm_automations) dont le nom est exactement NAME.
// Utilisé quand Alexis demande de retirer une règle (ex. la règle de test).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const NAME = process.env.NAME;
if (!NAME) throw new Error("NAME requis");
initializeApp();
const db = getFirestore();
const snap = await db.collection("crm_automations").where("name", "==", NAME).get();
console.log(`${snap.size} automatisation(s) nommée(s) « ${NAME} »`);
for (const d of snap.docs) {
  await d.ref.delete();
  console.log(`supprimée : ${d.id}`);
}
