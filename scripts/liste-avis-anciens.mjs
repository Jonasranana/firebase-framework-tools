// Lecture seule : clients déjà installés (avant le 28/11/2026) qui pourraient recevoir la demande d'avis Google.
// N'affiche aucune donnée personnelle : seulement des totaux par mois de pose et par moyen de contact.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const cfg = (await db.doc("crm_boards/leads_columns").get()).data()?.config ?? {};
const noms = {};
const visit = (v) => {
  if (Array.isArray(v)) for (const o of v) { if (o && typeof o === "object" && o.key && o.label) noms[o.key] = o.label; visit(o); }
  else if (v && typeof v === "object") for (const x of Object.values(v)) visit(x);
};
visit(cfg);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const snap = await db.collection("crm_leads").get();
const out = [];
for (const d of snap.docs) {
  const x = d.data();
  if (x.deletedAt || (x.board ?? "leads") !== "leads") continue;
  const installe = x.fields?.pipeline === "Installé" || /^\s*install/i.test(String(noms[x.status] ?? x.status ?? ""));
  if (!installe) continue;
  const pose = String(x.fields?.datePose ?? "").slice(0, 10) || (x.statusChangedAt?.toDate ? x.statusChangedAt.toDate().toISOString().slice(0, 10) : String(x.statusChangedAt ?? "").slice(0, 10));
  if (pose >= "2026-11-28") continue;
  const tel = String(x.phone ?? "").replace(/\D/g, "");
  const portable = /^(33)?0?[67]\d{8}$/.test(tel) || /^0[67]\d{8}$/.test(tel);
  const mail = EMAIL_RE.test(String(x.email ?? "").trim());
  const deja = (x.notes ?? []).some((n) => /avis Google/i.test(String(n?.text ?? "")));
  out.push({ nom: x.name, pose: pose || "?", contact: [portable ? "SMS" : "", mail ? "e-mail" : ""].filter(Boolean).join(" + ") || "aucun", deja, statut: noms[x.status] ?? x.status, pipeline: x.fields?.pipeline ?? "" });
}
out.sort((a, b) => b.pose.localeCompare(a.pose));
console.log(`Clients installés avant le 28/11 : ${out.length}`);
console.log(`- déjà sollicités pour un avis : ${out.filter((o) => o.deja).length}`);
console.log(`- sans portable ni e-mail : ${out.filter((o) => !o.deja && o.contact === "aucun").length}`);
console.log(`- à qui on peut envoyer : ${out.filter((o) => !o.deja && o.contact !== "aucun").length}`);
const parMois = {};
for (const o of out.filter((o) => !o.deja && o.contact !== "aucun")) {
  const k = `${o.pose.slice(0, 7)} · ${o.contact}`;
  parMois[k] = (parMois[k] ?? 0) + 1;
}
console.log("À envoyer, par mois de pose et moyen de contact :");
for (const [k, n] of Object.entries(parMois).sort().reverse()) console.log(`  ${k} : ${n}`);
