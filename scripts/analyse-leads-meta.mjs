// Lecture seule : qualité des leads venus des pubs Meta (aucune donnée personnelle affichée).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();

const cfg = (await db.doc("crm_boards/leads_columns").get()).data()?.config ?? {};
const labels = {};
for (const [k, v] of Object.entries(cfg)) {
  if (Array.isArray(v)) for (const o of v) if (o && typeof o === "object" && o.key && o.label) labels[o.key] = o.label;
  if (v && typeof v === "object" && !Array.isArray(v)) for (const vv of Object.values(v)) if (Array.isArray(vv)) for (const o of vv) if (o && o.key && o.label) labels[o.key] = o.label;
}
const lab = (k) => labels[k] ?? k;
const signe = (k) => k === "o_yt99h" || /^sign/i.test(String(lab(k)).trim());
const MAUVAIS = /pas_interesse|pas_eligible|mauvais_numero|pas_bon|pas_adapte|panneau|locataire/i;
const NRP = /^nrp/;
const AVANCE = /interesse|rdv|propal|proposition|docs|vt|en_cours|instal|attente|manque|praimy|bets/;

const snap = await db.collection("crm_leads").get();
const metaSrc = /^(landing-pac-meta|simulateur-landing|formulaire-facebook)/;
const leads = [];
snap.forEach((d) => {
  const x = d.data();
  if (x.deletedAt || (x.board || "leads") !== "leads") return;
  const src = String(x.source || "");
  const meta = metaSrc.test(src) || (/^site \(incomplet\)/i.test(src) && !/whatsapp|reactivation/i.test(src));
  if (!meta) return;
  const c = x.createdAt?.toDate ? x.createdAt.toDate() : new Date(x.createdAt);
  leads.push({ src, c, st: String(x.status || ""), cp: String(x.postalCode || x.fields?.cp || "").slice(0, 2), f: x.fields || {}, notes: x.notes || [], appels: Number(x.fields?.appels || 0) });
});
console.log(`Leads Meta dans le CRM : ${leads.length}`);

const lundi = (d) => { const t = new Date(d); t.setUTCHours(0, 0, 0, 0); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
const bloc = (titre, cle) => {
  const g = {};
  for (const l of leads) {
    const k = cle(l); if (k === null) continue;
    const e = (g[k] = g[k] || { n: 0, sign: 0, avance: 0, mauvais: 0, nrp: 0, neuf: 0, incomplet: 0, fb: 0 });
    e.n++;
    if (signe(l.st)) e.sign++; else if (MAUVAIS.test(l.st)) e.mauvais++; else if (NRP.test(l.st)) e.nrp++; else if (l.st === "nouveau_lead" || l.st === "a_appeler" || !l.st) e.neuf++; else if (AVANCE.test(l.st) || l.st.startsWith("o_")) e.avance++;
    if (/incomplet/i.test(l.src)) e.incomplet++;
    if (/formulaire-facebook/.test(l.src)) e.fb++;
  }
  console.log(`\n== ${titre} ==  (n | signés | avancent | pas bons | NRP | pas encore traités | dont incomplets | dont form. FB)`);
  for (const [k, e] of Object.entries(g).sort()) console.log(`${k.padEnd(22)} ${String(e.n).padStart(4)} | ${e.sign} | ${e.avance} | ${e.mauvais} | ${e.nrp} | ${e.neuf} | ${e.incomplet} | ${e.fb}`);
};
bloc("Par semaine (création)", (l) => lundi(l.c));
bloc("Par source", (l) => l.src.replace(/:.*$/, "").slice(0, 22));
bloc("Par département (≥3 leads)", (l) => l.cp || "?");
bloc("Par annonce (utm)", (l) => (l.f.pubAnnonce ? String(l.f.pubAnnonce).slice(0, 22) : null));
bloc("Par heure de demande", (l) => String(new Date(l.c.getTime() + 3600e3).getUTCHours()).padStart(2, "0") + "h");
bloc("Par chauffage actuel", (l) => String(l.f.chauffage || l.f.currentHeating || "?").slice(0, 22));
bloc("Par revenus", (l) => String(l.f.revenus || l.f.tranche || "?").slice(0, 22));

// Statuts détaillés
const st = {};
for (const l of leads) st[lab(l.st) || "(vide)"] = (st[lab(l.st) || "(vide)"] || 0) + 1;
console.log("\n== Statuts ==");
for (const [k, n] of Object.entries(st).sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${k}`);

// Délai avant le premier contact noté (note d'un membre de l'équipe)
const delais = [];
for (const l of leads) {
  const t = l.notes.filter((n) => /@/.test(n.by || "")).map((n) => Date.parse(n.at)).filter((t) => t > l.c.getTime()).sort()[0];
  if (t) delais.push((t - l.c.getTime()) / 3600e3);
}
delais.sort((a, b) => a - b);
const q = (p) => delais[Math.floor(delais.length * p)]?.toFixed(1);
console.log(`\nDélai avant la 1re action de l'équipe (heures) : ${delais.length} leads · médiane ${q(0.5)} h · 75 % sous ${q(0.75)} h · 90 % sous ${q(0.9)} h`);
console.log(`Leads jamais touchés par l'équipe : ${leads.length - delais.length}`);

// Entonnoir du formulaire du site, par semaine
const ent = await db.collection("site_entonnoir").get();
const ew = {};
ent.forEach((d) => {
  const w = lundi(new Date(`${d.id}T12:00:00Z`));
  for (const [src, c] of Object.entries(d.data())) {
    if (src.startsWith("reactivation") || src.startsWith("whatsapp")) continue;
    const e = (ew[w] = ew[w] || {});
    for (const [k, n] of Object.entries(c || {})) e[k] = (e[k] || 0) + (Number(n) || 0);
  }
});
console.log("\n== Entonnoir du formulaire (visiteurs par étape) ==");
for (const [w, e] of Object.entries(ew).sort()) console.log(w, JSON.stringify(e));
