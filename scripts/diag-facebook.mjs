// Lecture seule : détail des appels reçus par metaLeadWebhook (le jeton n'est jamais affiché).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { google } = require("googleapis");
const project = process.env.GCLOUD_PROJECT;
const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
const since = new Date(Date.now() - 21 * 864e5).toISOString();
const r = await client.request({ url: "https://logging.googleapis.com/v2/entries:list", method: "POST", data: {
  resourceNames: [`projects/${project}`], pageSize: 300, orderBy: "timestamp desc",
  filter: `timestamp>="${since}" AND (resource.labels.service_name="metaleadwebhook" OR resource.labels.function_name="metaLeadWebhook")` } });
for (const x of r.data.entries ?? []) {
  const h = x.httpRequest ? `HTTP ${x.httpRequest.requestMethod} ${x.httpRequest.status} ${x.httpRequest.latency ?? ""}` : "";
  const t = (x.textPayload || (x.jsonPayload ? JSON.stringify(x.jsonPayload) : "") || "").replace(/access_token=[^&\s"]+/g, "access_token=***").slice(0, 260);
  console.log(x.timestamp.slice(0, 19), x.severity, h, t);
}
// Fiches Facebook dans le CRM (les 15 dernières)
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const s = await getFirestore().collection("crm_leads").where("source", "==", "formulaire-facebook").get();
const l = s.docs.map((d) => [d.id, d.get("createdAt")?.toDate?.()?.toISOString?.() ?? "?"]).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 15);
console.log("Fiches Facebook CRM :", s.size, JSON.stringify(l));
