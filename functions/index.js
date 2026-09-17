const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { google } = require("googleapis");

const GMAIL_CLIENT_ID = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN = defineSecret("GMAIL_REFRESH_TOKEN");
const GMAIL_SENDER_EMAIL = defineSecret("GMAIL_SENDER_EMAIL");

const SITE_URL = "https://ip5energie.fr";

// Les en-têtes (From, Subject...) doivent rester en ASCII : les caractères
// accentués sont encodés au format RFC 2047 (mot encodé), sinon ils sont
// mal réinterprétés par les clients mail (accents en caractères parasites).
function encodeHeaderWord(text) {
  return `=?utf-8?B?${Buffer.from(text, "utf-8").toString("base64")}?=`;
}

function buildRawMessage({ to, from, subject, html }) {
  const message = [
    `From: ${encodeHeaderWord("IP5 Énergie")} <${from}>`,
    `To: ${to}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${encodeHeaderWord(subject)}`,
    "",
    html,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildEmailHtml({ nomContact, isContrat, link, prime }) {
  const intro = isContrat
    ? "Voici le contrat d'entretien de votre station de gonflage à valider et signer en ligne."
    : "Voici le pré-devis de votre station de gonflage à valider et signer en ligne.";

  return `
    <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:560px;">
      <p>Bonjour ${nomContact || ""},</p>
      <p>${intro}</p>
      ${prime ? `<p><strong>Montant financé par la prime CEE : ${prime}</strong></p>` : ""}
      <p>
        <a href="${link}" style="display:inline-block; background:#0f2b4a; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:10px; font-weight:bold;">
          Consulter et signer le document
        </a>
      </p>
      <p style="font-size:13px; color:#6b7280;">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
        <a href="${link}">${link}</a>
      </p>
      <p>Cordialement,<br/>L'équipe IP5 Énergie</p>
    </div>
  `;
}

exports.sendGonflageSignatureEmail = onDocumentCreated(
  {
    document: "gonflage_signatures/{token}",
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL],
    region: "europe-west9",
  },
  async (event) => {
    const data = event.data?.data();
    const token = event.params.token;

    if (!data || !data.email) {
      logger.warn("Jeton de signature sans e-mail, envoi ignoré", { token });
      return;
    }

    const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
    oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const isContrat = data.type === "contrat";
    const link = `${SITE_URL}/gonflage-signature/${token}`;
    const subject = isContrat
      ? `IP5 Énergie — Contrat d'entretien à signer (${data.raisonSociale || ""})`
      : `IP5 Énergie — Votre pré-devis Station de gonflage (${data.raisonSociale || ""})`;
    const prime =
      typeof data.primeCEE === "number"
        ? `${data.primeCEE.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
        : null;

    const raw = buildRawMessage({
      to: data.email,
      from: GMAIL_SENDER_EMAIL.value(),
      subject,
      html: buildEmailHtml({ nomContact: data.nomContact, isContrat, link, prime }),
    });

    try {
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      logger.info("E-mail de signature envoyé", { token, to: data.email });
    } catch (err) {
      logger.error("Échec de l'envoi de l'e-mail de signature", { token, error: err.message });
      throw err;
    }
  },
);
