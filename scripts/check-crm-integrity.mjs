// Vérification d'intégrité des données et du stockage du CRM (lecture seule, sauf les compteurs).
//  1. chaque document indexé (crm_documents) a bien son fichier dans Storage ;
//  2. chaque fichier de Storage (crm/leads, crm/artisans) est bien dans l'index ;
//  3. chaque document indexé est rattaché à une fiche qui existe ;
//  4. le compteur « Docs » de chaque fiche correspond au nombre réel de documents (corrigé si faux).
// Le résultat est écrit dans crm_boards/integrity (affiché dans la page Documents).
// Sort avec un code d'erreur s'il manque des fichiers (GitHub envoie alors un e-mail).
//
// Variables : GOOGLE_APPLICATION_CREDENTIALS, DRY_RUN (1 = ne corrige / n'écrit rien).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const BUCKET = "kachoto-7554c.firebasestorage.app";
const DRY_RUN = process.env.DRY_RUN === "1";
initializeApp({ storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

const [files] = await bucket.getFiles({ prefix: "crm/" });
const inStorage = new Set(files.map((f) => f.name));
const crmFiles = files.filter((f) => /^crm\/(leads|artisans)\//.test(f.name));
console.log(`${files.length} fichiers dans Storage (${crmFiles.length} rattachés à des fiches).`);

const docs = (await db.collection("crm_documents").get()).docs;
const leadIds = new Set((await db.collection("crm_leads").select().get()).docs.map((d) => d.id));
const artisanIds = new Set((await db.collection("crm_artisans").select().get()).docs.map((d) => d.id));

const indexed = new Set();
const missing = [];
const noOwner = [];
const perLead = new Map();
for (const d of docs) {
  const path = d.get("path");
  indexed.add(path);
  if (!path || !inStorage.has(path)) missing.push({ doc: d.id, name: d.get("name"), path });
  const ownerType = d.get("ownerType");
  const ownerId = d.get("ownerId");
  const exists = ownerType === "artisan" ? artisanIds.has(ownerId) : leadIds.has(ownerId);
  if (!exists) noOwner.push({ doc: d.id, name: d.get("name"), ownerId });
  if (ownerType !== "artisan" && !d.get("deletedAt")) perLead.set(ownerId, (perLead.get(ownerId) ?? 0) + 1);
}
const orphans = crmFiles.filter((f) => !indexed.has(f.name));

// Compteurs « Docs » des fiches.
let fixed = 0;
const leadsSnap = await db.collection("crm_leads").select("docCount").get();
for (const l of leadsSnap.docs) {
  const real = perLead.get(l.id) ?? 0;
  if (Number(l.get("docCount") ?? 0) !== real) {
    fixed++;
    if (!DRY_RUN) await l.ref.update({ docCount: real });
  }
}

const report = {
  at: Timestamp.now(),
  documents: docs.length,
  filesInStorage: crmFiles.length,
  missingFiles: missing.length,
  orphanFiles: orphans.length,
  documentsWithoutOwner: noOwner.length,
  countersFixed: fixed,
  ok: missing.length === 0,
};
console.log(report);
if (missing.length) console.log("FICHIERS MANQUANTS (extrait) :", JSON.stringify(missing.slice(0, 20), null, 1));
if (orphans.length) console.log("Fichiers non indexés (extrait) :", orphans.slice(0, 10).map((f) => f.name));
if (noOwner.length) console.log("Documents sans fiche (extrait) :", JSON.stringify(noOwner.slice(0, 10)));
if (!DRY_RUN) await db.doc("crm_boards/integrity").set({ ...report, missingSample: missing.slice(0, 20), orphanSample: orphans.slice(0, 20).map((f) => f.name) });
process.exit(missing.length ? 2 : 0);
