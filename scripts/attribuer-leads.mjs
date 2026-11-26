// Attribue N fiches Pac Pac « jamais appelées » (sans étiquette de statut) à une personne : colonne « Attribué à ».
// Ne touche ni au statut ni au groupe. Essai à blanc par défaut (DRY_RUN != "false" n'écrit rien).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const N = Number(process.env.COUNT || 50);
const WHO = process.env.WHO || "Mebarek";
const BY = process.env.BY || "contact@ip5energie.com";
const STATUT = process.env.STATUT || "a_appeler";
const GROUPE = process.env.GROUPE || "contacts";
const dry = process.env.DRY_RUN !== "false";
initializeApp();
const db = getFirestore();

const snap = await db.collection("crm_leads").get();
const ok = [];
const f = { total: 0, autreTableau: 0, corbeille: 0, avecStatut: 0, dejaAttribuee: 0, sansTel: 0, avecHistorique: 0 };
const statuts = {};
const kinds = {};
for (const d of snap.docs) {
  const x = d.data();
  f.total++;
  if ((x.board ?? "leads") !== "leads") { f.autreTableau++; continue; }
  if (x.deletedAt) { f.corbeille++; continue; }
  statuts[x.status || "(absent)"] = (statuts[x.status || "(absent)"] ?? 0) + 1;
  if ((x.status || "vide") !== STATUT) { f.avecStatut++; continue; }
  if ((x.group || "") !== GROUPE) { f.autreGroupe = (f.autreGroupe ?? 0) + 1; continue; }
  if (x.fields?.attribue) { f.dejaAttribuee++; continue; }
  const hist = (x.notes ?? []).filter((n) => ["message", "mail"].includes(n?.kind));
  for (const n of x.notes ?? []) kinds[n?.kind ?? "?"] = (kinds[n?.kind ?? "?"] ?? 0) + 1;
  ok.push({ id: d.id, deja: x.fields?.attribue || "", name: x.name, phone: x.phone, group: x.group, at: x.createdAt?.toMillis?.() ?? 0 });
}
console.log("Entonnoir :", JSON.stringify(f));
console.log("Statuts (tableau Pac Pac actif) :", JSON.stringify(statuts));
console.log("Types de notes des fiches sans statut :", JSON.stringify(kinds));
ok.sort((a, b) => b.at - a.at);
const pick = ok.slice(0, N);
console.log(`Fiches jamais appelées et non attribuées : ${ok.length}. Retenues (les plus récentes) : ${pick.length}. Mode : ${dry ? "ESSAI À BLANC" : "ÉCRITURE"}`);
for (const p of pick) console.log(`- ${p.name} | ${p.phone} | groupe ${p.group}${p.deja ? ` | DÉJÀ attribuée à ${p.deja}` : ""} | ${new Date(p.at).toISOString().slice(0, 10)}`);
if (!dry) {
  const w = db.bulkWriter();
  for (const p of pick) {
    w.update(db.doc(`crm_leads/${p.id}`), {
      "fields.attribue": WHO,
      notes: FieldValue.arrayUnion({ id: Math.random().toString(36).slice(2, 12), text: `Attribué à : → ${WHO}`, by: BY, at: new Date().toISOString(), kind: "statut" }),
      updatedAt: Timestamp.now(),
      updatedBy: BY,
    });
  }
  await w.close();
  console.log(`${pick.length} fiches attribuées à ${WHO}.`);
}
