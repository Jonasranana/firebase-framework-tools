// LECTURE SEULE : leads oubliés pendant la panne de facturation Google (fonctions arrêtées).
// 1) Demandes du site (ip5_leads) depuis DEPUIS sans fiche CRM correspondante (crm_leads/<même id>).
// 2) Prospects Meta (formulaires instantanés) depuis DEPUIS absents du CRM (crm_leads/fb_<id>).
// 3) Fiches CRM créées par jour, par source (pour dater la panne).
// N'écrit rien, n'envoie rien. (période réglable)
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
// Version courte : seulement les statuts utilisés et l'emplacement des noms d'étiquettes (compteurs, sans nom de client).
// Statuts utilisés (clé → nombre de fiches, nom si connu) et où sont rangés les noms des étiquettes. Sans nom de client.
{
  const docs = (await db.collection("crm_boards").get()).docs;
  const labels = {};
  const where = {};
  const walk = (v, path, docId) => { if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, docId)); else if (v && typeof v === "object") { const k = v.key ?? v.id; const t = v.label ?? v.title ?? v.name; if (typeof k === "string" && typeof t === "string") { labels[k] = t; where[k] = `${docId}${path}`.slice(0, 80); } for (const [kk, vv] of Object.entries(v)) walk(vv, `${path}.${kk}`, docId); } };
  // Le tableau en service (leads_columns) en dernier : ses noms d'étiquettes passent devant ceux des sauvegardes.
  for (const d of [...docs].sort((a, b) => (a.id === "leads_columns") - (b.id === "leads_columns"))) walk(d.data(), "", d.id);
  const t = (await db.collection("crm_leads").select("status", "deletedAt").get()).docs.map((d) => d.data()).filter((x) => !x.deletedAt);
  const c = {};
  for (const x of t) c[x.status ?? "(vide)"] = (c[x.status ?? "(vide)"] ?? 0) + 1;
  console.log(`\n=== Statuts utilisés (${t.length} fiches) ===`);
  for (const [k, n] of Object.entries(c).sort((a, b) => b[1] - a[1])) console.log(`  ${n} × ${k} = ${labels[k] ?? "(nom inconnu)"} ${where[k] ? `[${where[k]}]` : ""}`);
}
