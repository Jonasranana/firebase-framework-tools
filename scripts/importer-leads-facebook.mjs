// Importe dans le CRM des prospects du formulaire Facebook copiés depuis le
// fichier Meta (Formulaires instantanés → Télécharger), quand le branchement
// automatique ne les a pas transmis. Crée la fiche (crm_leads/fb_<id Meta>,
// même format que les prospects Facebook automatiques, anti-doublon par
// téléphone) et envoie l'alerte mail interne à contact@.
// Entrée : LEADS_B64 = JSON [{ id, created_time, full_name, phone_number,
//   email, post_code, platform, form_name, campaign_name, reponses: {…} }]
// DRY_RUN=true (par défaut) : affiche sans rien écrire ni envoyer.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { google } = require("googleapis");

const dry = String(process.env.DRY_RUN ?? "true") !== "false";
const leads = JSON.parse(Buffer.from(String(process.env.LEADS_B64 ?? ""), "base64").toString("utf8"));
initializeApp();
const db = getFirestore();
const clean = (v) => String(v ?? "").replace(/^[a-z]{1,2}:/, "").trim();
const phoneKeyOf = (raw) => {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("33") && d.length === 11) d = "0" + d.slice(2);
  return d;
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const joli = (s) => String(s ?? "").replace(/_/g, " ");

let gmail = null;
if (!dry) {
  const o = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  o.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  gmail = google.gmail({ version: "v1", auth: o });
}

for (const l of leads) {
  const id = clean(l.id);
  const phone = clean(l.phone_number);
  const phoneKey = phoneKeyOf(phone);
  const name = String(l.full_name ?? "").trim() || "Lead Facebook";
  const details = { "Formulaire Meta": String(l.form_name ?? ""), Campagne: String(l.campaign_name ?? ""), Plateforme: l.platform === "ig" ? "Instagram" : "Facebook" };
  for (const [k, v] of Object.entries(l.reponses ?? {})) details[k] = joli(v);
  const doc = {
    name, phone, phoneKey, email: String(l.email ?? "").trim().toLowerCase(), postalCode: clean(l.post_code), city: "",
    type: "PAC", source: "formulaire-facebook", projet: "Pompe à chaleur", status: "nouveau_lead", group: "nouveaux", rappelLe: "",
    details, notes: [],
    createdAt: l.created_time ? Timestamp.fromDate(new Date(l.created_time)) : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(), updatedBy: "",
  };
  const dup = phoneKey ? await db.collection("crm_leads").where("phoneKey", "==", phoneKey).limit(1).get() : { empty: true };
  console.log(`${name} | ${phone} | ${doc.postalCode} | ${JSON.stringify(details)}${dup.empty ? "" : " | DÉJÀ DANS LE CRM : ignoré"}`);
  if (dry || !dup.empty) continue;
  await db.doc(`crm_leads/fb_${id}`).create(doc);
  const rows = [["Nom", name], ["Téléphone", phone], ["Code postal", doc.postalCode], ...Object.entries(details)];
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#122f4d">📘 Nouveau prospect – formulaire Facebook</h2><table style="border-collapse:collapse;width:100%">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666">${esc(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:bold">${esc(v)}</td></tr>`)
    .join("")}</table><p style="color:#666;font-size:13px">Fiche créée dans le CRM (groupe Nouveaux leads).</p></div>`;
  const to = process.env.GMAIL_SENDER_EMAIL;
  const raw = Buffer.from(
    [`To: ${to}`, `From: ${to}`, `Subject: =?UTF-8?B?${Buffer.from(`📘 Lead Formulaire Facebook — ${name}`).toString("base64")}?=`, "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8", "", html].join("\r\n"),
  ).toString("base64url");
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  console.log(`  → fiche crm_leads/fb_${id} créée, alerte envoyée à contact@`);
}
console.log(dry ? "Essai à blanc : rien n'est écrit ni envoyé." : "Terminé.");
