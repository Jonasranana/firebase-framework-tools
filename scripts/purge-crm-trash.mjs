// Vide la corbeille du CRM : supprime pour de bon les fiches mises à la
// corbeille (crm_leads.deletedAt) depuis plus de 30 jours, avec leurs
// documents (index crm_documents + fichiers Storage). Lancé chaque jour par
// .github/workflows/purge-crm-trash.yml. DRY_RUN=1 : affiche sans supprimer.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const BUCKET = "kachoto-7554c.firebasestorage.app";
const DRY_RUN = process.env.DRY_RUN === "1";
const DAYS = 30;
initializeApp({ storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

const cutoff = new Date(Date.now() - DAYS * 86400000);
const snap = await db.collection("crm_leads").where("deletedAt", "<", cutoff).get();
console.log(`${snap.size} fiche(s) à la corbeille depuis plus de ${DAYS} jours.`);

for (const d of snap.docs) {
  const docs = await db.collection("crm_documents").where("ownerId", "==", d.id).get();
  // Les documents rattachés à une autre fiche (après fusion) ne sont jamais touchés : on filtre sur ownerId.
  console.log(`- ${d.get("name") || d.id} : ${docs.size} document(s)`);
  if (DRY_RUN) continue;
  for (const x of docs.docs) {
    const path = x.get("path");
    if (path) await bucket.file(path).delete({ ignoreNotFound: true }).catch((e) => console.error("Storage :", e.message));
    await x.ref.delete();
  }
  await d.ref.delete();
}
// Documents mis à la corbeille depuis plus de 30 jours : fichier + index.
const dsnap = await db.collection("crm_documents").where("deletedAt", "<", cutoff).get();
console.log(`${dsnap.size} document(s) à la corbeille depuis plus de ${DAYS} jours.`);
for (const x of dsnap.docs) {
  console.log(`- document ${x.get("name") || x.id}`);
  if (DRY_RUN) continue;
  const path = x.get("path");
  if (path) await bucket.file(path).delete({ ignoreNotFound: true }).catch((e) => console.error("Storage :", e.message));
  await x.ref.delete();
}
console.log(DRY_RUN ? "Essai à blanc : rien supprimé." : "Corbeille vidée.");
