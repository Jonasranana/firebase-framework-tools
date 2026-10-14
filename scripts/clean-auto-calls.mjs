// Nettoie ce que l'ancien « suivi automatique des appels » avait écrit tout seul dans les fiches :
// historique `calls`, anciennes colonnes 1er/2e/3e appel et nombre d'appels, et la colonne Commercial
// quand elle porte le nom du premier appelant automatique.
// Essai à blanc par défaut (DRY_RUN=1) : n'écrit rien.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const DRY_RUN = process.env.DRY_RUN !== "0";
initializeApp();
const db = getFirestore();
const snap = await db.collection("crm_leads").select("name", "calls", "fields", "updatedBy").get();
const touched = snap.docs.filter((d) => Array.isArray(d.get("calls")) && d.get("calls").length > 0);
console.log(`${touched.length} fiche(s) touchée(s) par l'ancien suivi automatique sur ${snap.size}.`);

let cleaned = 0;
for (const d of touched) {
  const f = d.get("fields") ?? {};
  const calls = d.get("calls");
  const first = String(calls[0]?.name ?? "").split(/\s+/)[0].toLowerCase();
  // L'ancien suivi n'écrivait « Commercial » que si la case était vide : si elle porte le nom du
  // premier appelant, c'est lui qui l'a mis (cas vérifié à l'écran pour l'unique fiche concernée).
  const commercialAuto = f.commercial && String(f.commercial).toLowerCase() === first;
  const monday = d.id.startsWith("monday_");
  console.log(
    `- ${d.get("name") || d.id} | appels=${calls.length} | 1er=${f.premierAppel ?? ""} 2e=${f.deuxiemeAppel ?? ""} 3e=${f.troisiemeAppel ?? ""} | commercial=${f.commercial ?? ""}${commercialAuto ? " (sera vidé)" : monday && f.commercial ? " (conservé)" : ""}`,
  );
  if (DRY_RUN) continue;
  const patch = {
    calls: FieldValue.delete(),
    "fields.premierAppel": FieldValue.delete(),
    "fields.deuxiemeAppel": FieldValue.delete(),
    "fields.troisiemeAppel": FieldValue.delete(),
    "fields.nbAppels": FieldValue.delete(),
  };
  if (commercialAuto) patch["fields.commercial"] = FieldValue.delete();
  await d.ref.update(patch);
  cleaned++;
}
console.log(DRY_RUN ? "ESSAI À BLANC : rien n'a été modifié." : `${cleaned} fiche(s) nettoyée(s).`);
