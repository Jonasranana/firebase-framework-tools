// Sauvegarde quotidienne des données du CRM : chaque collection importante est copiée
// dans Firebase Storage sous backups/AAAA-MM-JJ/<collection>.jsonl (une ligne = un document).
// Jamais lisible depuis le navigateur (règles Storage), seulement par le compte de service.
// Conserve 30 jours de sauvegardes. Les archives Monday (monday_*) sont sauvegardées le 1er et le 15.
// Restauration : scripts/restore-crm-backup.mjs.
//
// Variables : GOOGLE_APPLICATION_CREDENTIALS, DRY_RUN (1 = compte seulement).
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, GeoPoint, DocumentReference } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const BUCKET = "kachoto-7554c.firebasestorage.app";
const DRY_RUN = process.env.DRY_RUN === "1";
const KEEP_DAYS = 30;
initializeApp({ storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

const today = new Date().toISOString().slice(0, 10);
const day = new Date().getUTCDate();
const COLLECTIONS = ["crm_leads", "crm_artisans", "crm_documents", "crm_boards", "crm_team", "crm_profiles", "crm_automations", "crm_clients", "crm_mail_state"];
if (day === 1 || day === 15 || process.env.WITH_MONDAY === "1") COLLECTIONS.push("monday_boards", "monday_items", "monday_updates", "monday_meta");

// Valeurs Firestore → JSON réversible.
const enc = (v) => {
  if (v instanceof Timestamp) return { __ts: v.toDate().toISOString() };
  if (v instanceof GeoPoint) return { __geo: [v.latitude, v.longitude] };
  if (v instanceof DocumentReference) return { __ref: v.path };
  if (Buffer.isBuffer(v)) return { __b64: v.toString("base64") };
  if (Array.isArray(v)) return v.map(enc);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]));
  return v;
};

let total = 0;
for (const name of COLLECTIONS) {
  const lines = [];
  const snap = await db.collection(name).get();
  for (const d of snap.docs) lines.push(JSON.stringify({ id: d.id, data: enc(d.data()) }));
  total += snap.size;
  console.log(`${name}: ${snap.size} documents`);
  if (DRY_RUN || !snap.size) continue;
  const buf = gzipSync(Buffer.from(lines.join("\n")));
  await bucket.file(`backups/${today}/${name}.jsonl.gz`).save(buf, { contentType: "application/gzip" });
  // Relecture : la sauvegarde doit exister et avoir la bonne taille.
  const [meta] = await bucket.file(`backups/${today}/${name}.jsonl.gz`).getMetadata();
  if (Number(meta.size) !== buf.length) throw new Error(`Sauvegarde incomplète : ${name}`);
}

// Nettoyage : supprime les sauvegardes de plus de 30 jours.
if (!DRY_RUN) {
  const [files] = await bucket.getFiles({ prefix: "backups/" });
  const limit = Date.now() - KEEP_DAYS * 86400000;
  let removed = 0;
  for (const f of files) {
    const m = /^backups\/(\d{4}-\d{2}-\d{2})\//.exec(f.name);
    if (m && Date.parse(m[1]) < limit) {
      await f.delete({ ignoreNotFound: true });
      removed++;
    }
  }
  await db.doc("crm_boards/backup_status").set({ lastBackup: Timestamp.now(), day: today, documents: total, collections: COLLECTIONS.length, removedOld: removed });
}
console.log(DRY_RUN ? `Essai à blanc : ${total} documents` : `Sauvegarde ${today} terminée : ${total} documents`);
