// Dépose le point du jour de la veille « Actualités aides » dans Firestore
// crm_news/{AAAA-MM-JJ} (page Actualités du CRM, réservée à la famille).
// Entrée : ACTU_B64 = JSON encodé en base64 :
//   { date, title, summary, nothingNew, items: [{ category, title, summary,
//     impact, sourceName, url, publishedAt, importance }] }
// N'écrit que dans crm_news. DRY_RUN=true : affiche sans écrire.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const raw = Buffer.from(String(process.env.ACTU_B64 ?? "").trim(), "base64").toString("utf8");
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("JSON illisible :", e.message);
  process.exit(1);
}
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const date = str(data.date, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("Date invalide (attendu AAAA-MM-JJ) :", data.date);
  process.exit(1);
}
const CATS = ["MaPrimeRénov'", "CEE", "Pompe à chaleur", "Réglementation", "Marché"];
const items = (Array.isArray(data.items) ? data.items : []).slice(0, 15).map((it) => ({
  category: CATS.includes(it.category) ? it.category : "Marché",
  title: str(it.title, 200),
  summary: str(it.summary, 1200),
  impact: str(it.impact, 600),
  sourceName: str(it.sourceName, 120),
  url: /^https?:\/\//.test(String(it.url ?? "")) ? str(it.url, 500) : "",
  publishedAt: str(it.publishedAt, 40),
  importance: it.importance === "haute" ? "haute" : "normale",
})).filter((it) => it.title);
const doc = {
  date,
  title: str(data.title, 200),
  summary: str(data.summary, 1500),
  nothingNew: !!data.nothingNew && items.length === 0,
  items,
};
console.log(JSON.stringify(doc, null, 2));
if (String(process.env.DRY_RUN) === "true") {
  console.log("Essai à blanc : rien n'est écrit.");
  process.exit(0);
}
initializeApp();
await getFirestore().doc(`crm_news/${date}`).set({ ...doc, createdAt: FieldValue.serverTimestamp() });
console.log(`Publié : crm_news/${date} (${items.length} actualité(s))`);
