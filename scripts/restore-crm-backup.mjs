// Restaure UNE collection (ou un seul document) depuis une sauvegarde.
// Sûr par défaut : DRY_RUN=1 (rien n'est écrit, affiche ce qui serait restauré).
// Ne supprime jamais rien : les documents existants sont seulement complétés / remis à l'état de la sauvegarde.
//
// Variables : DAY (AAAA-MM-JJ), COLLECTION (ex. crm_leads), DOC_ID (facultatif), DRY_RUN (1 par défaut).
import { createRequire } from "node:module";
import { gunzipSync } from "node:zlib";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, GeoPoint } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const BUCKET = "kachoto-7554c.firebasestorage.app";
const DRY_RUN = process.env.DRY_RUN !== "0";
const { DAY, COLLECTION, DOC_ID } = process.env;
if (!DAY || !COLLECTION) {
  console.error("DAY et COLLECTION sont requis");
  process.exit(1);
}
initializeApp({ storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

const dec = (v) => {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === "object") {
    if ("__ts" in v) return Timestamp.fromDate(new Date(v.__ts));
    if ("__geo" in v) return new GeoPoint(v.__geo[0], v.__geo[1]);
    if ("__ref" in v) return db.doc(v.__ref);
    if ("__b64" in v) return Buffer.from(v.__b64, "base64");
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]));
  }
  return v;
};

const file = bucket.file(`backups/${DAY}/${COLLECTION}.jsonl.gz`);
const [buf] = await file.download();
const rows = gunzipSync(buf).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const pick = DOC_ID ? rows.filter((r) => r.id === DOC_ID) : rows;
console.log(`${pick.length} document(s) dans la sauvegarde ${DAY}/${COLLECTION}`);
let n = 0;
for (const r of pick) {
  if (!DRY_RUN) await db.collection(COLLECTION).doc(r.id).set(dec(r.data));
  n++;
}
console.log(DRY_RUN ? `ESSAI À BLANC : ${n} document(s) seraient restaurés` : `${n} document(s) restaurés`);
