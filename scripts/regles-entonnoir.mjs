// Ajoute aux règles Firestore la lecture de site_entonnoir (compteur anonyme du formulaire) par l'équipe ; écriture par le serveur seulement.
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
if (file.content.includes("match /site_entonnoir/")) { console.log("Règle déjà là."); process.exit(0); }
const anchor = file.content.indexOf("    match /crm_leads/");
if (anchor < 0 || !file.content.includes("function isTeam(")) { console.error("Repère introuvable : arrêt sans rien changer."); process.exit(1); }
const BLOCK = `    // Compteur anonyme du formulaire du site : lu par l'équipe, écrit seulement par le serveur.
    match /site_entonnoir/{jour} {
      allow read: if isTeam();
      allow write: if false;
    }

`;
const content = file.content.slice(0, anchor) + BLOCK + file.content.slice(anchor);
console.log("Bloc ajouté :\n" + BLOCK);
const created = await client.request({ url: `${API}/projects/${project}/rulesets`, method: "POST", data: { source: { files: files.map((f) => (f === file ? { ...f, content } : f)) } } });
await client.request({ url: `${API}/projects/${project}/releases/cloud.firestore`, method: "PATCH", data: { release: { name: `projects/${project}/releases/cloud.firestore`, rulesetName: created.data.name } } });
console.log("Règles publiées :", created.data.name);
