// LECTURE SEULE : statistiques des demandes du site (collection ip5_leads).
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();
const snap = await db.collection("ip5_leads").get();
const all = snap.docs.map((d) => d.data());
const count = (arr, f) => Object.entries(arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const month = (x) => x.createdAt?.toDate?.()?.toISOString().slice(0, 7) ?? "?";
const src = (x) => (x.source || "(vide)").replace(/-rappel$/, " (rappel)");
const apt = all.filter((x) => x.housingType === "Appartement");
console.log(`TOTAL demandes site : ${all.length}`);
console.log(`Premiere : ${all.map((x) => x.createdAt?.toDate?.()).filter(Boolean).sort((a, b) => a - b)[0]?.toISOString()}`);
console.log("Type de logement : " + JSON.stringify(count(all, (x) => x.housingType || "(non demande)")));
console.log("Appartement par source : " + JSON.stringify(count(apt, src)));
console.log("Appartement par mois : " + JSON.stringify(count(apt, month)));
console.log("Total par source : " + JSON.stringify(count(all, src)));
console.log("Total par mois : " + JSON.stringify(count(all, month)));
console.log("Statut proprietaire : " + JSON.stringify(count(all, (x) => x.ownerStatus || "(non demande)")));
console.log("Chauffage : " + JSON.stringify(count(all, (x) => x.currentHeating || "(vide)")));

// Demandes des dernières 24 h dans le CRM (toutes origines), sans données personnelles.
{
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const crm = await db.collection("crm_leads").where("createdAt", ">=", since).get();
  console.log(`CRM : ${crm.size} fiche(s) créée(s) depuis 24 h`);
  for (const d of crm.docs) {
    const x = d.data();
    const t = x.createdAt?.toDate?.()?.toISOString().slice(0, 16) ?? "?";
    console.log(`  ${t} | id ${d.id.slice(0, 12)} | type ${x.type ?? ""} | source ${x.source ?? ""} | details: ${Object.keys(x.details ?? {}).join(", ")}`);
  }
  const site = all.filter((x) => (x.createdAt?.toDate?.() ?? 0) >= since);
  console.log(`SITE (ip5_leads) depuis 24 h : ${site.length} | avec adresse : ${site.filter((x) => x.address).length} | avec DPE : ${site.filter((x) => x.dpe && !String(x.dpe).startsWith("Aucun")).length}`);
}

// Règles Firestore en vigueur pour ip5_leads (lecture seule, pour vérifier les champs autorisés).
try {
  const { google } = require("googleapis");
  const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const project = process.env.GCLOUD_PROJECT;
  const rel = await client.request({ url: `https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore` });
  const rs = await client.request({ url: `https://firebaserules.googleapis.com/v1/${rel.data.rulesetName}` });
  const src = rs.data.source.files.map((f) => f.content).join("\n");
  const i = src.indexOf("ip5_leads");
  console.log("REGLES ip5_leads :\n" + (i >= 0 ? src.slice(Math.max(0, i - 200), i + 1500) : "(non trouvé)"));
} catch (e) {
  console.log("Règles illisibles : " + e.message);
}
