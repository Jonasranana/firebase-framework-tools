// Règle Firestore crm_activite (activité de l'équipe) : chaque membre écrit seulement SA propre activité ; seul Jonas la lit.
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
if (file.content.includes("match /crm_activite/")) { console.log("Règle déjà là."); process.exit(0); }
const anchor = file.content.indexOf("    match /crm_leads/");
if (anchor < 0 || !file.content.includes("function isTeam(")) { console.error("Repère introuvable : arrêt sans rien changer."); process.exit(1); }
const BLOCK = `    // Activité de l'équipe : chacun écrit seulement sa propre ligne ; seul Jonas la lit.
    match /crm_activite/{id} {
      allow read: if request.auth != null && request.auth.token.email_verified == true
        && request.auth.token.email.lower() == "jonassitbon8@gmail.com";
      allow create, update: if isTeam()
        && request.resource.data.email == request.auth.token.email.lower();
    }

`;
const content = file.content.slice(0, anchor) + BLOCK + file.content.slice(anchor);
console.log("Bloc ajouté :\n" + BLOCK);
const created = await client.request({ url: `${API}/projects/${project}/rulesets`, method: "POST", data: { source: { files: files.map((f) => (f === file ? { ...f, content } : f)) } } });
await client.request({ url: `${API}/projects/${project}/releases/cloud.firestore`, method: "PATCH", data: { release: { name: `projects/${project}/releases/cloud.firestore`, rulesetName: created.data.name } } });
console.log("Règles publiées :", created.data.name);
