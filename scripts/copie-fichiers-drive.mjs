// Copie dans le Drive partagé « Sauvegardes CRM IP5 » tous les fichiers joints aux fiches (Storage crm/leads et crm/artisans),
// rangés par client : « Fichiers clients / <Nom du client> [id] / <Nom du client> - <Catégorie> - <fichier> ».
// Incrémental : un fichier déjà copié (même nom, même taille) est ignoré. Rien n'est jamais supprimé dans Drive.
// Variables : GOOGLE_APPLICATION_CREDENTIALS, DRIVE_FOLDER_ID.
import { createRequire } from "node:module";
import { Readable } from "node:stream";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { google } = require("googleapis");
const ROOT = process.env.DRIVE_FOLDER_ID;
if (!ROOT) throw new Error("DRIVE_FOLDER_ID manquant");
initializeApp({ storageBucket: "kachoto-7554c.firebasestorage.app" });
const db = getFirestore();
const bucket = getStorage().bucket();
const drive = google.drive({ version: "v3", auth: new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/drive"] }) });
const opt = { supportsAllDrives: true, includeItemsFromAllDrives: true };
const safe = (s) => String(s ?? "").replace(/[\\/:*?"<>|\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Sans nom";
const FOLDER_MIME = "application/vnd.google-apps.folder";

async function listAll(q, fields) {
  const out = [];
  let pageToken;
  do {
    const r = await drive.files.list({ q, fields: `nextPageToken, files(${fields})`, pageSize: 1000, pageToken, ...opt });
    out.push(...(r.data.files ?? []));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return out;
}
async function ensureFolder(parent, name) {
  const found = await listAll(`'${parent}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`, "id");
  if (found[0]) return found[0].id;
  return (await drive.files.create({ requestBody: { name, mimeType: FOLDER_MIME, parents: [parent] }, fields: "id", supportsAllDrives: true })).data.id;
}

// Fichiers Storage + index
const [files] = await bucket.getFiles({ prefix: "crm/" });
const mine = files.filter((f) => /^crm\/(leads|artisans)\/[^/]+\/.+[^/]$/.test(f.name));
const index = new Map((await db.collection("crm_documents").get()).docs.map((d) => [d.get("path"), d.data()]));
const names = new Map();
for (const [col, kind] of [["crm_leads", "leads"], ["crm_artisans", "artisans"]]) {
  for (const d of (await db.collection(col).select("name").get()).docs) names.set(`${kind}/${d.id}`, d.get("name"));
}
console.log(`${mine.length} fichiers de fiches dans Storage`);

const base = await ensureFolder(ROOT, "Fichiers clients");
const folders = new Map();
for (const f of await listAll(`'${base}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`, "id,name")) folders.set(f.name, f.id);

let copied = 0, skipped = 0, bytes = 0, failed = 0;
for (const f of mine) {
  const m = /^crm\/(leads|artisans)\/([^/]+)\/(.+)$/.exec(f.name);
  const [, kind, id, rest] = m;
  const doc = index.get(f.name);
  if (doc?.deletedAt) { skipped++; continue; } // en corbeille : pas copié
  const client = safe(names.get(`${kind}/${id}`) ?? "Fiche supprimée");
  const folderName = `${kind === "artisans" ? "Artisan - " : ""}${client} [${id.slice(-6)}]`;
  let fid = folders.get(folderName);
  if (!fid) { fid = await ensureFolder(base, folderName); folders.set(folderName, fid); }
  const orig = doc?.name ?? rest.split("/").pop();
  const cat = doc?.category ? ` - ${safe(doc.category)}` : "";
  const target = `${client}${cat} - ${orig}`.slice(0, 200);
  const [meta] = await f.getMetadata();
  const size = Number(meta.size);
  const existing = await listAll(`'${fid}' in parents and name='${target.replace(/'/g, "\\'")}' and trashed=false`, "id,size");
  if (existing.some((e) => Number(e.size) === size)) { skipped++; continue; }
  try {
    const [buf] = await f.download();
    const res = await drive.files.create({ requestBody: { name: target, parents: [fid] }, media: { mimeType: meta.contentType || "application/octet-stream", body: Readable.from(buf) }, fields: "id,size", supportsAllDrives: true });
    if (Number(res.data.size) !== buf.length) throw new Error(`taille différente (${res.data.size} / ${buf.length})`);
    copied++; bytes += buf.length;
    console.log(`copié : ${client} / ${target} (${Math.round(buf.length / 1024)} ko)`);
  } catch (e) {
    failed++;
    console.error(`ÉCHEC : ${target} : ${e.message}`);
  }
}
console.log(`Terminé : ${copied} copiés (${Math.round(bytes / 1024)} ko), ${skipped} déjà là ou en corbeille, ${failed} échecs.`);
if (failed) process.exit(1);
