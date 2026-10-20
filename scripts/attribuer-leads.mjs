// Attribue N fiches Pac Pac « jamais appelées » (sans étiquette de statut) à une personne : colonne « Attribué à ».
// Ne touche ni au statut ni au groupe. Essai à blanc par défaut (DRY_RUN != "false" n'écrit rien).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const N = Number(process.env.COUNT || 50);
const WHO = process.env.WHO || "Mebarek";
const BY = process.env.BY || "contact@ip5energie.com";
const dry = process.env.DRY_RUN !== "false";
initializeApp();
const db = getFirestore();

const snap = await db.collection("crm_leads").get();
const ok = [];
for (const d of snap.docs) {
  const x = d.data();
  if ((x.board ?? "leads") !== "leads") continue;
  if (x.deletedAt) continue;
  if (x.status && x.status !== "vide") continue;
  if (x.fields?.attribue) continue;
  if (!String(x.phone ?? "").replace(/\D/g, "")) continue;
  if ((x.notes ?? []).some((n) => ["statut", "message", "mail"].includes(n?.kind))) continue;
  ok.push({ id: d.id, name: x.name, phone: x.phone, group: x.group, at: x.createdAt?.toMillis?.() ?? 0 });
}
ok.sort((a, b) => b.at - a.at);
const pick = ok.slice(0, N);
console.log(`Fiches jamais appelées et non attribuées : ${ok.length}. Retenues (les plus récentes) : ${pick.length}. Mode : ${dry ? "ESSAI À BLANC" : "ÉCRITURE"}`);
for (const p of pick) console.log(`- ${p.name} | ${p.phone} | groupe ${p.group} | ${new Date(p.at).toISOString().slice(0, 10)}`);
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
