// Fusionne la colonne « Commercial » dans la colonne « Appels » : pour chaque fiche qui a un
// commercial et pas encore de 1er appel, le commercial devient le « 1er appel ». Le 2e et le 3e
// appel restent vides. Rien n'est supprimé : la colonne Commercial garde ses valeurs.
// Essai à blanc par défaut (DRY_RUN=1) : compte seulement.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const DRY_RUN = process.env.DRY_RUN !== "0";
initializeApp();
const db = getFirestore();
const snap = await db.collection("crm_leads").select("fields").get();
const count = {};
let todo = 0;
let skipped = 0;
let batch = db.batch();
let inBatch = 0;
for (const d of snap.docs) {
  const f = d.get("fields") ?? {};
  const c = String(f.commercial ?? "").trim();
  if (!c) continue;
  count[c] = (count[c] ?? 0) + 1;
  if (f.premierAppel) {
    skipped++;
    continue;
  }
  todo++;
  if (DRY_RUN) continue;
  batch.update(d.ref, { "fields.premierAppel": c });
  if (++inBatch >= 400) {
    await batch.commit();
    batch = db.batch();
    inBatch = 0;
  }
}
if (!DRY_RUN && inBatch) await batch.commit();
console.log("Commerciaux trouvés :", count);
console.log(`${todo} fiche(s) ${DRY_RUN ? "à remplir" : "remplies"} en « 1er appel » ; ${skipped} déjà remplie(s).`);
console.log(DRY_RUN ? "ESSAI À BLANC : rien n'a été modifié." : "Fusion terminée.");
