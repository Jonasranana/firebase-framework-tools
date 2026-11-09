// Ponctuel : dans un groupe du tableau Pac Pac, pose « Déjà appelé » sur les fiches « À appeler » ou sans statut
// dont le numéro figure dans le rapport d'appels Onoff. Le rapport n'est pas copié ici : seulement une empreinte
// (sha256 tronqué) de chaque numéro, format 0XXXXXXXXX. Les autres statuts ne sont jamais touchés.
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const dry = process.env.DRY_RUN !== "false";
const GROUP = process.env.GROUP || "contacts";
const FROM = (process.env.FROM || "vide,a_appeler").split(",");
const BY = "contact@ip5energie.com";
const LABEL = "Déjà appelé";
const hashes = new Set(readFileSync(new URL(`./data/${process.env.HASH_FILE}`, import.meta.url), "utf8").split("\n").map((s) => s.trim()).filter(Boolean));
const norm = (p) => {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("0033")) d = d.slice(4);
  if (d.startsWith("33") && d.length === 11) d = d.slice(2);
  if (d.length === 9) d = "0" + d;
  return d.length === 10 ? d : "";
};
const h = (n) => createHash("sha256").update(n).digest("hex").slice(0, 16);

const cfg = (await db.doc("crm_boards/leads_columns").get()).get("config") ?? {};
const opts = cfg.options?.status ?? [];
const opt = opts.find((o) => String(o.label).trim().toLowerCase() === LABEL.toLowerCase());
if (!opt) throw new Error(`Étiquette « ${LABEL} » introuvable`);
const labelOf = (k) => (!k || k === "vide" ? "" : opts.find((o) => o.key === k)?.label ?? k);

const snap = await db.collection("crm_leads").where("group", "==", GROUP).get();
const stats = { total: 0, corbeille: 0, autreTableau: 0, autreStatut: 0, sansNumero: 0, jamaisAppele: 0, aMarquer: 0 };
const parStatut = {};
const todo = [];
for (const d of snap.docs) {
  const x = d.data();
  if ((x.board ?? "leads") !== "leads") { stats.autreTableau++; continue; }
  if (x.deletedAt) { stats.corbeille++; continue; }
  stats.total++;
  const st = x.status || "vide";
  const n = norm(x.phone);
  const called = n && hashes.has(h(n));
  if (called) parStatut[labelOf(st) || "(sans statut)"] = (parStatut[labelOf(st) || "(sans statut)"] ?? 0) + 1;
  if (!FROM.includes(st)) { stats.autreStatut++; continue; }
  if (!n) { stats.sansNumero++; continue; }
  if (!called) { stats.jamaisAppele++; continue; }
  stats.aMarquer++;
  todo.push({ ref: d.ref, name: x.name, from: st });
}
console.log(`Groupe « ${GROUP} » (fiches actives) : ${stats.total}`);
console.log("Détail :", JSON.stringify(stats));
console.log("Fiches du groupe déjà appelées, par statut actuel :", JSON.stringify(parStatut));
console.log(`À passer en « ${LABEL} » : ${todo.length}. Mode : ${dry ? "ESSAI À BLANC" : "ÉCRITURE"}`);
for (const t of todo) console.log(` - ${t.name} (${labelOf(t.from) || "sans statut"})`);
if (dry) process.exit(0);
const w = db.bulkWriter();
for (const t of todo) {
  w.update(t.ref, {
    status: opt.key,
    statusChangedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: BY,
    notes: FieldValue.arrayUnion({ id: Math.random().toString(36).slice(2, 12), text: `${labelOf(t.from)} → ${LABEL}`, by: BY, at: new Date().toISOString(), kind: "statut" }),
  });
}
await w.close();
console.log(`Fait : ${todo.length} fiches passées en « ${LABEL} ».`);
