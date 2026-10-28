// LECTURE SEULE : liste, pour chaque colonne à étiquettes du tableau principal, les étiquettes,
// combien de fiches (hors corbeille) les utilisent, les doublons de nom, et les valeurs sans étiquette.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
const cfg = (await db.doc("crm_boards/leads_columns").get()).data()?.config ?? {};
const cols = [];
for (const c of cfg.custom ?? []) if (c.options?.length) cols.push({ key: c.key, title: c.title, options: c.options, archived: !!c.archived || !!c.hidden });
for (const [key, options] of Object.entries(cfg.options ?? {})) if (options?.length) cols.push({ key, title: cfg.titles?.[key] ?? key, options });
const leads = (await db.collection("crm_leads").get()).docs.map((d) => d.data()).filter((x) => !x.deletedAt);
console.log(`Fiches hors corbeille : ${leads.length}. Colonnes à étiquettes : ${cols.length}. Clés de config : ${Object.keys(cfg).join(", ")}`);
for (const c of cols) {
  const count = new Map();
  for (const l of leads) {
    const v = l.fields?.[c.key] ?? l[c.key];
    if (v === undefined || v === null || v === "") continue;
    for (const one of Array.isArray(v) ? v : [v]) count.set(String(one), (count.get(String(one)) ?? 0) + 1);
  }
  console.log(`\n=== ${c.title} (${c.key})${c.archived ? " [colonne masquée/archivée]" : ""} ===`);
  const byNorm = new Map();
  for (const o of c.options) {
    const n = count.get(o.key) ?? 0;
    console.log(`  ${n.toString().padStart(5)}  ${o.label || "(sans nom)"}${o.off ? " [désactivée]" : ""}  [clé ${o.key}]`);
    const k = norm(o.label);
    byNorm.set(k, [...(byNorm.get(k) ?? []), o.label]);
  }
  for (const [, labels] of byNorm) if (labels.length > 1) console.log(`  ⚠️ DOUBLON : ${labels.join(" | ")}`);
  const known = new Set(c.options.map((o) => o.key));
  const orphans = [...count].filter(([k]) => !known.has(k));
  if (orphans.length) console.log(`  ⚠️ Valeurs sans étiquette : ${orphans.map(([k, n]) => `${k} (${n})`).join(", ")}`);
}
