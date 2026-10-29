// Range dans leur groupe les fiches « Pas éligible », « Mauvais numéro » et « NRP » (demandé par Jonas).
// Ne change QUE le groupe (statut, notes, attribution intacts) et ajoute une trace « Groupe : A → B ».
// Essai à blanc par défaut (DRY_RUN != "false" n'écrit rien).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const dry = process.env.DRY_RUN !== "false";
const BY = "contact@ip5energie.com";

const groups = (await db.doc("crm_boards/leads").get()).get("groups") ?? [];
console.log("Groupes du tableau : " + groups.map((g) => `${g.title} [${g.id}]${g.archived ? " (archivé)" : ""}`).join(" · "));
const title = (id) => groups.find((g) => g.id === id)?.title ?? id ?? "(aucun)";
const find = (re) => groups.find((g) => !g.archived && re.test(g.title))?.id;
const TARGET = {
  pas_eligible_pac: find(/[ée]ligible/i),
  pas_eligible_revenu: find(/[ée]ligible/i),
  mauvais_numero: find(/[ée]ligible/i), // choix de Jonas : avec les « Pas éligibles »
  pas_interesse: find(/[ée]ligible/i), // demandé par Jonas : avec les « Pas éligibles »
  pas_adapte: find(/[ée]ligible/i),
  o_ef1qw: find(/[ée]ligible/i), // « Ne donne pas suite »
  nrp: find(/^nrp\b/i),
  nrp2: find(/^nrp\b/i),
};
console.log("Cibles : " + Object.entries(TARGET).map(([s, g]) => `${s} → ${g ? title(g) : "AUCUN GROUPE TROUVÉ"}`).join(" · "));

const snap = await db.collection("crm_leads").get();
const moves = [];
const stats = {};
for (const d of snap.docs) {
  const x = d.data();
  if (x.deletedAt || (x.board ?? "leads") !== "leads") continue;
  const to = TARGET[x.status];
  if (!to || x.group === to) continue;
  moves.push({ ref: d.ref, from: x.group, to, status: x.status, who: x.fields?.attribue ?? "" });
  const k = `${x.status} : ${title(x.group)} → ${title(to)}`;
  stats[k] = (stats[k] ?? 0) + 1;
}
console.log(`\nÀ déplacer : ${moves.length}`);
for (const [k, n] of Object.entries(stats).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
const byWho = {};
for (const m of moves) byWho[m.who || "(personne)"] = (byWho[m.who || "(personne)"] ?? 0) + 1;
console.log("Par « Attribué à » : " + JSON.stringify(byWho));
if (dry) { console.log("ESSAI À BLANC : rien n'est écrit."); process.exit(0); }

const w = db.bulkWriter();
const at = new Date().toISOString();
for (const m of moves) {
  w.update(m.ref, {
    group: m.to,
    notes: FieldValue.arrayUnion({ id: Math.random().toString(36).slice(2, 12), text: `Groupe : ${title(m.from)} → ${title(m.to)}`, by: BY, at, kind: "statut" }),
    updatedAt: Timestamp.now(),
    updatedBy: BY,
  });
}
await w.close();
console.log(`ÉCRIT : ${moves.length} fiches rangées.`);
