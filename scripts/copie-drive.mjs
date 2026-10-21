// Copie hebdomadaire de la dernière sauvegarde du CRM (Storage backups/AAAA-MM-JJ/) vers un Drive partagé
// (dossier « Sauvegardes CRM IP5 » du compte contact@). Un sous-dossier par jour. Rien n'est jamais supprimé dans Drive.
// Variables : GOOGLE_APPLICATION_CREDENTIALS, DRIVE_FOLDER_ID.
import { createRequire } from "node:module";
import { Readable } from "node:stream";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { google } = require("googleapis");
const FOLDER = process.env.DRIVE_FOLDER_ID;
if (!FOLDER) throw new Error("DRIVE_FOLDER_ID manquant");
initializeApp({ storageBucket: "kachoto-7554c.firebasestorage.app" });
const bucket = getStorage().bucket();
const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/drive"] });
const drive = google.drive({ version: "v3", auth });
const opt = { supportsAllDrives: true };

const [files] = await bucket.getFiles({ prefix: "backups/" });
const days = [...new Set(files.map((f) => /^backups\/(\d{4}-\d{2}-\d{2})\//.exec(f.name)?.[1]).filter(Boolean))].sort();
if (!days.length) throw new Error("Aucune sauvegarde trouvée dans Storage");
const day = days[days.length - 1];
const todo = files.filter((f) => f.name.startsWith(`backups/${day}/`) && !f.name.endsWith("/"));
console.log(`Dernière sauvegarde : ${day} (${todo.length} fichiers)`);

// sous-dossier du jour
const found = await drive.files.list({ q: `'${FOLDER}' in parents and name='${day}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: "files(id)", includeItemsFromAllDrives: true, ...opt });
let dayId = found.data.files?.[0]?.id;
if (!dayId) {
  dayId = (await drive.files.create({ requestBody: { name: day, mimeType: "application/vnd.google-apps.folder", parents: [FOLDER] }, fields: "id", ...opt })).data.id;
}
const existing = await drive.files.list({ q: `'${dayId}' in parents and trashed=false`, fields: "files(name,size)", includeItemsFromAllDrives: true, pageSize: 200, ...opt });
const have = new Map((existing.data.files ?? []).map((f) => [f.name, Number(f.size)]));

let sent = 0, bytes = 0;
for (const f of todo) {
  const name = f.name.split("/").pop();
  const [buf] = await f.download();
  if (have.get(name) === buf.length) { console.log(`déjà là : ${name}`); continue; }
  const res = await drive.files.create({ requestBody: { name, parents: [dayId] }, media: { mimeType: "application/gzip", body: Readable.from(buf) }, fields: "id,size", ...opt });
  if (Number(res.data.size) !== buf.length) throw new Error(`Copie incomplète : ${name} (${res.data.size} au lieu de ${buf.length})`);
  sent++; bytes += buf.length;
  console.log(`copié : ${name} (${Math.round(buf.length / 1024)} ko)`);
}
console.log(`Terminé : ${sent} fichiers copiés (${Math.round(bytes / 1024)} ko), jour ${day}.`);
