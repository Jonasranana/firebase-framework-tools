// Ponctuel : pose l'étiquette « Déjà appelé » (créée si absente) sur les fiches « À appeler » dont le numéro est dans PHONES.
// Ne touche qu'aux fiches du tableau Pac Pac, hors corbeille, encore « À appeler ». Trace dans l'historique.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const dry = process.env.DRY_RUN !== "false";
const BY = "contact@ip5energie.com";
const LABEL = "Déjà appelé";
const PHONES = ["0684423377", "0233555555", "0756958150", "0622267258", "0565645019", "0671472643", "0771164125", "0609494186", "0612181390"];
const norm = (p) => {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("0033")) d = d.slice(4);
  if (d.startsWith("33") && d.length === 11) d = d.slice(2);
  if (d.length === 9) d = "0" + d;
  return d;
};

const colRef = db.doc("crm_boards/leads_columns");
const cfg = (await colRef.get()).get("config") ?? {};
const opts = cfg.options?.status ?? [];
let opt = opts.find((o) => String(o.label).trim().toLowerCase() === LABEL.toLowerCase());
const fromLabel = opts.find((o) => o.key === "a_appeler")?.label ?? "À appeler";

const snap = await db.collection("crm_leads").where("status", "==", "a_appeler").get();
const hits = new Map(PHONES.map((p) => [p, []]));
for (const d of snap.docs) {
  const x = d.data();
  if (x.deletedAt || (x.board ?? "leads") !== "leads") continue;
  const n = norm(x.phone);
  if (hits.has(n)) hits.get(n).push({ ref: d.ref, name: x.name });
}
let bad = false;
for (const [p, l] of hits) {
  console.log(`${p} : ${l.length ? l.map((x) => x.name).join(", ") : "AUCUNE fiche « À appeler »"}`);
  if (l.length > 1) bad = true;
}
if (bad) { console.log("Plusieurs fiches pour un même numéro : rien n'est modifié."); process.exit(1); }
const todo = [...hits.values()].flat();
console.log(`Fiches à passer en « ${LABEL} » : ${todo.length}. Étiquette ${opt ? "déjà présente" : "à créer"}. Mode : ${dry ? "ESSAI À BLANC" : "ÉCRITURE"}`);
if (dry) process.exit(0);

if (!opt) {
  opt = { key: `o_${Math.random().toString(36).slice(2, 7)}`, label: LABEL, hex: "#9cd326" };
  const vide = opts.findIndex((o) => o.key === "vide");
  const next = [...opts];
  next.splice(vide >= 0 ? vide : next.length, 0, opt);
  await colRef.set({ config: { ...cfg, options: { ...(cfg.options ?? {}), status: next } }, updatedAt: FieldValue.serverTimestamp(), updatedBy: BY }, { merge: true });
  console.log(`Étiquette créée : ${LABEL} (${opt.key})`);
}
for (const t of todo) {
  await t.ref.update({
    status: opt.key,
    statusChangedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: BY,
    notes: FieldValue.arrayUnion({ id: Math.random().toString(36).slice(2, 12), text: `${fromLabel} → ${LABEL}`, by: BY, at: new Date().toISOString(), kind: "statut" }),
  });
  console.log(`✔ ${t.name}`);
}
console.log("Fait.");
