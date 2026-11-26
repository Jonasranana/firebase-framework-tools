// Lecture seule : où les visiteurs du formulaire /pac s'arrêtent (demandes incomplètes site_<visite>).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const snap = await db.collection("crm_leads").get();
const depuis = Date.now() - 60 * 864e5;
const etapes = {}; let incomplets = 0, finisEnsuite = 0, complets = 0; const champs = {}; const appareils = {};
for (const d of snap.docs) {
  const x = d.data(); const t = x.createdAt?.toMillis?.() ?? 0; if (t < depuis) continue;
  if (d.id.startsWith("site_")) {
    if (x.deletedBy === "demande complétée") { finisEnsuite++; continue; }
    incomplets++;
    const p = x.details?.Progression || "?"; etapes[p] = (etapes[p] || 0) + 1;
    for (const k of Object.keys(x.details || {})) champs[k] = (champs[k] || 0) + 1;
  } else if (/landing-pac-meta|simulateur-landing/.test(x.source || "") && !x.deletedAt) complets++;
}
console.log(`60 derniers jours : demandes complètes (site) ${complets} · incomplètes restées incomplètes ${incomplets} · incomplètes finies ensuite ${finisEnsuite}`);
console.log("Arrêt par étape :", JSON.stringify(Object.entries(etapes).sort()));
console.log("Infos présentes dans les incomplètes :", JSON.stringify(champs));
const rs = await db.collection("ip5_leads").orderBy("createdAt", "desc").limit(60).get();
const cles = {}; let n = 0;
for (const d of rs.docs) { n++; for (const [k, v] of Object.entries(d.data())) if (v !== "" && v != null) cles[k] = (cles[k] || 0) + 1; }
console.log(`Champs remplis dans les ${n} dernières demandes complètes :`, JSON.stringify(cles));
