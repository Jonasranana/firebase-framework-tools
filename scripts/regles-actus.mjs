// Ajoute aux règles Firestore en vigueur l'accès à crm_news (page Actualités
// du CRM) : lecture réservée à Jonas, Alexis, Carole et contact@, écriture
// interdite depuis le site (seul l'outil publier-actu écrit, côté serveur).
// APPLY=true pour publier ; sinon essai à blanc (affiche le bloc ajouté).
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
if (file.content.includes("match /crm_news/")) {
  console.log("La règle crm_news existe déjà : rien à faire.");
  process.exit(0);
}
const BLOCK = `    // Page « Actualités aides » du CRM : famille + contact@ seulement.
    match /crm_news/{day} {
      allow read: if request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email.lower() in [
          "jonassitbon8@gmail.com",
          "alexis.sitbon@gmail.com",
          "carol.sitbon05@gmail.com",
          "contact@ip5energie.com"
        ];
      allow write: if false;
    }

`;
const anchor = file.content.indexOf("    match /ip5_leads/");
if (anchor < 0) {
  console.error("Repère introuvable dans les règles : arrêt sans rien changer.");
  process.exit(1);
}
const content = file.content.slice(0, anchor) + BLOCK + file.content.slice(anchor);
console.log("Bloc ajouté avant « match /ip5_leads » :\n" + BLOCK);
if (String(process.env.APPLY) !== "true") {
  console.log("Essai à blanc : règles inchangées.");
  process.exit(0);
}
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
console.log("Règles publiées :", created.data.name);
