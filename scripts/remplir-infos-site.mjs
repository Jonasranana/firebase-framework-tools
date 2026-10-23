// Remplit dans le CRM les colonnes Tranche / Foyer (Site) / Chauffage (Site) / Surface des fiches venues du site
// quand elles sont vides, à partir de la demande d'origine (ip5_leads, même identifiant).
// Ne remplace jamais une valeur déjà présente. Essai à blanc par défaut (DRY_RUN != "false" n'écrit rien).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const dry = process.env.DRY_RUN !== "false";
const BY = "remplissage infos site";
// « Date 1er contact » et « Type de demande » : seulement pour les demandes arrivées depuis cette date
// (les fiches plus anciennes les ont déjà, ou n'en ont volontairement pas).
const SINCE = process.env.SINCE || "2026-10-19";
const parisDate = (ts) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(ts?.toDate ? ts.toDate() : new Date(ts));
const typeDemande = (f) => {
  const source = String(f.source ?? "");
  if (f.requestType) return "📞 Rappel demandé";
  if (source.startsWith("reactivation")) return "✉️ Réactivation";
  if (source.includes("gonflage")) return "";
  return "🧮 Simulation";
};
initializeApp();
const db = getFirestore();

const MAP = { tranche: "incomeBracket", foyerSite: "householdSize", chauffageSite: "currentHeating", surface: "surface" };
const src = await db.collection("ip5_leads").get();
const bilan = { demandes: src.size, sansFiche: 0, corbeille: 0, completes: 0, aCompleter: 0, sansInfo: 0 };
const todo = [];
for (const d of src.docs) {
  const f = d.data();
  const ref = db.doc(`crm_leads/${d.id}`);
  const snap = await ref.get();
  if (!snap.exists) { bilan.sansFiche++; continue; }
  const x = snap.data();
  if (x.deletedAt) { bilan.corbeille++; continue; }
  const patch = {};
  for (const [col, key] of Object.entries(MAP)) {
    const v = String(f[key] ?? "").trim();
    if (v && !String(x.fields?.[col] ?? "").trim()) patch[`fields.${col}`] = v;
  }
  const created = f.createdAt?.toDate ? f.createdAt.toDate() : null;
  if (created && parisDate(created) >= SINCE) {
    const pc = parisDate(created);
    const td = typeDemande(f);
    if (!String(x.fields?.premierContact ?? "").trim()) patch["fields.premierContact"] = pc;
    if (td && !String(x.fields?.typeDemande ?? "").trim()) patch["fields.typeDemande"] = td;
  }
  if (!Object.keys(patch).length) {
    if ([...Object.keys(MAP), "premierContact", "typeDemande"].some((c) => String(x.fields?.[c] ?? "").trim())) bilan.completes++;
    else bilan.sansInfo++;
    continue;
  }
  bilan.aCompleter++;
  todo.push({ ref, patch, name: x.name, at: x.createdAt?.toMillis?.() ?? 0 });
}
console.log("Bilan :", JSON.stringify(bilan));
todo.sort((a, b) => b.at - a.at);
for (const t of todo.slice(0, 60)) console.log(`- ${t.name} | ${new Date(t.at).toISOString().slice(0, 10)} | ${Object.entries(t.patch).map(([k, v]) => `${k.slice(7)}=${v}`).join(", ")}`);
if (todo.length > 60) console.log(`… et ${todo.length - 60} autres`);
console.log(dry ? "ESSAI À BLANC : rien n'est écrit." : "ÉCRITURE…");
if (!dry) {
  const w = db.bulkWriter();
  for (const t of todo) w.update(t.ref, { ...t.patch, updatedBy: BY, updatedAt: Timestamp.now() });
  await w.close();
  console.log(`${todo.length} fiches complétées.`);
}
