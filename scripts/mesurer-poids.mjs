// Lecture seule : poids des fiches crm_leads (total, par champ, plus lourdes).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const snap = await getFirestore().collection("crm_leads").get();
const parChamp = {}; let total = 0; const lourdes = []; let nbNotes = 0;
for (const d of snap.docs) {
  const x = d.data(); const t = JSON.stringify(x).length; total += t; lourdes.push([t, x.name]);
  nbNotes += (x.notes ?? []).length;
  for (const [k, v] of Object.entries(x)) parChamp[k] = (parChamp[k] ?? 0) + JSON.stringify(v ?? null).length;
}
const ko = (n) => `${Math.round(n / 1024)} Ko`;
console.log(`Fiches : ${snap.size} · poids total ≈ ${ko(total)} · moyenne ${Math.round(total / snap.size)} o · notes : ${nbNotes}`);
console.log("Par champ :", Object.entries(parChamp).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}=${ko(v)}`).join(" · "));
console.log("Plus lourdes :", lourdes.sort((a, b) => b[0] - a[0]).slice(0, 8).map(([t, n]) => `${n} ${ko(t)}`).join(" · "));
