// LECTURE SEULE. Audit de la dernière semaine à partir des sauvegardes quotidiennes (Storage backups/AAAA-MM-JJ/).
// 1. Statuts / groupes qui ont changé d'un jour à l'autre SANS trace d'une personne dans l'historique.
// 2. Statuts retapés sur une fiche qui paraissait vide (étiquette du CRM non reconnue à l'affichage).
// 3. Fiches dont l'étiquette ou le groupe n'existe plus (affichées vides / dans le 1er groupe).
import { createRequire } from "node:module";
import { gunzipSync } from "node:zlib";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
initializeApp({ storageBucket: "kachoto-7554c.firebasestorage.app" });
const db = getFirestore();
const bucket = getStorage().bucket();
const DAYS = Number(process.env.DAYS || 9);

const dec = (v) => (v && typeof v === "object" ? (v.__ts ? v.__ts : Array.isArray(v) ? v.map(dec) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]))) : v);
async function loadBackup(date, name) {
  const f = bucket.file(`backups/${date}/${name}.jsonl.gz`);
  const [ok] = await f.exists();
  if (!ok) return null;
  const [buf] = await f.download();
  const m = new Map();
  for (const line of gunzipSync(buf).toString("utf8").split("\n")) if (line) { const o = JSON.parse(line); m.set(o.id, dec(o.data)); }
  return m;
}

// Étiquettes et groupes actuels.
const cfg = (await db.doc("crm_boards/leads_columns").get()).get("config") ?? {};
const opts = cfg.options?.status ?? [];
const BASE = ["nouveau_lead","a_appeler","rappel_demande","interesse","rdv_pris","vt_faite_bets","en_cours_bets","en_cours","attente_docs","docs_recu","a_relancer","manque_revenu","manque_info","nrp","nrp2","mauvais_numero","pas_interesse","pas_eligible_revenu","pas_eligible_pac","panneau_solaire","proposition_envoyee","me_rappelle","instal_prevu","propal_praimy","complique","pas_adapte","propal_recu","installer_bets","pas_bon","whatsapp_envoye","attente_revenus","vt_praimy","a_rap_carole","vide"];
const known = new Set([...opts.map((o) => o.key), ...(opts.length ? [] : BASE), "vide", ""]);
const label = (k) => opts.find((o) => o.key === k)?.label ?? (k || "vide");
const groups = ((await db.doc("crm_boards/leads").get()).get("groups") ?? []).map((g) => g.id);
const human = (n) => /@/.test(String(n?.by ?? ""));

const now = new Map((await db.collection("crm_leads").get()).docs.map((d) => [d.id, d.data()]));
const dates = [];
for (let i = DAYS; i >= 1; i--) dates.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
const snaps = [];
for (const dt of dates) { const m = await loadBackup(dt, "crm_leads"); if (m) snaps.push({ dt, m }); }
snaps.push({ dt: "maintenant", m: now });
console.log(`Sauvegardes trouvées : ${snaps.slice(0, -1).map((s) => s.dt).join(", ") || "aucune"}`);
console.log(`Étiquettes actuelles du Statut appel : ${opts.length} · groupes Pac Pac : ${groups.length}`);

const sansTrace = [];
for (let i = 1; i < snaps.length; i++) {
  const A = snaps[i - 1], B = snaps[i];
  for (const [id, b] of B.m) {
    const a = A.m.get(id);
    if (!a || (b.board ?? "leads") !== "leads") continue;
    for (const f of ["status", "group"]) {
      if ((a[f] ?? "") === (b[f] ?? "")) continue;
      const since = A.dt === "maintenant" ? "" : A.dt;
      const ns = (b.notes ?? []).filter((n) => String(n?.at ?? "") >= since && n?.kind === "statut");
      const explained = ns.some((n) => human(n)) || ns.some((n) => /Praimy|automation|assistant/i.test(String(n?.by)));
      if (!explained) sansTrace.push({ id, name: b.name, champ: f, de: f === "status" ? label(a[f]) : a[f], vers: f === "status" ? label(b[f]) : b[f], entre: `${A.dt} → ${B.dt}`, par: b.updatedBy });
    }
  }
}
console.log(`\n1) CHANGEMENTS DE STATUT/GROUPE SANS TRACE D'UNE PERSONNE : ${sansTrace.length}`);
const parQui = {};
for (const s of sansTrace) parQui[s.par] = (parQui[s.par] ?? 0) + 1;
console.log("   dernière écriture par :", JSON.stringify(parQui));
for (const s of sansTrace.slice(0, 80)) console.log(`   - ${s.name} | ${s.champ} : ${s.de} → ${s.vers} | ${s.entre} | ${s.par}`);

// 2. Retapés : trace « → X » (départ vide) alors que la fiche avait une étiquette juste avant.
const retapes = [];
const weekAgo = dates[0];
for (const [id, x] of now) {
  const ns = [...(x.notes ?? [])].filter((n) => n?.kind === "statut").sort((p, q) => String(p.at).localeCompare(String(q.at)));
  let prev = "";
  for (const n of ns) {
    const t = String(n.text ?? "");
    const m = /^(.*) → (.*)$/.exec(t);
    if (!m || /^(Groupe|Étape|Attribué|Statut)\b/.test(t) || /:/.test(m[1])) { continue; }
    const from = m[1].trim(), to = m[2].trim();
    if (String(n.at) >= weekAgo && human(n) && (from === "" || from === "vide") && prev && prev !== "vide" && prev !== to) retapes.push({ name: x.name, avant: prev, apres: to, par: n.by, at: n.at });
    prev = to || "vide";
  }
}
console.log(`\n2) STATUTS RETAPÉS SUR UNE FICHE QUI PARAISSAIT VIDE (et changés) : ${retapes.length}`);
for (const r of retapes.slice(0, 80)) console.log(`   - ${r.name} | avant « ${r.avant} » → maintenant « ${r.apres} » | ${r.par} ${r.at}`);

// 3. Orphelins.
const orphS = {}, orphG = {};
let nS = 0, nG = 0;
for (const [, x] of now) {
  if (x.deletedAt || (x.board ?? "leads") !== "leads") continue;
  if (x.status && !known.has(x.status)) { nS++; orphS[x.status] = (orphS[x.status] ?? 0) + 1; }
  if (x.group && groups.length && !groups.includes(x.group)) { nG++; orphG[x.group] = (orphG[x.group] ?? 0) + 1; }
}
console.log(`\n3) FICHES AVEC UNE ÉTIQUETTE QUI N'EXISTE PLUS (affichées vides) : ${nS}`, JSON.stringify(orphS));
console.log(`   FICHES DANS UN GROUPE QUI N'EXISTE PLUS (affichées dans le 1er groupe) : ${nG}`, JSON.stringify(orphG));
