// LECTURE SEULE : liste les Google Sheets d'export du CRM (dossier partagé « Sauvegardes CRM IP5 ») et leur taille.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { google } = require("googleapis");
const ROOT = "0AAbbtoyad7dUUk9PVA";

const base = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const sm = google.secretmanager({ version: "v1", auth: base });
const sec = await sm.projects.secrets.versions.access({ name: "projects/kachoto-7554c/secrets/DRIVE_SA_KEY/versions/latest" });
const key = JSON.parse(Buffer.from(sec.data.payload.data, "base64").toString("utf8"));
const auth = new google.auth.GoogleAuth({ credentials: key, scopes: ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/spreadsheets.readonly"] });
const drive = google.drive({ version: "v3", auth });
const sheets = google.sheets({ version: "v4", auth });
const opt = { supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: "drive", driveId: ROOT };
const list = await drive.files.list({ q: "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'Tableau_' and trashed=false", fields: "files(id,name,parents,modifiedTime)", pageSize: 100, ...opt });
for (const f of list.data.files ?? []) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: f.id, fields: "sheets(properties(title,gridProperties))" });
  const props = meta.data.sheets.map((s) => `${s.properties.title} (${s.properties.gridProperties.rowCount} lignes)`).join(", ");
  const head = await sheets.spreadsheets.values.get({ spreadsheetId: f.id, range: "A1:M3" });
  console.log(`- ${f.name} [${f.id}] modifié ${f.modifiedTime} | ${props}`);
  console.log("  en-têtes : " + JSON.stringify(head.data.values?.[0] ?? []));
  console.log("  ligne 2 : " + JSON.stringify((head.data.values?.[1] ?? []).map((v) => String(v).slice(0, 60))));
}
