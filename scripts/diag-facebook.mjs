// Lecture seule : la Page Facebook est-elle encore reliée au CRM, et combien de leads le formulaire a-t-il reçus ?
// Les jetons ne sont jamais affichés.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { google } = require("googleapis");
const project = process.env.GCLOUD_PROJECT;
const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
const s = await client.request({ url: `https://secretmanager.googleapis.com/v1/projects/${project}/secrets/META_PAGE_TOKEN/versions/latest:access` });
const tok = Buffer.from(s.data.payload.data, "base64").toString("utf8").trim();
const G = "https://graph.facebook.com/v21.0";
const g = async (p, t = tok) => (await fetch(`${G}/${p}${p.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(t)}`)).json();
const dbg = await g("debug_token?input_token=" + encodeURIComponent(tok));
console.log("Droits du jeton :", JSON.stringify(dbg.data?.scopes), "app:", dbg.data?.application, dbg.data?.app_id);
const acc = await g("me/accounts?fields=id,name,access_token&limit=20");
if (acc.error) console.log("Pages : erreur", acc.error.message);
for (const p of acc.data ?? []) {
  console.log(`\nPage « ${p.name} » (${p.id})`);
  const subs = await g(`${p.id}/subscribed_apps`, p.access_token);
  console.log("  Applis abonnées :", JSON.stringify(subs.error?.message ?? (subs.data ?? []).map((a) => `${a.name} [${(a.subscribed_fields ?? []).join(",")}]`)));
  const forms = await g(`${p.id}/leadgen_forms?fields=id,name,status,leads_count,created_time&limit=50`, p.access_token);
  if (forms.error) { console.log("  Formulaires : erreur", forms.error.message); continue; }
  for (const f of forms.data ?? []) {
    const l = await g(`${f.id}/leads?fields=created_time&limit=200`, p.access_token);
    const parJour = {}; for (const x of l.data ?? []) { const d = x.created_time.slice(0, 10); if (d >= "2026-10-25") parJour[d] = (parJour[d] || 0) + 1; }
    console.log(`  Formulaire « ${f.name} » ${f.status} total ${f.leads_count} · depuis le 25/10 :`, JSON.stringify(l.error?.message ?? parJour));
  }
}
