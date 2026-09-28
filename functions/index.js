const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { google } = require("googleapis");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { readFileSync } = require("node:fs");
const path = require("node:path");

initializeApp();
const db = getFirestore();

const GMAIL_CLIENT_ID = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN = defineSecret("GMAIL_REFRESH_TOKEN");
const GMAIL_SENDER_EMAIL = defineSecret("GMAIL_SENDER_EMAIL");
const MONDAY_API_TOKEN = defineSecret("MONDAY_API_TOKEN");
const MONDAY_WEBHOOK_SECRET = defineSecret("MONDAY_WEBHOOK_SECRET");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = "+33939207357";

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

// Variante avec pièce(s) jointe(s) (multipart/mixed) : utilisée pour les
// modèles de mail Monday qui joignent un ou plusieurs documents (ex. fiche
// technique en plusieurs PDF). Sans pièce jointe, retombe sur le message
// simple ci-dessus.
function buildRawMessageWithAttachment({ to, from, subject, html, attachments }) {
  if (!attachments || attachments.length === 0) {
    return buildRawMessage({ to, from, subject, html });
  }
  const boundary = `ip5_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const attachmentParts = attachments.flatMap((attachment) => {
    const fileData = readFileSync(attachment.path).toString("base64");
    // RFC 2045 : les lignes base64 doivent être limitées à 76 caractères.
    const fileDataWrapped = fileData.match(/.{1,76}/g).join("\r\n");
    return [
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      fileDataWrapped,
      "",
    ];
  });
  const message = [
    `From: ${encodeHeaderWord("IP5 Énergie")} <${from}>`,
    `To: ${to}`,
    "MIME-Version: 1.0",
    `Subject: ${encodeHeaderWord(subject)}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
    "",
    ...attachmentParts,
    `--${boundary}--`,
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
function buildLeadWelcomeEmailHtml({ nomComplet }) {
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
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour ${nomComplet} 👋, IP5 Énergie.</p>
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
    <td style="padding:0 24px 20px 24px;">
      <p style="margin:0 0 10px 0; color:#5b6b7d; font-size:13px;">Une question, envie de nous rappeler directement&nbsp;?</p>
      <a href="tel:+33749525267" style="display:block; color:${NAVY}; font-weight:bold; font-size:17px; text-decoration:none; margin-bottom:6px;">📞&nbsp;07&nbsp;49&nbsp;52&nbsp;52&nbsp;67</a>
      <a href="tel:+33695920409" style="display:block; color:${NAVY}; font-weight:bold; font-size:17px; text-decoration:none;">📞&nbsp;06&nbsp;95&nbsp;92&nbsp;04&nbsp;09</a>
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

// E-mail interne envoyé sur contact@ip5energie.com dès qu'un lead arrive
// dans ip5_leads, avant même la synchro Monday (cron toutes les 15 min) :
// délai de traitement le plus court possible. Envoyé pour tous les leads,
// quel que soit le projet (PAC, solaire, les deux).
function buildLeadNotificationEmailHtml(data) {
  const NAVY_DARK = "#122f4d";
  const BLUE = "#2b5a8f";
  const rows = [
    ["Demande", data.requestType],
    ["Nom", data.name],
    ["Téléphone", data.phone],
    ["E-mail", data.email],
    ["Projet", data.projectType],
    ["Type de logement", data.housingType],
    ["Statut", data.ownerStatus],
    ["Surface", data.surface ? `${data.surface} m²` : ""],
    ["Chauffage actuel", data.currentHeating],
    ["Code postal", data.postalCode],
    ["Département", data.postalCode ? "" : data.department],
    ["Foyer", data.householdSize],
    ["Revenus", data.incomeBracket],
    ["Échéance projet", data.projectTiming],
    ["Résultat affiché", data.simulationResult],
    ["Source", data.source],
  ].filter(([, value]) => value);

  return `
    <div style="font-family:Arial,Helvetica,sans-serif; color:${NAVY_DARK}; max-width:560px;">
      <p style="font-size:16px; font-weight:bold; margin:0 0 4px 0;">Nouveau lead — ${data.name || "sans nom"}</p>
      <p style="font-size:13px; color:#6b7280; margin:0 0 16px 0;">Reçu à l'instant via le site IP5 Énergie.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px; border-collapse:collapse;">
        ${rows
          .map(
            ([label, value]) => `
        <tr>
          <td style="padding:4px 12px 4px 0; color:#6b7280; vertical-align:top; white-space:nowrap;">${label}</td>
          <td style="padding:4px 0; font-weight:bold;">${value}</td>
        </tr>`,
          )
          .join("")}
      </table>
      ${
        data.phone
          ? `<p style="margin:20px 0 0 0;">
              <a href="tel:${String(data.phone).replace(/\s+/g, "")}" style="display:inline-block; background:${BLUE}; color:#ffffff; text-decoration:none; padding:10px 18px; border-radius:10px; font-weight:bold; font-size:13px;">
                📞 Rappeler ${data.name || "le lead"}
              </a>
            </p>`
          : ""
      }
    </div>
  `;
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

    const nomComplet = String(data.name ?? "").trim();

    const raw = buildRawMessage({
      to: data.email,
      from: GMAIL_SENDER_EMAIL.value(),
      subject: "IP5 Énergie — Votre pompe à chaleur à 0 €",
      html: buildLeadWelcomeEmailHtml({ nomComplet }),
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

exports.notifyNewLead = onDocumentCreated(
  {
    document: "ip5_leads/{leadId}",
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL],
    region: "europe-west9",
  },
  async (event) => {
    const data = event.data?.data();
    const leadId = event.params.leadId;

    if (!data) {
      logger.info("Lead vide, notification interne ignorée", { leadId });
      return;
    }

    const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
    oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const contactEmail = GMAIL_SENDER_EMAIL.value();
    const raw = buildRawMessage({
      to: contactEmail,
      from: contactEmail,
      subject: data.requestType
        ? `📞 Rappel demandé — ${data.name || "sans nom"}`
        : `🔔 Nouveau lead — ${data.name || "sans nom"}${data.projectType ? ` (${data.projectType})` : ""}`,
      html: buildLeadNotificationEmailHtml(data),
    });

    try {
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      logger.info("Notification interne nouveau lead envoyée", { leadId, to: contactEmail });
    } catch (err) {
      logger.error("Échec de l'envoi de la notification interne nouveau lead", { leadId, error: err.message });
      throw err;
    }
  },
);

// Synchronisation immédiate des leads vers Monday (tableau "Pac Pac😀"),
// en plus de scripts/sync-leads-to-monday.mjs qui continue de tourner
// toutes les 15 min comme filet de sécurité : il ignore les leads déjà
// marqués mondaySynced=true, donc aucun risque de doublon si cette
// fonction a déjà réussi. Si elle échoue (erreur réseau, API Monday down),
// mondaySynced reste à false et le cron rattrape le lead au tour suivant.
// Logique de mapping des champs dupliquée depuis ce script plutôt que
// partagée : deux runtimes différents (module Node autonome vs Cloud
// Function), la duplication reste plus simple qu'un module commun ici.
const MONDAY_BOARD_ID = "18410104402";
const MONDAY_GROUP_LEADS = "group_mm79ghrj"; // "📥 Nouveaux leads du site internet"

const typeLeadIndexForSource = (source) => {
  const s = String(source ?? "").toLowerCase();
  if (s.includes("sms")) return 4; // 📲 SMS
  if (s.includes("gonflage")) return 8; // 🚗 Gonflage
  if (s.includes("solaire")) return 2; // ☀️ Solaire
  if (s.includes("pac")) return 1; // 🔥 PAC
  return 17; // Autre
};

const MONDAY_COL = {
  statutAppel: "color_mm6vdhz4", // 📞 Statut Appel
  typeDemande: "color_mm7m3q82", // 📥 Type de demande
  typeLead: "color_mm79bwsw", // 🏷️ Type de lead
  telephone: "phone_mm2qnqr2", // 📞 Téléphone
  dateContact: "date_mm6vw6b2", // Date 1er contact
  codePostal: "text_mm2qf4s7", // 📍 Code postal (n° de département)
  foyer: "text_mm747bpc", // Personnes au foyer
  revenus: "text_mm6zss8", // Tranche de revenus
  chauffage: "text_mm747sr4", // Chauffage actuel
  surface: "numeric_mm2q4jsz", // 📐 Surface
  email: "email_mm2qmb9n", // 📧 Email
  source: "text_mm76vm3v", // Source
  projet: "text_mm76rsb3", // 🔧 Projet
  notes: "text_mm2qhek4", // 📝 Notes rapides appel
};

const buildMondayNotes = (f) => {
  const lines = [];
  if (f.requestType) lines.push(`📞 ${f.requestType}`);
  if (f.simulationResult) lines.push(`Résultat affiché : ${f.simulationResult}`);
  if (f.housingType) lines.push(`Logement : ${f.housingType}`);
  if (f.ownerStatus) lines.push(`Propriétaire : ${f.ownerStatus}`);
  if (f.projectTiming) lines.push(`Échéance : ${f.projectTiming}`);
  if (f.contact) lines.push(`Contact pro : ${f.contact}`);
  if (f.typeSite) lines.push(`Type de site : ${f.typeSite}`);
  if (f.nbVehicules) lines.push(`Nb véhicules : ${f.nbVehicules}`);
  return lines.join(" — ");
};

const departementCode = (department) => String(department ?? "").slice(0, 2);

// La colonne "phone" de Monday refuse les espaces et séparateurs.
const normalizePhone = (raw) => {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("33") && digits.length === 11) {
    digits = "0" + digits.slice(2);
  }
  return digits;
};

// createdAt arrive ici comme un Timestamp Firestore (Admin SDK), pas une
// chaîne ISO comme dans le script cron (qui le lit via l'API REST).
const parisDate = (ts) => {
  const date = ts && typeof ts.toDate === "function" ? ts.toDate() : ts ? new Date(ts) : new Date();
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

// « 📥 Type de demande » : ids de libellés vérifiés via get_board_info
// (colonne color_mm7m3q82).
const requestTypeIndex = (f) => {
  const source = String(f.source ?? "");
  if (f.requestType) return 1; // 📞 Rappel demandé
  if (source.startsWith("reactivation")) return 4; // ✉️ Réactivation
  if (source.includes("gonflage")) return null;
  return 7; // 🧮 Simulation
};

async function createMondayItem(f, mondayToken) {
  const columnValues = {
    [MONDAY_COL.statutAppel]: { index: 101 }, // "🆕 Nouveau lead"
    [MONDAY_COL.typeLead]: { index: typeLeadIndexForSource(f.source) },
    [MONDAY_COL.telephone]: { phone: normalizePhone(f.phone), countryShortName: "FR" },
    [MONDAY_COL.dateContact]: { date: parisDate(f.createdAt) },
    [MONDAY_COL.codePostal]: f.postalCode ? String(f.postalCode) : departementCode(f.department),
    [MONDAY_COL.foyer]: String(f.householdSize ?? ""),
    [MONDAY_COL.revenus]: String(f.incomeBracket ?? ""),
    [MONDAY_COL.chauffage]: String(f.currentHeating ?? ""),
    [MONDAY_COL.surface]: String(f.surface ?? ""),
    [MONDAY_COL.source]: String(f.source ?? "site-internet"),
    [MONDAY_COL.projet]: String(f.projectType ?? ""),
    [MONDAY_COL.notes]: buildMondayNotes(f),
  };
  const email = String(f.email ?? "").trim();
  if (email) {
    columnValues[MONDAY_COL.email] = { email, text: email };
  }
  const typeIdx = requestTypeIndex(f);
  if (typeIdx !== null) columnValues[MONDAY_COL.typeDemande] = { index: typeIdx };
  const query = `mutation ($board: ID!, $group: String!, $name: String!, $values: JSON!) {
    create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id }
  }`;
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: mondayToken,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({
      query,
      variables: {
        board: MONDAY_BOARD_ID,
        group: MONDAY_GROUP_LEADS,
        name: String(f.name ?? "Lead sans nom").slice(0, 255),
        values: JSON.stringify(columnValues),
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors?.length || !body.data?.create_item?.id) {
    throw new Error(`Échec de création Monday: ${JSON.stringify(body)}`);
  }
  return body.data.create_item.id;
}

exports.syncLeadToMonday = onDocumentCreated(
  {
    document: "ip5_leads/{leadId}",
    secrets: [MONDAY_API_TOKEN],
    region: "europe-west9",
  },
  async (event) => {
    const data = event.data?.data();
    const leadId = event.params.leadId;
    if (!data) return;

    try {
      const itemId = await createMondayItem(data, MONDAY_API_TOKEN.value());
      await db.doc(`ip5_leads/${leadId}`).update({ mondaySynced: true, mondayItemId: String(itemId) });
      logger.info("Lead synchronisé sur Monday immédiatement", { leadId, itemId });
    } catch (err) {
      logger.error(
        "Échec de la synchro Monday immédiate, le filet de sécurité (cron 15 min) prendra le relais",
        { leadId, error: err.message },
      );
    }
  },
);

// Coquille commune (logo, numéros de rappel, signature) pour les modèles
// de mail déclenchés depuis Monday (voir sendMondayEmailTemplate). Reprend
// le même habillage que l'e-mail de bienvenue lead, sans le dupliquer
// entièrement : ici le corps varie selon le modèle choisi dans Monday.
function buildBrandedEmailShell({ bodyHtml }) {
  const NAVY = "#173a5e";
  const NAVY_DARK = "#122f4d";
  const BLUE = "#2b5a8f";
  const logoUrl = `${SITE_URL}/images/email/logo-ip5-energie.png`;

  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0; padding:0; background:#ffffff; font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">

  <tr>
    <td style="padding:28px 40px 16px 40px; border-bottom:2px solid ${NAVY};" align="left">
      <img src="${logoUrl}" width="150" alt="IP5 Énergie" style="display:block; height:auto;" />
    </td>
  </tr>

  <tr>
    <td style="padding:24px 40px; color:${NAVY_DARK}; font-size:16px; line-height:1.6;">
      ${bodyHtml}
    </td>
  </tr>

  <tr>
    <td style="padding:0 40px 20px 40px; border-top:1px solid #e5e9ef;">
      <div style="padding-top:20px;">
        <p style="margin:0 0 10px 0; color:#5b6b7d; font-size:13px;">Une question, envie de nous rappeler directement&nbsp;?</p>
        <a href="tel:+33749525267" style="display:block; color:${NAVY}; font-weight:bold; font-size:17px; text-decoration:none; margin-bottom:6px;">📞&nbsp;07&nbsp;49&nbsp;52&nbsp;52&nbsp;67</a>
        <a href="tel:+33695920409" style="display:block; color:${NAVY}; font-weight:bold; font-size:17px; text-decoration:none;">📞&nbsp;06&nbsp;95&nbsp;92&nbsp;04&nbsp;09</a>
      </div>
    </td>
  </tr>

  <tr>
    <td style="padding:0 40px 28px 40px; color:#8a94a3; font-size:13px; font-style:italic;">
      — IP5 Énergie
    </td>
  </tr>

</table>
</body>
</html>`;
}

function buildRelanceInjoignableEmailHtml({ nomComplet }) {
  return buildBrandedEmailShell({
    bodyHtml: `
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour ${nomComplet},</p>
      <p style="margin:0 0 12px 0;">
        Nous avons essayé de vous joindre, sans succès, pour savoir si vous
        seriez intéressé(e) par les informations concernant la possibilité
        d'installer une pompe à chaleur chez vous.
      </p>
      <p style="margin:0 0 12px 0;">
        Vous pourriez être éligible à une prise en charge à <strong>0&nbsp;€</strong>
        (sous réserve d'éligibilité) : n'hésitez pas à nous rappeler quand cela
        vous conviendra, nous reprendrons votre dossier là où nous l'avions laissé.
      </p>
      <p style="margin:0;">
        Bien cordialement,<br/>
        Carole Sitbon, IP5 Énergie
      </p>
    `,
  });
}

function buildRelance2InjoignableEmailHtml({ nomComplet }) {
  return buildBrandedEmailShell({
    bodyHtml: `
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour ${nomComplet},</p>
      <p style="margin:0 0 12px 0;">
        Nous revenons vers vous suite à notre précédent message : nous n'avons
        toujours pas réussi à vous joindre au sujet de votre projet de pompe à
        chaleur.
      </p>
      <p style="margin:0 0 12px 0;">
        Votre demande est toujours enregistrée et nous serions ravis d'étudier
        avec vous les aides auxquelles vous pourriez avoir droit (sous réserve
        d'éligibilité). Vous pouvez nous rappeler aux numéros ci-dessous, ou
        simplement répondre à ce mail en nous indiquant le meilleur moment pour
        vous joindre.
      </p>
      <p style="margin:0;">
        Bien cordialement,<br/>
        Carole Sitbon, IP5 Énergie
      </p>
    `,
  });
}

function buildRelance3InjoignableEmailHtml({ nomComplet }) {
  return buildBrandedEmailShell({
    bodyHtml: `
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour ${nomComplet},</p>
      <p style="margin:0 0 12px 0;">
        Malgré plusieurs tentatives, nous n'avons pas réussi à vous joindre au
        sujet de votre projet de pompe à chaleur.
      </p>
      <p style="margin:0 0 12px 0;">
        Ceci est notre dernier message : sans retour de votre part, nous
        clôturerons votre demande.
      </p>
      <p style="margin:0 0 12px 0;">
        Si vous êtes toujours intéressé(e), il vous suffit de nous rappeler aux
        numéros ci-dessous ou de répondre à ce mail : nous reprendrons votre
        dossier là où nous l'avions laissé.
      </p>
      <p style="margin:0;">
        Bien cordialement,<br/>
        Carole Sitbon, IP5 Énergie
      </p>
    `,
  });
}

// Texte dicté par Carole : même corps de mail dans les deux cas (0 € ou
// reste à charge), seule la phrase sur le montant change.
function buildFicheTechniqueEmailHtml({ nomComplet, rac }) {
  const montant = rac
    ? `avec un reste à charge de <strong>${rac}&nbsp;€</strong> sous réserve de votre éligibilité`
    : `à <strong>0&nbsp;€</strong> sous réserve de votre éligibilité`;
  return buildBrandedEmailShell({
    bodyHtml: `
      <p style="margin:0 0 12px 0; font-weight:bold;">Rebonjour ${nomComplet},</p>
      <p style="margin:0 0 12px 0;">
        Suite à notre conversation téléphonique et comme convenu, veuillez
        trouver ci-joint la fiche technique relative au programme
        d'installation d'une pompe à chaleur, ${montant}.
      </p>
      <p style="margin:0 0 12px 0;">
        Nous restons bien évidemment en contact pour la suite de votre
        dossier.
      </p>
      <p style="margin:0;">
        Bien cordialement,<br/>
        Carole Sitbon<br/>
        IP5 Énergie
      </p>
    `,
  });
}

function buildDemandeAvisImpositionEmailHtml({ nomComplet }) {
  return buildBrandedEmailShell({
    bodyHtml: `
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour ${nomComplet},</p>
      <p style="margin:0 0 12px 0;">
        Merci pour votre appel concernant l'installation de votre pompe à
        chaleur.
      </p>
      <p style="margin:0 0 12px 0;">
        Pour finaliser l'étude de votre dossier et déterminer précisément le
        montant de la prise en charge à laquelle vous avez droit, il ne nous
        manque plus que votre avis d'imposition. Vous pouvez nous le
        transmettre par retour de mail, en réponse à ce message.
      </p>
      <p style="margin:0;">
        Bien cordialement,<br/>
        Carole Sitbon<br/>
        IP5 Énergie
      </p>
    `,
  });
}

function buildEligibiliteEmailHtml({ nomComplet }) {
  return buildBrandedEmailShell({
    bodyHtml: `
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour ${nomComplet},</p>
      <p style="margin:0 0 12px 0;">
        Pour bénéficier de la prise en charge, il faut être propriétaire ou
        locataire du logement concerné, et le montant dépend de votre revenu
        fiscal de référence (avis d'imposition).
      </p>
      <p style="margin:0 0 12px 0;">
        Vous trouverez également ci-joint la fiche technique de la pompe
        à chaleur.
      </p>
      <p style="margin:0;">
        Bien cordialement,<br/>
        IP5 Énergie
      </p>
    `,
  });
}

// Signé "IP5 Énergie" seul (pas un commercial en particulier) : ce mail
// peut être envoyé après un appel passé par n'importe quel commercial.
function buildRemerciementAppelEmailHtml({ nomComplet }) {
  return buildBrandedEmailShell({
    bodyHtml: `
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour ${nomComplet},</p>
      <p style="margin:0 0 12px 0;">
        Nous vous remercions pour votre appel concernant l'installation
        d'une pompe à chaleur.
      </p>
      <p style="margin:0 0 12px 0;">
        Nous revenons vers vous prochainement avec plus d'informations
        pour la suite de votre dossier.
      </p>
      <p style="margin:0;">
        Bien cordialement,<br/>
        IP5 Énergie
      </p>
    `,
  });
}

// Modèles de mail pilotés depuis Monday (colonne "📧 Mail ( Auto )",
// color_mm7ensy9, tableau "Pac Pac😀") : choisir une valeur dans cette
// colonne envoie automatiquement l'e-mail correspondant au lead, via un
// webhook Monday -> sendMondayEmailTemplate ci-dessous. Pour ajouter un
// nouveau cas de figure : ajouter le libellé comme option de la colonne
// dans Monday, puis une entrée ici avec son sujet/contenu.
const MONDAY_TEMPLATE_COLUMN_ID = "color_mm7ensy9";

// Reste à charge (RAC) : calculé automatiquement à partir de 3 colonnes
// Monday (précarité, zone, marque), avec la même formule que l'outil
// interne "Marges Prémi" (OutilDevis.tsx) — à garder synchronisé si le
// barème change. Une saisie manuelle dans MONDAY_COL_RAC prend le pas sur
// le calcul automatique (cas particuliers hors barème standard).
const MONDAY_COL_RAC = "numeric_mm7er35c";
const MONDAY_COL_PRECARITE = "color_mm7eq7pm";
const MONDAY_COL_ZONE = "color_mm7eccnx";
const MONDAY_COL_MARQUE = "color_mm7enw6k";

const PREMI_CEE = {
  Bleu: { H1: 8517, H2: 7400 },
  Jaune: { H1: 4580, H2: 3200 },
  Violet: { H1: 4580, H2: 3200 },
};
const PREMI_MPR_BRUT = { Bleu: 5000, Jaune: 4000, Violet: 3000 };
const PREMI_FOURNI_POSE = { Atlantis: 5700, Chappée: 5900 };
const PREMI_COMMISSION = 0.12; // % HT sur MaPrimeRénov
const PREMI_TVA_COMMISSION = 0.2;
const PREMI_TAUX_NET_MPR = 1 - PREMI_COMMISSION * (1 + PREMI_TVA_COMMISSION);
const PREMI_MARGE_MIN = 2500;

// Renvoie undefined si la combinaison précarité/zone/marque est inconnue
// (ex. "Rose", non couvert par ce barème) plutôt que de deviner un montant.
function computeResteACharge({ precarite, zone, marque }) {
  const cee = PREMI_CEE[precarite]?.[zone];
  const mprBrut = PREMI_MPR_BRUT[precarite];
  const cout = PREMI_FOURNI_POSE[marque];
  if (cee === undefined || mprBrut === undefined || cout === undefined) {
    return undefined;
  }
  const mprNet = mprBrut * PREMI_TAUX_NET_MPR;
  const totalPercu = cee + mprNet;
  const marge = totalPercu - cout;
  return Math.max(0, PREMI_MARGE_MIN - marge);
}

const FICHE_TECHNIQUE_ATTACHMENTS = [
  {
    filename: "Fiche technique - Atlantic Alfea Excellia S.pdf",
    mimeType: "application/pdf",
    path: path.join(__dirname, "assets", "fiche-technique-alfea-excellia-s.pdf"),
  },
];
// Mêmes numéros que ceux affichés en pied de page des e-mails (voir
// buildBrandedEmailShell), pour que le SMS permette de rappeler directement.
const SMS_PHONE_NUMBERS = "07 49 52 52 67 / 06 95 92 04 09";

const MONDAY_EMAIL_TEMPLATES = {
  // Numéro en tête de libellé : Monday tronque la fin des étiquettes.
  "1 - relance injoignable": {
    subject: "IP5 Énergie — Nous avons essayé de vous joindre",
    buildHtml: buildRelanceInjoignableEmailHtml,
    buildSms: () =>
      `IP5 Énergie : nous avons essayé de vous joindre pour votre pompe à chaleur. Rappelez-nous au ${SMS_PHONE_NUMBERS} quand vous voulez.`,
  },
  "2 - relance injoignable": {
    subject: "IP5 Énergie — Votre projet de pompe à chaleur",
    buildHtml: buildRelance2InjoignableEmailHtml,
    buildSms: () =>
      `IP5 Énergie : nous n'avons toujours pas réussi à vous joindre pour votre projet de pompe à chaleur. Rappelez-nous au ${SMS_PHONE_NUMBERS} ou répondez à notre e-mail.`,
  },
  "3 - relance injoignable": {
    subject: "IP5 Énergie — Dernier message concernant votre projet",
    buildHtml: buildRelance3InjoignableEmailHtml,
    buildSms: () =>
      `IP5 Énergie : dernier message concernant votre projet de pompe à chaleur. Sans retour de votre part, nous clôturerons votre demande. Pour la poursuivre : ${SMS_PHONE_NUMBERS}.`,
  },
  "📎 demande avis d'imposition": {
    subject: "IP5 Énergie — Merci de nous transmettre votre avis d'imposition",
    buildHtml: buildDemandeAvisImpositionEmailHtml,
    buildSms: () =>
      `IP5 Énergie : pour finaliser votre dossier, merci de nous transmettre votre avis d'imposition (voir e-mail envoyé). Pour nous joindre : ${SMS_PHONE_NUMBERS}.`,
  },
  "🙏 remerciement appel": {
    subject: "IP5 Énergie — Merci pour votre appel",
    buildHtml: buildRemerciementAppelEmailHtml,
    buildSms: () =>
      `IP5 Énergie : merci pour votre appel. Nous revenons vers vous prochainement avec plus d'informations. Pour nous joindre : ${SMS_PHONE_NUMBERS}.`,
  },
  "🏠 explication éligibilité": {
    subject: "IP5 Énergie — Comment bénéficier de la prise en charge",
    buildHtml: buildEligibiliteEmailHtml,
    attachments: FICHE_TECHNIQUE_ATTACHMENTS,
    buildSms: () =>
      `IP5 Énergie : la prise en charge dépend de votre statut (propriétaire/locataire) et de votre revenu fiscal. Détails par e-mail. Pour nous joindre : ${SMS_PHONE_NUMBERS}.`,
  },
  "confirmation + fiche technique": {
    subject: "IP5 Énergie — Fiche technique de votre pompe à chaleur",
    buildHtml: buildFicheTechniqueEmailHtml,
    attachments: FICHE_TECHNIQUE_ATTACHMENTS,
    // A besoin d'un RAC résolu (0 ou positif) pour choisir la bonne phrase
    // dans l'e-mail — voir sendMondayEmailTemplate.
    requiresResolvedRac: true,
    buildSms: () =>
      `IP5 Énergie : merci pour votre appel. La fiche technique de votre pompe à chaleur vient de vous être envoyée par e-mail. Pour nous joindre : ${SMS_PHONE_NUMBERS}.`,
  },
};

// Colonne "phone" Monday : on y écrit toujours des chiffres locaux FR (sans
// +33, voir normalizePhone) à la création de l'item ; on reconvertit donc au
// format E.164 attendu par l'API Twilio pour l'envoi de SMS.
const toE164French = (raw) => {
  const digits = String(raw ?? "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("33") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+33${digits.slice(1)}`;
  return digits || undefined;
};

async function fetchMondayItemContact(itemId, mondayToken) {
  const query = `query ($ids: [ID!]) {
    items(ids: $ids) {
      name
      column_values(ids: [
        "email_mm2qmb9n",
        "${MONDAY_COL.telephone}",
        "${MONDAY_COL_RAC}",
        "${MONDAY_COL_PRECARITE}",
        "${MONDAY_COL_ZONE}",
        "${MONDAY_COL_MARQUE}"
      ]) { id text value }
    }
  }`;
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: mondayToken,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables: { ids: [String(itemId)] } }),
  });
  const body = await res.json().catch(() => ({}));
  const item = body?.data?.items?.[0];
  if (!item) {
    throw new Error(`Item Monday introuvable: ${JSON.stringify(body)}`);
  }
  const columns = Object.fromEntries((item.column_values ?? []).map((c) => [c.id, c]));
  // Colonne de type "email" : le champ `text` n'est qu'un libellé d'affichage
  // (peut diverger de l'adresse réelle) ; l'adresse routable est dans
  // `value.email`. On ne retombe sur `text` que si `value` est absent.
  const emailColumn = columns["email_mm2qmb9n"];
  let email;
  try {
    email = JSON.parse(emailColumn?.value ?? "null")?.email;
  } catch {
    email = undefined;
  }
  email = (email ?? emailColumn?.text)?.trim();

  const phoneColumn = columns[MONDAY_COL.telephone];
  let phoneRaw;
  try {
    phoneRaw = JSON.parse(phoneColumn?.value ?? "null")?.phone;
  } catch {
    phoneRaw = undefined;
  }
  const phone = toE164French(phoneRaw ?? phoneColumn?.text);

  const manualRacText = columns[MONDAY_COL_RAC]?.text?.trim();
  let racAmount;
  if (manualRacText) {
    racAmount = Number(manualRacText);
  } else {
    racAmount = computeResteACharge({
      precarite: columns[MONDAY_COL_PRECARITE]?.text?.trim(),
      zone: columns[MONDAY_COL_ZONE]?.text?.trim(),
      marque: columns[MONDAY_COL_MARQUE]?.text?.trim(),
    });
  }

  return { name: item.name, email, phone, racAmount };
}

// Envoie un SMS via l'API Twilio (REST directe, comme pour Monday/Gmail —
// pas besoin du SDK complet pour un seul appel). N'écrit jamais l'échec
// dans la réponse HTTP appelante : un SMS raté ne doit pas faire échouer
// l'envoi du mail qui l'accompagne.
async function sendTwilioSms({ to, body, accountSid, authToken }) {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const params = new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error("Échec de l'envoi du SMS Twilio", { to, error: JSON.stringify(responseBody) });
  }
}

// Signal visible sur l'item Monday (au lieu d'un simple log invisible côté
// serveur) quand l'envoi automatique est bloqué : la commerciale voit tout
// de suite pourquoi rien n'est parti.
async function postMondayUpdate(itemId, body, mondayToken) {
  const mutation = `mutation ($itemId: ID!, $body: String!) {
    create_update(item_id: $itemId, body: $body) { id }
  }`;
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: mondayToken,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query: mutation, variables: { itemId: String(itemId), body } }),
  });
  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok || responseBody.errors?.length) {
    logger.error("Échec de la publication du commentaire Monday", { itemId, error: JSON.stringify(responseBody) });
  }
}

// Bascule visible directement dans le tableau (pas besoin d'ouvrir l'item) :
// la colonne "📧 Mail ( Auto )" elle-même passe sur cette étiquette rouge
// quand l'envoi est bloqué. Rechange plus tard la valeur sur un des vrais
// modèles ré-émet un nouveau webhook, mais "⚠️ infos manquantes" ne
// correspond à aucune clé de MONDAY_EMAIL_TEMPLATES : pas de boucle.
const MONDAY_LABEL_INFOS_MANQUANTES = "⚠️ Infos manquantes";
async function setMondayStatusLabel(itemId, columnId, label, mondayToken) {
  const mutation = `mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
    change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id }
  }`;
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: mondayToken,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        boardId: MONDAY_BOARD_ID,
        itemId: String(itemId),
        columnId,
        value: JSON.stringify({ label }),
      },
    }),
  });
  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok || responseBody.errors?.length) {
    logger.error("Échec du changement d'étiquette Monday", { itemId, columnId, error: JSON.stringify(responseBody) });
  }
}

// Colonne "📅 Dernier mail envoyé" : mise à jour à chaque envoi réussi
// (relance, confirmation, demande de document), pour voir d'un coup d'œil
// dans le tableau quand le lead a été recontacté pour la dernière fois.
const MONDAY_COL_DERNIER_MAIL = "date_mm7ed3c9";
async function setMondayDateColumn(itemId, columnId, mondayToken) {
  const mutation = `mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
    change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id }
  }`;
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: mondayToken,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        boardId: MONDAY_BOARD_ID,
        itemId: String(itemId),
        columnId,
        value: JSON.stringify({ date: parisDate() }),
      },
    }),
  });
  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok || responseBody.errors?.length) {
    logger.error("Échec de la mise à jour de la date du dernier mail Monday", { itemId, columnId, error: JSON.stringify(responseBody) });
  }
}

exports.sendMondayEmailTemplate = onRequest(
  {
    secrets: [
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REFRESH_TOKEN,
      GMAIL_SENDER_EMAIL,
      MONDAY_API_TOKEN,
      MONDAY_WEBHOOK_SECRET,
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
    ],
    region: "europe-west9",
  },
  async (req, res) => {
    // Poignée de main de vérification Monday : à la création du webhook,
    // Monday poste { challenge: "..." } et attend la même valeur en retour
    // avant d'activer réellement le webhook.
    if (req.body?.challenge) {
      res.json({ challenge: req.body.challenge });
      return;
    }

    if (req.query.key !== MONDAY_WEBHOOK_SECRET.value()) {
      res.status(403).send("forbidden");
      return;
    }

    const event = req.body?.event;
    if (!event || event.columnId !== MONDAY_TEMPLATE_COLUMN_ID) {
      logger.info("Webhook Monday ignoré (colonne non concernée)", {
        columnId: event?.columnId,
        pulseId: event?.pulseId,
      });
      res.status(200).send("ignored");
      return;
    }

    const label = String(event.value?.label?.text ?? "").trim().toLowerCase();
    const template = MONDAY_EMAIL_TEMPLATES[label];
    if (!template) {
      logger.info("Modèle mail Monday inconnu, envoi ignoré", { label });
      res.status(200).send("unknown template");
      return;
    }

    try {
      const { name, email, phone, racAmount } = await fetchMondayItemContact(event.pulseId, MONDAY_API_TOKEN.value());
      if (!email) {
        logger.warn("Item Monday sans e-mail, envoi de modèle ignoré", { pulseId: event.pulseId });
        await Promise.all([
          postMondayUpdate(
            event.pulseId,
            "⚠️ E-mail non envoyé : aucune adresse e-mail renseignée sur cet item.",
            MONDAY_API_TOKEN.value(),
          ),
          setMondayStatusLabel(
            event.pulseId,
            MONDAY_TEMPLATE_COLUMN_ID,
            MONDAY_LABEL_INFOS_MANQUANTES,
            MONDAY_API_TOKEN.value(),
          ),
        ]);
        res.status(200).send("no email");
        return;
      }
      if (template.requiresResolvedRac && racAmount === undefined) {
        logger.warn(
          "Impossible de déterminer le reste à charge (précarité/zone/marque incomplets ou hors barème, et pas de RAC manuel), envoi ignoré",
          { pulseId: event.pulseId, label },
        );
        await Promise.all([
          postMondayUpdate(
            event.pulseId,
            "⚠️ E-mail non envoyé : renseignez 🏷️ Précarité + 🌡️ Zone + 🔧 Marque (ou 💶 RAC client à la main), puis rechoisissez l'étiquette \"Confirmation + fiche technique\".",
            MONDAY_API_TOKEN.value(),
          ),
          setMondayStatusLabel(
            event.pulseId,
            MONDAY_TEMPLATE_COLUMN_ID,
            MONDAY_LABEL_INFOS_MANQUANTES,
            MONDAY_API_TOKEN.value(),
          ),
        ]);
        res.status(200).send("rac unresolved");
        return;
      }
      const rac = racAmount > 0 ? racAmount.toLocaleString("fr-FR") : undefined;
      const nomComplet = String(name ?? "").trim();

      const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
      oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const raw = buildRawMessageWithAttachment({
        to: email,
        from: GMAIL_SENDER_EMAIL.value(),
        subject: template.subject,
        html: template.buildHtml({ nomComplet, rac }),
        attachments: template.attachments,
      });

      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      logger.info("E-mail modèle Monday envoyé", { pulseId: event.pulseId, label, to: email });

      // Le SMS accompagne le mail mais ne doit jamais le faire échouer :
      // sendTwilioSms journalise ses propres erreurs sans les relancer.
      if (phone && template.buildSms) {
        await sendTwilioSms({
          to: phone,
          body: template.buildSms({ rac }),
          accountSid: TWILIO_ACCOUNT_SID.value(),
          authToken: TWILIO_AUTH_TOKEN.value(),
        });
        logger.info("SMS modèle Monday envoyé", { pulseId: event.pulseId, label, to: phone });
      } else if (template.buildSms) {
        logger.warn("Item Monday sans téléphone, SMS ignoré", { pulseId: event.pulseId, label });
      }

      await setMondayDateColumn(event.pulseId, MONDAY_COL_DERNIER_MAIL, MONDAY_API_TOKEN.value());
      res.status(200).send("sent");
    } catch (err) {
      logger.error("Échec de l'envoi du modèle mail Monday", { pulseId: event.pulseId, label, error: err.message });
      res.status(500).send("error");
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

// ─────────────────────────────────────────────────────────────────────────
// Campagne de réactivation par e-mail (contacts LED du groupe « 0/ Contacts »).
// Déclenchée en créant un document dans « campaign_runs » (voir
// functions/scripts/campaign-run.js, lancé par le workflow GitHub
// « Campagne réactivation ») avec un champ mode :
//   • preview : calcule la liste des destinataires, n'envoie rien ;
//   • test    : envoie le mail à testEmail uniquement ;
//   • send    : envoie aux destinataires pas encore servis, par lots (max).
// Chaque envoi est tracé dans « campaign_sends » : relancer « send » ne
// renvoie jamais deux fois le même mail. Les désinscrits (« email_optouts »)
// sont toujours exclus.
// ─────────────────────────────────────────────────────────────────────────
const crypto = require("node:crypto");
const { FieldValue } = require("firebase-admin/firestore");

const REACTIVATION_CAMPAIGN_ID = "led-2026-09";
const REACTIVATION_LANDING_URL = `${SITE_URL}/aides-pac`;
const REACTIVATION_GROUP_ID = "group_mm6vrsfd"; // « 0/ Contacts »
const REACTIVATION_SUBJECT = "Suite à nos échanges sur l'éclairage LED";
// Fiches jamais abouties uniquement : on n'écrit pas aux dossiers en cours,
// aux refus ni aux non-éligibles.
const REACTIVATION_ALLOWED_STATUSES = new Set([
  "",
  "à appeler",
  "nrp",
  "nrp 2",
  "a relancer",
  "rappel demandé",
  "me rapelle",
  "manque les info",
  "🆕 nouveau lead",
]);
const INTERNAL_EMAILS = new Set([
  "contact@ip5energie.com",
  "jonassitbon8@gmail.com",
  "alexis.sitbon@gmail.com",
  "carol.sitbon05@gmail.com",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const emailKey = (email) => crypto.createHash("sha256").update(email).digest("hex");

function unsubscribeToken(email, secret) {
  return crypto.createHmac("sha256", secret).update(email).digest("hex").slice(0, 32);
}

function unsubscribeUrl(email, secret) {
  const e = Buffer.from(email, "utf-8").toString("base64url");
  return `${SITE_URL}/desinscription?e=${e}&t=${unsubscribeToken(email, secret)}`;
}

function buildReactivationLedEmailHtml({ unsubscribe }) {
  return buildBrandedEmailShell({
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Bonjour,</p>
      <p style="margin:0 0 12px 0;">
        Nous avions échangé il y a quelque temps au sujet de l'éclairage LED
        financé par les Certificats d'Économies d'Énergie (CEE), et nous vous
        avions dit que nous reviendrions vers vous en cas de nouveauté.
      </p>
      <p style="margin:0 0 12px 0;">
        IP5 Énergie accompagne aujourd'hui d'autres travaux financés par les
        CEE, notamment l'installation d'une pompe à chaleur pour votre
        logement, avec jusqu'à 100&nbsp;% d'aides selon votre éligibilité
        (MaPrimeRénov' et CEE).
      </p>
      <p style="margin:0 0 12px 0;">
        Si vous chauffez votre maison au fioul ou au gaz, vous pouvez faire
        la simulation gratuite en 30 secondes&nbsp;:
      </p>
      <p style="margin:0 0 20px 0;">
        <a href="${REACTIVATION_LANDING_URL}" style="display:inline-block; background:#2b5a8f; color:#ffffff; text-decoration:none; padding:12px 22px; border-radius:8px; font-weight:bold;">Faire ma simulation</a>
      </p>
      <p style="margin:0 0 12px 0;">
        Vous pouvez aussi nous appeler aux numéros ci-dessous, ou simplement
        répondre à ce mail.
      </p>
      <p style="margin:0 0 20px 0;">
        Bien cordialement,<br/>
        IP5 Énergie
      </p>
      <p style="margin:0; color:#8a94a3; font-size:12px; line-height:1.5;">
        Vous recevez ce message suite à nos échanges concernant l'éclairage LED.
        Pour ne plus recevoir nos messages,
        <a href="${unsubscribe}" style="color:#8a94a3;">cliquez ici</a>.
      </p>
    `,
  });
}

function buildReactivationLedEmailText({ unsubscribe }) {
  return [
    "Bonjour,",
    "",
    "Nous avions échangé il y a quelque temps au sujet de l'éclairage LED financé par les Certificats d'Économies d'Énergie (CEE), et nous vous avions dit que nous reviendrions vers vous en cas de nouveauté.",
    "",
    "IP5 Énergie accompagne aujourd'hui d'autres travaux financés par les CEE, notamment l'installation d'une pompe à chaleur pour votre logement, avec jusqu'à 100 % d'aides selon votre éligibilité (MaPrimeRénov' et CEE).",
    "",
    "Si vous chauffez votre maison au fioul ou au gaz, vous pouvez faire la simulation gratuite en 30 secondes :",
    REACTIVATION_LANDING_URL,
    "",
    "Vous pouvez aussi nous appeler au 07 49 52 52 67 ou au 06 95 92 04 09, ou simplement répondre à ce mail.",
    "",
    "Bien cordialement,",
    "IP5 Énergie",
    "",
    `Pour ne plus recevoir nos messages : ${unsubscribe}`,
  ].join("\r\n");
}

// Version texte + HTML (multipart/alternative) avec en-tête List-Unsubscribe :
// deux signaux que les filtres anti-spam attendent d'un envoi groupé propre.
function buildRawAlternativeMessage({ to, from, subject, html, text, unsubscribe }) {
  const boundary = `alt_${crypto.randomBytes(12).toString("hex")}`;
  const b64 = (s) => Buffer.from(s, "utf-8").toString("base64").replace(/.{76}/g, "$&\r\n");
  const message = [
    `From: ${encodeHeaderWord("IP5 Énergie")} <${from}>`,
    `To: ${to}`,
    `Reply-To: ${from}`,
    `Subject: ${encodeHeaderWord(subject)}`,
    `List-Unsubscribe: <${unsubscribe}>, <mailto:${from}?subject=STOP>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(html),
    `--${boundary}--`,
  ].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

async function mondayQuery(query, variables, mondayToken) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { Authorization: mondayToken, "Content-Type": "application/json", "API-Version": "2024-10" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors?.length) throw new Error(`Monday: ${JSON.stringify(body.errors ?? body)}`);
  return body.data;
}

async function fetchAllBoardItems(mondayToken) {
  const fields = `cursor items { id name group { id } column_values(ids: ["${MONDAY_COL.statutAppel}", "email_mm2qmb9n"]) { id text } }`;
  let data = await mondayQuery(
    `query ($b: ID!) { boards(ids: [$b]) { items_page(limit: 500) { ${fields} } } }`,
    { b: MONDAY_BOARD_ID },
    mondayToken,
  );
  let page = data.boards[0].items_page;
  const items = [...page.items];
  while (page.cursor) {
    data = await mondayQuery(`query ($c: String!) { next_items_page(limit: 500, cursor: $c) { ${fields} } }`, { c: page.cursor }, mondayToken);
    page = data.next_items_page;
    items.push(...page.items);
  }
  return items;
}

async function buildReactivationRecipients(mondayToken) {
  const items = await fetchAllBoardItems(mondayToken);
  const col = (it, id) => (it.column_values.find((c) => c.id === id)?.text ?? "").trim();
  // Une adresse présente dans un dossier en cours (autre groupe) n'est jamais
  // relancée comme un « ancien contact ».
  const activeEmails = new Set(
    items
      .filter((it) => it.group.id !== REACTIVATION_GROUP_ID)
      .map((it) => col(it, "email_mm2qmb9n").toLowerCase())
      .filter(Boolean),
  );
  const optouts = new Set((await db.collection("email_optouts").select().get()).docs.map((d) => d.id));

  const excluded = { sansEmail: 0, emailInvalide: 0, statut: 0, dossierEnCours: 0, interne: 0, doublon: 0, desinscrit: 0 };
  const seen = new Set();
  const list = [];
  for (const it of items) {
    if (it.group.id !== REACTIVATION_GROUP_ID) continue;
    const email = col(it, "email_mm2qmb9n").toLowerCase();
    if (!email) { excluded.sansEmail++; continue; }
    if (!EMAIL_RE.test(email)) { excluded.emailInvalide++; continue; }
    if (!REACTIVATION_ALLOWED_STATUSES.has(col(it, MONDAY_COL.statutAppel).toLowerCase())) { excluded.statut++; continue; }
    if (INTERNAL_EMAILS.has(email)) { excluded.interne++; continue; }
    if (activeEmails.has(email)) { excluded.dossierEnCours++; continue; }
    if (seen.has(email)) { excluded.doublon++; continue; }
    if (optouts.has(emailKey(email))) { excluded.desinscrit++; continue; }
    seen.add(email);
    list.push({ itemId: it.id, name: it.name, email });
  }
  return { list, excluded };
}

const maskEmail = (email) => email.replace(/^(.{2})[^@]*/, "$1***");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

exports.runReactivationCampaign = onDocumentCreated(
  {
    document: "campaign_runs/{runId}",
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL, MONDAY_API_TOKEN, MONDAY_WEBHOOK_SECRET],
    region: "europe-west9",
    timeoutSeconds: 540,
    memory: "512MiB",
    retry: false,
  },
  async (event) => {
    const ref = event.data?.ref;
    const { mode, testEmail, max = 150 } = event.data?.data() ?? {};
    const startedAt = Date.now();
    try {
      const secret = MONDAY_WEBHOOK_SECRET.value();
      const from = GMAIL_SENDER_EMAIL.value();
      const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
      oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const sendTo = async (to) => {
        const unsubscribe = unsubscribeUrl(to, secret);
        const raw = buildRawAlternativeMessage({
          to,
          from,
          subject: REACTIVATION_SUBJECT,
          html: buildReactivationLedEmailHtml({ unsubscribe }),
          text: buildReactivationLedEmailText({ unsubscribe }),
          unsubscribe,
        });
        await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      };

      if (mode === "test") {
        const to = String(testEmail ?? "").trim().toLowerCase();
        if (!EMAIL_RE.test(to)) throw new Error("testEmail invalide");
        await sendTo(to);
        await ref.update({ status: "done", result: { test: to } });
        return;
      }

      const { list, excluded } = await buildReactivationRecipients(MONDAY_API_TOKEN.value());
      const sentSnap = await db.collection("campaign_sends").where("campaign", "==", REACTIVATION_CAMPAIGN_ID).select().get();
      const alreadySent = new Set(sentSnap.docs.map((d) => d.id));
      const pending = list.filter((r) => !alreadySent.has(`${REACTIVATION_CAMPAIGN_ID}_${emailKey(r.email)}`));

      if (mode === "preview") {
        await ref.update({
          status: "done",
          result: {
            destinataires: list.length,
            dejaEnvoyes: list.length - pending.length,
            restantAEnvoyer: pending.length,
            exclus: excluded,
            apercu: pending.slice(0, 40).map((r) => `${r.name} — ${maskEmail(r.email)}`),
          },
        });
        return;
      }

      if (mode !== "send") throw new Error(`mode inconnu : ${mode}`);
      let sent = 0;
      const errors = [];
      for (const r of pending) {
        if (sent >= Number(max) || Date.now() - startedAt > 450_000) break;
        try {
          await sendTo(r.email);
          await db.doc(`campaign_sends/${REACTIVATION_CAMPAIGN_ID}_${emailKey(r.email)}`).set({
            campaign: REACTIVATION_CAMPAIGN_ID,
            itemId: r.itemId,
            sentAt: FieldValue.serverTimestamp(),
          });
          await setMondayDateColumn(r.itemId, MONDAY_COL_DERNIER_MAIL, MONDAY_API_TOKEN.value());
          sent++;
        } catch (err) {
          errors.push(`${maskEmail(r.email)} : ${err.message}`);
          if (errors.length >= 5) break;
        }
        // Rythme volontairement lent : un envoi groupé trop rapide est un
        // signal de spam pour Gmail et les messageries des destinataires.
        await sleep(2500);
      }
      await ref.update({ status: "done", result: { envoyes: sent, restants: pending.length - sent, erreurs: errors } });
    } catch (err) {
      logger.error("Campagne réactivation en échec", { error: err.message });
      await ref?.update({ status: "error", error: err.message });
    }
  },
);

exports.unsubscribeEmail = onRequest(
  {
    secrets: [MONDAY_WEBHOOK_SECRET],
    region: "europe-west9",
    cors: [SITE_URL, "https://ip5-energie.web.app", "https://www.ip5energie.fr"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("method not allowed");
      return;
    }
    let email;
    try {
      email = Buffer.from(String(req.body?.e ?? ""), "base64url").toString("utf-8").trim().toLowerCase();
    } catch {
      email = "";
    }
    const expected = EMAIL_RE.test(email) ? unsubscribeToken(email, MONDAY_WEBHOOK_SECRET.value()) : "";
    const given = String(req.body?.t ?? "");
    if (!expected || given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
      res.status(400).send("invalid");
      return;
    }
    await db.doc(`email_optouts/${emailKey(email)}`).set({ at: FieldValue.serverTimestamp() }, { merge: true });
    logger.info("Désinscription e-mail enregistrée");
    res.status(200).send("ok");
  },
);
