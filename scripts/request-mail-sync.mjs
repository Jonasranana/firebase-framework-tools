// Demande une synchronisation de la boîte mail contact@ avec le CRM : crée un
// document crm_mail_requests, qui déclenche la fonction syncMailbox
// (functions/crmMail.js). Lancé toutes les 15 min par
// .github/workflows/sync-mailbox.yml (même mécanique que sync-crm-to-firestore).
//
// Variable requise : GOOGLE_APPLICATION_CREDENTIALS (JSON du compte de service).

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const PROJECT_ID = "kachoto-7554c";
const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const iat = Math.floor(Date.now() / 1000);
const unsigned =
  b64({ alg: "RS256", typ: "JWT" }) +
  "." +
  b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: sa.token_uri,
    iat,
    exp: iat + 3600,
  });
const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
const tokenRes = await fetch(sa.token_uri, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${unsigned}.${signature}`,
  }),
});
if (!tokenRes.ok) throw new Error(`Jeton Google refusé (${tokenRes.status}): ${await tokenRes.text()}`);
const { access_token } = await tokenRes.json();

const res = await fetch(
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/crm_mail_requests`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        by: { stringValue: "github-actions" },
        at: { timestampValue: new Date().toISOString() },
      },
    }),
  },
);
if (!res.ok) throw new Error(`Écriture Firestore refusée (${res.status}): ${await res.text()}`);
console.log("Synchronisation de la boîte mail demandée.");
