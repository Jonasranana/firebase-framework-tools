// Lecture seule : affiche les blocs de règles Firestore utiles (ip5_leads et collections du site).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { google } = require("googleapis");
const project = process.env.GCLOUD_PROJECT;
const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
const API = "https://firebaserules.googleapis.com/v1";
const rel = await client.request({ url: `${API}/projects/${project}/releases/cloud.firestore` });
const rs = await client.request({ url: `${API}/${rel.data.rulesetName}` });
for (const f of rs.data.source.files) {
  for (const m of ["ip5_leads", "site_incomplets", "ip5_partial", "crm_site"]) {
    let i = f.content.indexOf(`match /${m}`);
    while (i >= 0) { const end = f.content.indexOf("\n    }", i); console.log(f.content.slice(i, end + 6)); i = f.content.indexOf(`match /${m}`, i + 1); }
  }
  const fns = f.content.match(/function [a-zA-Z]+\([^)]*\)\s*\{[\s\S]*?\n\s{4}\}/g) ?? [];
  for (const fn of fns) if (/lead|site|valid/i.test(fn)) console.log(fn.slice(0, 1200));
}
