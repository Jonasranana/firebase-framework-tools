// Déplace dans un groupe les fiches que l'outil « Attribuer des leads » vient d'attribuer (repérées par leur trace
// « Attribué à : → <personne> » posée depuis SINCE). Ne change ni le statut ni l'attribution. Essai à blanc par défaut.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const WHO = process.env.WHO || "Mebarek";
const SINCE = process.env.SINCE || "2026-10-20T07:14:00Z";
const TO = process.env.TO_GROUP || "nouveaux";
const BY = process.env.BY || "contact@ip5energie.com";
const dry = process.env.DRY_RUN !== "false";
initializeApp();
const db = getFirestore();

const board = await db.doc("crm_boards/leads").get();
const titles = Object.fromEntries((board.get("groups") ?? []).map((g) => [g.id, g.title]));
const title = (id) => titles[id] ?? ({ nouveaux: "📥 Nouveaux leads", contacts: "0/ Contacts" }[id] ?? id);

const snap = await db.collection("crm_leads").where("fields.attribue", "==", WHO).get();
const pick = [];
for (const d of snap.docs) {
  const x = d.data();
  if (x.deletedAt || (x.board ?? "leads") !== "leads") continue;
  const marked = (x.notes ?? []).some((n) => n?.text === `Attribué à : → ${WHO}` && n?.by === BY && String(n?.at ?? "") >= SINCE);
  if (!marked) continue;
  pick.push({ id: d.id, name: x.name, from: x.group });
}
console.log(`Fiches attribuées à ${WHO} depuis ${SINCE} : ${pick.length}. Déplacement vers « ${title(TO)} ». Mode : ${dry ? "ESSAI À BLANC" : "ÉCRITURE"}`);
for (const p of pick) console.log(`- ${p.name} | ${title(p.from)} → ${title(TO)}`);
if (!dry) {
  const w = db.bulkWriter();
  for (const p of pick) {
    if (p.from === TO) continue;
    w.update(db.doc(`crm_leads/${p.id}`), {
      group: TO,
      notes: FieldValue.arrayUnion({ id: Math.random().toString(36).slice(2, 12), text: `Groupe : ${title(p.from)} → ${title(TO)}`, by: BY, at: new Date().toISOString(), kind: "statut" }),
      updatedAt: Timestamp.now(),
      updatedBy: BY,
    });
  }
  await w.close();
  console.log(`${pick.length} fiches déplacées vers « ${title(TO)} ».`);
}
