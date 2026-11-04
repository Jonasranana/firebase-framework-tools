// Supprime UNE fiche de test du CRM (ex. prospect créé par l'outil de test
// Meta). Réservé aux fiches « fb_… » ; DRY_RUN=true par défaut : affiche
// seulement la fiche visée.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const id = String(process.env.FICHE_ID ?? "").trim();
const dry = String(process.env.DRY_RUN ?? "true") !== "false";
if (!/^fb_\d+$/.test(id)) throw new Error("Seules les fiches fb_<numéro> peuvent être supprimées avec cet outil.");
const ref = getFirestore().doc(`crm_leads/${id}`);
const snap = await ref.get();
if (!snap.exists) {
  console.log(`Fiche ${id} introuvable (déjà supprimée ?).`);
  process.exit(0);
}
const d = snap.data();
console.log(`Fiche ${id} : nom « ${d.name} », source ${d.source}, créée ${d.createdAt?.toDate?.().toISOString()}, ${(d.notes ?? []).length} note(s)`);
if (dry) console.log("Essai à blanc : rien n'est supprimé.");
else {
  await ref.delete();
  console.log("→ supprimée.");
}
