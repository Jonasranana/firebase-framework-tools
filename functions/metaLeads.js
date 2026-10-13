// Webhook Meta « Lead Ads » → CRM maison (étape 6). Remplace l'intégration
// native Meta → Monday : le lead du formulaire Facebook/Instagram arrive
// directement dans crm_leads, avec la même alerte mail interne.
//
// NON ACTIVÉ par défaut : cette fonction a besoin de 3 secrets qui doivent
// exister AVANT le déploiement (sinon firebase refuse de déployer toutes les
// fonctions). Mise en route : voir « Activer le webhook Meta » dans
// functions/README.md, puis décommenter la ligne d'activation en bas de
// functions/index.js.

const crypto = require("node:crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { google } = require("googleapis");

const META_VERIFY_TOKEN = defineSecret("META_VERIFY_TOKEN"); // chaîne choisie par vous
const META_APP_SECRET = defineSecret("META_APP_SECRET"); // « Clé secrète » de l'app Meta
const META_PAGE_TOKEN = defineSecret("META_PAGE_TOKEN"); // jeton d'accès de la Page (leads_retrieval)

const GRAPH = "https://graph.facebook.com/v21.0";

// Noms de champs standards d'un formulaire Meta ; les autres questions vont
// dans les « infos » de la fiche.
const STANDARD = {
  full_name: "name",
  first_name: "firstName",
  last_name: "lastName",
  email: "email",
  phone_number: "phone",
  zip_code: "postalCode",
  post_code: "postalCode",
  city: "city",
};

module.exports = function buildMetaLeads({
  createCrmFacebookLead,
  buildLeadNotificationEmailHtml,
  buildRawMessage,
  escapeHtmlText,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_SENDER_EMAIL,
}) {
  async function handleLead(leadgenId) {
    const r = await fetch(`${GRAPH}/${encodeURIComponent(leadgenId)}?access_token=${encodeURIComponent(META_PAGE_TOKEN.value())}`);
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !Array.isArray(body.field_data)) {
      throw new Error(`Graph API ${r.status}: ${JSON.stringify(body).slice(0, 300)}`);
    }
    const f = {};
    const details = {};
    for (const { name, values } of body.field_data) {
      const v = String(values?.[0] ?? "").trim();
      if (!v) continue;
      if (STANDARD[name]) f[STANDARD[name]] = v;
      else details[name.replace(/_/g, " ")] = v;
    }
    const name = f.name || `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() || "Lead Facebook";
    if (body.form_id) details["Formulaire Meta"] = String(body.form_id);
    const created = await createCrmFacebookLead({
      docId: `fb_${leadgenId}`,
      name,
      phone: f.phone,
      email: f.email,
      postalCode: f.postalCode,
      city: f.city,
      details,
    });
    if (!created) return;

    const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
    oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const to = GMAIL_SENDER_EMAIL.value();
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: buildRawMessage({
          to,
          from: to,
          subject: `📘 Lead Formulaire Facebook — ${name}`,
          html: buildLeadNotificationEmailHtml({
            requestType: "Formulaire Facebook",
            name: escapeHtmlText(name),
            phone: escapeHtmlText(f.phone),
            email: escapeHtmlText(f.email),
            postalCode: escapeHtmlText(f.postalCode),
            source: "formulaire-facebook",
            via: "le formulaire Facebook",
          }),
        }),
      },
    });
  }

  const metaLeadWebhook = onRequest(
    {
      secrets: [
        META_VERIFY_TOKEN,
        META_APP_SECRET,
        META_PAGE_TOKEN,
        GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET,
        GMAIL_REFRESH_TOKEN,
        GMAIL_SENDER_EMAIL,
      ],
      region: "europe-west9",
    },
    async (req, res) => {
      // Vérification de l'URL par Meta lors de la configuration du webhook.
      if (req.method === "GET") {
        if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === META_VERIFY_TOKEN.value()) {
          res.status(200).send(String(req.query["hub.challenge"] ?? ""));
        } else {
          res.status(403).send("forbidden");
        }
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("method not allowed");
        return;
      }
      // Signature : seul Meta connaît la clé secrète de l'app.
      const expected =
        "sha256=" + crypto.createHmac("sha256", META_APP_SECRET.value()).update(req.rawBody ?? "").digest("hex");
      const given = String(req.get("x-hub-signature-256") ?? "");
      if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
        res.status(403).send("bad signature");
        return;
      }
      const ids = [];
      for (const entry of req.body?.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field === "leadgen" && change.value?.leadgen_id) ids.push(String(change.value.leadgen_id));
        }
      }
      let failed = false;
      for (const id of ids) {
        try {
          await handleLead(id);
          logger.info("Lead Meta reçu", { leadgenId: id });
        } catch (err) {
          failed = true;
          logger.error("Lead Meta : traitement échoué", { leadgenId: id, error: err.message });
        }
      }
      // 500 → Meta réessaie plus tard ; la création est idempotente (fb_<id>).
      res.status(failed ? 500 : 200).send(failed ? "error" : "ok");
    },
  );

  return { metaLeadWebhook };
};
