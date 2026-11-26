// Ajoute aux règles Firestore la collection crm_perf (chronomètre invisible du CRM) :
// création seulement, par les mêmes personnes que crm_leads ; pas de lecture côté appli.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { google } = require("googleapis");
const project = process.env.GCLOUD_PROJECT;
const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
const API = "https://firebaserules.googleapis.com/v1";
const rel = await client.request({ url: `${API}/projects/${project}/releases/cloud.firestore` });
const rs = await client.request({ url: `${API}/${rel.data.rulesetName}` });
const files = rs.data.source.files;
const file = files.find((f) => f.content.includes("match /databases/")) ?? files[0];
if (file.content.includes("match /crm_perf/")) { console.log("Règle crm_perf déjà là."); process.exit(0); }
const i = file.content.indexOf("match /crm_leads/");
if (i < 0) { console.error("Bloc crm_leads introuvable : arrêt."); process.exit(1); }
const bloc = file.content.slice(i, file.content.indexOf("\n    }", i) + 6);
console.log("Bloc crm_leads actuel :\n" + bloc);
const m = bloc.match(/allow\s+read,\s*write\s*:\s*if\s+([\s\S]*?);/) || bloc.match(/allow\s+read\s*:\s*if\s+([\s\S]*?);/);
if (!m) { console.error("Condition introuvable : arrêt sans rien changer."); process.exit(1); }
const BLOCK = `    // Chronomètre invisible du CRM : chaque membre peut seulement ajouter ses mesures.
    match /crm_perf/{id} {
      allow create: if ${m[1].trim()};
    }

`;
const anchor = file.content.lastIndexOf("    match /crm_leads/");
const content = file.content.slice(0, anchor) + BLOCK + file.content.slice(anchor);
console.log("Bloc ajouté :\n" + BLOCK);
if (String(process.env.APPLY) !== "true") { console.log("Essai à blanc."); process.exit(0); }
const created = await client.request({ url: `${API}/projects/${project}/rulesets`, method: "POST", data: { source: { files: files.map((f) => (f === file ? { ...f, content } : f)) } } });
await client.request({ url: `${API}/projects/${project}/releases/cloud.firestore`, method: "PATCH", data: { release: { name: `projects/${project}/releases/cloud.firestore`, rulesetName: created.data.name } } });
console.log("Règles publiées :", created.data.name);
