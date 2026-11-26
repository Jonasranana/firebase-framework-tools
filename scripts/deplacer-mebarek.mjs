// Déplace dans « Nouveaux leads » les fiches attribuées à Mebarek le 26/11/2026 (groupe Contacts).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const snap = await db.collection("crm_leads").where("fields.attribue", "==", "Mebarek").get();
const w = db.bulkWriter(); let n = 0;
for (const d of snap.docs) {
  const x = d.data();
  if ((x.board ?? "leads") !== "leads" || x.group !== "contacts") continue;
  if (!(x.notes ?? []).some((k) => k?.text === "Attribué à : → Mebarek" && String(k?.at).startsWith("2026-11-26"))) continue;
  w.update(d.ref, { group: "nouveaux", updatedAt: Timestamp.now(), updatedBy: "contact@ip5energie.com" }); n++;
}
await w.close();
console.log(`${n} fiches déplacées dans Nouveaux leads.`);
