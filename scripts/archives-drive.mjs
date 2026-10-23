// Fiches « exportées vers Drive » (menu du groupe) : l'export télécharge un CSV et met les fiches à la corbeille.
// Liste ces fiches (lecture seule) ; avec RESTORE=true, les sort de la corbeille (et peut les ranger dans un groupe).
//   FILTER   : texte cherché dans le nom (facultatif ; sinon toutes les fiches archivées vers Drive depuis SINCE)
//   SINCE    : AAAA-MM-JJ (par défaut aujourd'hui, heure de Paris)
//   GROUP    : identifiant du groupe où ranger les fiches restaurées (facultatif)
//   RESTORE  : "true" pour écrire (sinon essai à blanc)
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const paris = (d) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const SINCE = process.env.SINCE || paris(new Date());
const FILTER = (process.env.FILTER || "").trim().toLowerCase();
const GROUP = (process.env.GROUP || "").trim();
const restore = process.env.RESTORE === "true";
const BY = "contact@ip5energie.com";
initializeApp();
const db = getFirestore();

const board = await db.doc("crm_boards/leads").get();
const titles = Object.fromEntries((board.get("groups") ?? []).map((g) => [g.id, g.title]));
const snap = await db.collection("crm_leads").where("archivedToDrive", "==", true).get();
const rows = [];
const parBy = {};
for (const d of snap.docs) {
  const x = d.data();
  const at = x.deletedAt?.toDate?.();
  if (!at || paris(at) < SINCE) continue;
  if (FILTER && !String(x.name ?? "").toLowerCase().includes(FILTER)) continue;
  parBy[x.deletedBy ?? "?"] = (parBy[x.deletedBy ?? "?"] ?? 0) + 1;
  rows.push({ id: d.id, name: x.name, group: x.group, by: x.deletedBy, at, corbeille: !!x.deletedAt });
}
console.log(`Fiches archivées vers Drive depuis ${SINCE}${FILTER ? ` (nom contenant « ${FILTER} »)` : ""} : ${rows.length}`);
console.log("Par dossier :", JSON.stringify(parBy));
for (const r of rows.slice(0, 80)) console.log(`- ${r.name} | ancien groupe : ${titles[r.group] ?? r.group} | ${r.by} | ${r.at.toISOString().slice(0, 16)}`);
if (rows.length > 80) console.log(`… et ${rows.length - 80} autres`);
if (GROUP) console.log(`Groupe de destination : « ${titles[GROUP] ?? GROUP} »`);
console.log(restore ? "ÉCRITURE : restauration…" : "ESSAI À BLANC : rien n'est écrit.");
if (restore) {
  const w = db.bulkWriter();
  for (const r of rows) {
    const patch = {
      deletedAt: FieldValue.delete(),
      deletedBy: FieldValue.delete(),
      archivedToDrive: FieldValue.delete(),
      updatedAt: Timestamp.now(),
      updatedBy: BY,
      notes: FieldValue.arrayUnion({ id: Math.random().toString(36).slice(2, 12), text: GROUP ? `Fiche restaurée de la corbeille et rangée dans « ${titles[GROUP] ?? GROUP} ».` : "Fiche restaurée de la corbeille.", by: BY, at: new Date().toISOString(), kind: "statut" }),
    };
    if (GROUP) patch.group = GROUP;
    w.update(db.doc(`crm_leads/${r.id}`), patch);
  }
  await w.close();
  console.log(`${rows.length} fiches restaurées.`);
}
