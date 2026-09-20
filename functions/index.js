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

// E-mail de bienvenue envoyé automatiquement aux leads intéressés par une
// pompe à chaleur (formulaire simulateur du site, collection ip5_leads).
// Images hébergées sur le site (pas en pièce jointe / base64) : plus
// fiable pour l'affichage dans les clients mail que des images intégrées.
function buildLeadWelcomeEmailHtml({ prenom }) {
  const NAVY = "#173a5e";
  const NAVY_DARK = "#122f4d";
  const BLUE = "#2b5a8f";
  const BLUE_TINT = "#eaf1f8";
  const logoUrl = `${SITE_URL}/images/email/logo-ip5-energie.png`;
  const heroUrl = `${SITE_URL}/images/email/pac-atlantic-isilia.jpg`;

  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0; padding:0; background:#f3f5f8; font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8; padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #e5e9ef;">

  <tr>
    <td style="padding:20px 24px;" align="left">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="left" valign="middle">
            <img src="${logoUrl}" width="150" alt="IP5 Énergie" style="display:block; height:auto;" />
          </td>
          <td align="right" valign="middle">
            <span style="display:inline-block; background:${BLUE_TINT}; color:${NAVY}; font-size:12px; font-weight:bold; padding:6px 12px; border-radius:999px; white-space:nowrap;">
              🇫🇷 Fabrication française
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:0 24px;">
      <img src="${heroUrl}" width="552" alt="Pompe à chaleur Atlantic installée par IP5 Énergie" style="display:block; width:100%; height:auto; border-radius:16px;" />
    </td>
  </tr>

  <tr>
    <td style="padding:24px 24px 8px 24px; color:${NAVY_DARK}; font-size:16px; line-height:1.6;">
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour ${prenom} 👋, IP5 Énergie.</p>
      <p style="margin:0;">
        En attendant de vous avoir de vive voix, voici un résumé de la pompe à chaleur
        <strong>Atlantic Isilia M</strong> à laquelle, selon les informations communiquées,
        vous pourriez avoir droit à <strong style="color:${BLUE};">0&nbsp;€</strong>
        (prise en charge à 100&nbsp;% via les aides à la rénovation énergétique)&nbsp;:
      </p>
    </td>
  </tr>

  <tr>
    <td style="padding:12px 24px 4px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${[
          ["🇫🇷", "Fabrication française"],
          ["⚡", "Jusqu'à -60&nbsp;% sur votre facture de chauffage"],
          ["🔇", "Ultra-silencieuse, garantie jusqu'à 5 ans"],
          ["🌡️", "Fonctionne même par grand froid"],
        ]
          .map(
            ([icon, label]) => `
        <tr>
          <td style="padding:8px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td width="36" valign="middle">
                  <div style="width:28px; height:28px; border-radius:50%; background:${BLUE_TINT}; text-align:center; line-height:28px; font-size:14px;">${icon}</div>
                </td>
                <td style="padding-left:10px; font-size:14px; font-weight:bold; color:${NAVY_DARK};" valign="middle">${label}</td>
              </tr>
            </table>
          </td>
        </tr>`,
          )
          .join("")}
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:16px 24px 4px 24px; color:${NAVY_DARK}; font-size:14px;">
      Un conseiller vous appelle très bientôt pour valider votre dossier.
    </td>
  </tr>

  <tr>
    <td style="padding:16px 24px 28px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY}; border-radius:16px;">
        <tr>
          <td style="padding:20px;">
            <p style="margin:0 0 14px 0; color:#ffffff; font-size:14px; font-weight:bold; line-height:1.5;">
              Pour avancer dès maintenant, envoyez-nous par mail la première page de votre dernier avis d'imposition&nbsp;:
            </p>
            <a href="mailto:${GMAIL_SENDER_EMAIL.value()}" style="display:inline-block; background:#ffffff; color:${NAVY}; font-size:14px; font-weight:bold; text-decoration:none; padding:12px 20px; border-radius:999px;">
              ✉️ ${GMAIL_SENDER_EMAIL.value()}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:0 24px 24px 24px; color:#8a94a3; font-size:13px; font-style:italic;">
      — IP5 Énergie
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

exports.sendLeadWelcomeEmail = onDocumentCreated(
  {
    document: "ip5_leads/{leadId}",
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL],
    region: "europe-west9",
  },
  async (event) => {
    const data = event.data?.data();
    const leadId = event.params.leadId;

    if (!data || !data.email) {
      logger.info("Lead sans e-mail, envoi de bienvenue ignoré", { leadId });
      return;
    }
    // Le contenu de cet e-mail est spécifique à la pompe à chaleur : on ne
    // l'envoie pas aux leads uniquement intéressés par le solaire. Comparaison
    // tolérante (espaces, casse) : un accent ou une espace mal saisi ne doit
    // pas faire échouer silencieusement l'envoi.
    const projectType = String(data.projectType ?? "").trim().toLowerCase();
    const wantsPAC = projectType.includes("pompe") || projectType.includes("les deux");
    if (!wantsPAC) {
      logger.info("Lead sans intérêt PAC, envoi de bienvenue ignoré", { leadId, projectType: data.projectType });
      return;
    }

    const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
    oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const prenom = String(data.name ?? "").trim().split(/\s+/)[0] || "";

    const raw = buildRawMessage({
      to: data.email,
      from: GMAIL_SENDER_EMAIL.value(),
      subject: "IP5 Énergie — Votre pompe à chaleur à 0 €",
      html: buildLeadWelcomeEmailHtml({ prenom }),
    });

    try {
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      logger.info("E-mail de bienvenue lead envoyé", { leadId, to: data.email });
    } catch (err) {
      logger.error("Échec de l'envoi de l'e-mail de bienvenue lead", { leadId, error: err.message });
      throw err;
    }
  },
);

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
