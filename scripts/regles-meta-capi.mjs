// Règles Firestore de l'API Conversions Meta :
//  - crm_meta_capi_config/{id} : jeton et réglages, lecture/écriture Jonas seulement ;
//  - crm_meta_capi_log/{id} : journal des envois, lecture Jonas seulement (écrit par le serveur).
// Vérifie d'abord qu'aucune règle générale (/{document=**} ou /{collection}/{id}) n'ouvre ces collections à d'autres.
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
const larges = file.content.split("\n").filter((l) => /match\s+\/\{[^}]+\}/.test(l) || /\{document=\*\*\}/.test(l));
console.log("Règles générales trouvées :", larges.length ? larges.map((l) => l.trim()) : "aucune");
if (larges.some((l) => !/match \/databases\/\{database\}\/documents/.test(l))) {
  console.error("Une règle générale pourrait ouvrir le jeton à d'autres : arrêt sans rien changer.");
  process.exit(1);
}
if (file.content.includes("match /crm_meta_capi_config/")) {
  console.log("Règles déjà présentes : rien à faire.");
  process.exit(0);
}
const JONAS = `request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email.lower() == "jonassitbon8@gmail.com"`;
const BLOCK = `    // API Conversions Meta : jeton et journal, Jonas seulement (le serveur écrit le journal).
    match /crm_meta_capi_config/{id} {
      allow read, write: if ${JONAS};
    }
    match /crm_meta_capi_log/{id} {
      allow read: if ${JONAS};
    }

`;
const anchor = file.content.indexOf("    match /ip5_leads/");
if (anchor < 0) {
  console.error("Repère introuvable : arrêt sans rien changer.");
  process.exit(1);
}
const content = file.content.slice(0, anchor) + BLOCK + file.content.slice(anchor);
const created = await client.request({
  url: `${API}/projects/${project}/rulesets`,
  method: "POST",
  data: { source: { files: files.map((f) => (f === file ? { ...f, content } : f)) } },
});
await client.request({
  url: `${API}/projects/${project}/releases/cloud.firestore`,
  method: "PATCH",
  data: { release: { name: `projects/${project}/releases/cloud.firestore`, rulesetName: created.data.name } },
});
console.log("Règles publiées :", created.data.name, "\n" + BLOCK);
