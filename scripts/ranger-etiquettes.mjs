// Rangement des étiquettes du tableau principal (crm_boards/leads_columns).
// Ne retire QUE des étiquettes utilisées par 0 fiche (corbeille comprise).
// Deux fusions seulement, validées par Jonas : « En traitement » (ancienne, désactivée) → « En traitement »
// (active) dans Statut appel, et « Dossier complet » → « Docs reçus » dans Étape, avec une trace dans la fiche.
// Essai à blanc par défaut (DRY_RUN != "false" n'écrit rien). L'ancienne configuration est affichée en entier.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const dry = process.env.DRY_RUN !== "false";
const BY = "rangement des étiquettes";

// Étiquettes à retirer : [colonne, clé]
const REMOVE = [
  ["c_sxgefs", "o_fd8gz"], // Étape : « Nouvelle étiquette »
  ["c_sxgefs", "o_tdx5p"], // Étape : « En traitement »
  ["status", "en_cours"], // Statut appel : « En traitement » (ancienne, désactivée) — après fusion
  ["mailAuto", "📎 Demande avis d'imposition"],
  ["mailAuto", "🙏 Remerciement appel"],
  ["mailAuto", "🏠 Explication éligibilité"],
  ["ressenti", "Tres Positif"],
  ["commercial", "Jonas"],
];
// Fusions : [colonne, ancienne clé, nouvelle clé]
const MERGE = [
  ["status", "en_cours", "o_pmbqz"],
  ["c_sxgefs", "o_aiuo9", "e_docs_recu"],
];

const ref = db.doc("crm_boards/leads_columns");
const cfg = (await ref.get()).data()?.config ?? {};
console.log("ANCIENNE CONFIGURATION (pour retour arrière) :");
console.log(JSON.stringify(cfg));

const optsOf = (key) => (cfg.custom ?? []).find((c) => c.key === key)?.options ?? cfg.options?.[key];
const labelOf = (key, k) => optsOf(key)?.find((o) => o.key === k)?.label ?? k;
const titleOf = (key) => (cfg.custom ?? []).find((c) => c.key === key)?.title ?? cfg.titles?.[key] ?? key;
const valueOf = (x, key) => (key === "status" ? x.status : x.fields?.[key]);

const all = (await db.collection("crm_leads").get()).docs; // corbeille comprise
const merges = [];
for (const [col, from, to] of MERGE) {
  if (!optsOf(col)?.some((o) => o.key === to)) throw new Error(`Étiquette cible absente : ${col}/${to}`);
  for (const d of all) {
    const v = valueOf(d.data(), col);
    if (v === from) merges.push({ d, col, from, to });
  }
}
console.log(`\nFUSIONS (${merges.length} fiches) :`);
for (const m of merges) console.log(`- ${m.d.data().name ?? m.d.id} [${m.d.id}]${m.d.data().deletedAt ? " (corbeille)" : ""} : ${titleOf(m.col)} « ${labelOf(m.col, m.from)} » → « ${labelOf(m.col, m.to)} »`);

const merged = new Set(merges.map((m) => `${m.col}/${m.from}`));
const next = JSON.parse(JSON.stringify(cfg));
console.log("\nÉTIQUETTES RETIRÉES :");
for (const [col, k] of REMOVE) {
  const used = all.filter((d) => {
    const v = valueOf(d.data(), col);
    return Array.isArray(v) ? v.includes(k) : v === k;
  }).length;
  const stillUsed = used - (merged.has(`${col}/${k}`) ? merges.filter((m) => m.col === col && m.from === k).length : 0);
  if (stillUsed > 0) { console.log(`- GARDÉE (encore utilisée par ${stillUsed} fiche(s)) : ${titleOf(col)} « ${labelOf(col, k)} »`); continue; }
  const custom = (next.custom ?? []).find((c) => c.key === col);
  if (custom) custom.options = custom.options.filter((o) => o.key !== k);
  else if (next.options?.[col]) next.options[col] = next.options[col].filter((o) => o.key !== k);
  else { console.log(`- introuvable : ${col}/${k}`); continue; }
  console.log(`- ${titleOf(col)} : « ${labelOf(col, k)} »`);
}

// Étapes « En cours chez … » : renomme « Envoyé chez Georges » (0 fiche) et ajoute Praimy après BETS.
const etape = (next.custom ?? []).find((c) => c.key === "c_sxgefs");
const georges = etape.options.find((o) => o.key === "o_2eh90");
const georgesUsed = all.filter((d) => d.data().fields?.c_sxgefs === "o_2eh90").length;
if (georges && !georgesUsed) { georges.label = "En cours chez Georges"; console.log("- Étape : « Envoyé chez Georges » renommée « En cours chez Georges »"); }
if (!etape.options.some((o) => o.key === "e_praimy")) {
  const at = etape.options.findIndex((o) => o.key === "e_bets") + 1;
  etape.options.splice(at, 0, { key: "e_praimy", label: "En cours chez Praimy", hex: "#cab641" });
  if (georges && !georgesUsed) { etape.options = etape.options.filter((o) => o.key !== "o_2eh90"); etape.options.splice(at + 1, 0, georges); }
  console.log("- Étape : ajout de « En cours chez Praimy » (et Georges placé juste après)");
}
console.log("\nFICHES À L'ÉTAPE « En cours » (rien n'est changé) :");
for (const d of all.filter((d) => d.data().fields?.c_sxgefs === "en_cours")) {
  const x = d.data();
  console.log(`- ${x.name ?? d.id} [${d.id}]${x.deletedAt ? " (corbeille)" : ""} | pipeline=${x.fields?.pipeline ?? ""} | poseur=${x.fields?.poseur ?? ""} | praimy=${x.praimyClientId ? "oui" : "non"}`);
}
console.log("Ordre final de l'Étape : " + etape.options.map((o) => o.label).join(" › "));

if (dry) { console.log("\nESSAI À BLANC : rien n'est écrit."); process.exit(0); }

const now = new Date().toISOString();
for (const m of merges) {
  const path = m.col === "status" ? "status" : `fields.${m.col}`;
  await m.d.ref.update({
    [path]: m.to,
    notes: FieldValue.arrayUnion({
      id: Math.random().toString(36).slice(2, 9),
      kind: "statut",
      text: `${titleOf(m.col)} : ${labelOf(m.col, m.from)} → ${labelOf(m.col, m.to)} (rangement des étiquettes)`,
      by: BY,
      at: now,
    }),
  });
}
await ref.set({ config: next, updatedAt: FieldValue.serverTimestamp(), updatedBy: BY }, { merge: true });
console.log(`\nÉCRIT : ${merges.length} fiche(s) fusionnée(s), configuration enregistrée.`);
