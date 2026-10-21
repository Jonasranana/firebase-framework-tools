// Envoie un petit e-mail en français simple sur le résultat d'une tâche automatique (sauvegarde, copie Drive…).
// Variables : NOM (sauvegarde-nuit | copie-drive), STATUT (success | failure), RUN_URL,
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL, DESTINATAIRE.
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { google } = require("googleapis");
const { NOM, STATUT, RUN_URL = "", DESTINATAIRE = "jonassitbon8@gmail.com" } = process.env;
const ok = STATUT === "success";
const MSG = {
  "sauvegarde-nuit": {
    ok: null, // pas de mail chaque nuit quand tout va bien
    ko: {
      sujet: "⚠️ La sauvegarde de cette nuit a échoué",
      titre: "La sauvegarde automatique de cette nuit n'a pas marché.",
      quoi: "Chaque nuit, le CRM fait une copie de toutes vos données. Cette nuit, la copie ou sa vérification a eu un problème.",
      rassure: "Vos données sont toujours là, rien n'est perdu. La sauvegarde de la veille existe encore, et la récupération à la minute près (7 jours) de Firebase aussi.",
      faire: "Rien d'urgent. Dites-le simplement à Claude (« la sauvegarde a échoué ») et il regardera la cause. Si ça arrive deux nuits de suite, demandez-lui de le faire tout de suite.",
    },
  },
  "copie-drive": {
    ok: {
      sujet: "✅ Copie de sauvegarde sur Google Drive faite",
      titre: "La copie hebdomadaire de vos données sur Google Drive est faite.",
      quoi: "Chaque dimanche, la dernière sauvegarde du CRM est copiée dans le Drive partagé « Sauvegardes CRM IP5 » (compte contact@), dans un dossier daté du jour.",
      rassure: "Tout s'est bien passé : les fichiers ont été copiés et leur taille vérifiée.",
      faire: "Rien à faire. Vous pouvez jeter un œil au dossier dans Google Drive si vous voulez.",
    },
    ko: {
      sujet: "⚠️ La copie de sauvegarde sur Google Drive a échoué",
      titre: "La copie de vos données sur Google Drive n'a pas marché.",
      quoi: "Chaque dimanche, la dernière sauvegarde du CRM devrait être copiée dans le Drive partagé « Sauvegardes CRM IP5 ». Cette fois, la copie a eu un problème (accès au Drive, place, ou autre).",
      rassure: "Vos données ne sont pas en danger : la sauvegarde de la nuit existe toujours dans Firebase. Seule la copie de secours sur Drive manque cette semaine.",
      faire: "Dites à Claude « la copie Drive a échoué » : il regardera pourquoi et la relancera.",
    },
  },
};
MSG["copie-fichiers"] = {
  ok: null, // pas de mail chaque nuit quand tout va bien
  ko: {
    sujet: "⚠️ La copie des fichiers clients sur Google Drive a échoué",
    titre: "La copie de vos fichiers clients sur Google Drive n'a pas marché.",
    quoi: "Chaque nuit, les fichiers joints aux fiches (avis d'imposition, devis, photos…) sont copiés dans le Drive partagé « Sauvegardes CRM IP5 », rangés par nom de client. Cette nuit, un ou plusieurs fichiers n'ont pas pu être copiés.",
    rassure: "Vos fichiers ne sont pas en danger : les originaux sont toujours dans le CRM. Seule la copie de secours sur Drive est en retard. Elle rattrapera le retard la nuit suivante si le problème est passager.",
    faire: "Si ce mail revient deux nuits de suite, dites à Claude « la copie des fichiers sur Drive échoue » : il regardera pourquoi.",
  },
};
const m = (MSG[NOM] ?? {})[ok ? "ok" : "ko"];
if (!m) { console.log(`Pas de mail pour ${NOM} / ${STATUT}`); process.exit(0); }
if (!["success", "failure"].includes(STATUT)) { console.log("Statut ignoré :", STATUT); process.exit(0); }
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const color = ok ? "#16a34a" : "#dc2626";
const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;color:#1f2a37;font-size:16px;line-height:1.55">
<p style="margin:0 0 14px;font-size:20px;font-weight:bold;color:${color}">${esc(m.titre)}</p>
<p style="margin:0 0 12px"><b>Ce que c'est :</b> ${esc(m.quoi)}</p>
<p style="margin:0 0 12px"><b>${ok ? "Résultat" : "Pas de panique"} :</b> ${esc(m.rassure)}</p>
<p style="margin:0 0 16px"><b>Que faire :</b> ${esc(m.faire)}</p>
${RUN_URL ? `<p style="margin:0;font-size:13px;color:#6b7280">Détails techniques (pour Claude) : <a href="${esc(RUN_URL)}">${esc(RUN_URL)}</a></p>` : ""}
</div>`;
const from = process.env.GMAIL_SENDER_EMAIL;
const subject = `=?UTF-8?B?${Buffer.from(m.sujet).toString("base64")}?=`;
const raw = Buffer.from(
  [`From: IP5 Énergie CRM <${from}>`.replace("É", "=?UTF-8?B?w4k=?="), `To: ${DESTINATAIRE}`, `Subject: ${subject}`, "MIME-Version: 1.0", 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", Buffer.from(html).toString("base64")].join("\r\n"),
).toString("base64url");
const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
await google.gmail({ version: "v1", auth }).users.messages.send({ userId: "me", requestBody: { raw } });
console.log(`Mail envoyé à ${DESTINATAIRE} : ${m.sujet}`);
