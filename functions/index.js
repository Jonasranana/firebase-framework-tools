const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { google } = require("googleapis");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
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
const PRAIMY_API_KEY = defineSecret("PRAIMY_API_KEY");

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
    const fileData = (attachment.content ?? readFileSync(attachment.path)).toString("base64");
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
      <p style="font-size:13px; color:#6b7280; margin:0 0 16px 0;">Reçu à l'instant via ${data.via || "le site IP5 Énergie"}.</p>
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

// SMS de confirmation envoyé dès qu'une demande arrive du site (en plus du mail de
// bienvenue). Un seul SMS par demande, même si la fonction est rejouée : un document
// repère « lead_sms_sent/<id> » est créé avant l'envoi (create() échoue s'il existe).
exports.sendLeadWelcomeSms = onDocumentCreated(
  {
    document: "ip5_leads/{leadId}",
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN],
    region: "europe-west9",
  },
  async (event) => {
    const data = event.data?.data();
    const leadId = event.params.leadId;
    if (!data) return;
    // Campagnes de réactivation (anciens contacts relancés) : pas de SMS de bienvenue.
    if (String(data.source ?? "").startsWith("reactivation")) return;
    const to = toE164French(data.phone);
    if (!to || !to.startsWith("+")) {
      logger.info("Lead sans numéro valide, SMS de confirmation ignoré", { leadId });
      return;
    }
    const marker = db.doc(`lead_sms_sent/${leadId}`);
    try {
      await marker.create({ at: new Date().toISOString(), to });
    } catch (err) {
      if (err.code === 6) return; // déjà envoyé
      throw err;
    }
    const prenom = String(data.firstName ?? String(data.name ?? "").split(/\s+/)[0] ?? "").trim();
    const body = `IP5 Énergie : ${prenom ? `bonjour ${prenom}, ` : ""}nous avons bien reçu votre demande. Un conseiller va vous rappeler. Pour nous joindre : ${SMS_PHONE_NUMBERS}.`;
    const ok = await sendTwilioSms({ to, body, accountSid: TWILIO_ACCOUNT_SID.value(), authToken: TWILIO_AUTH_TOKEN.value() });
    if (!ok) {
      await marker.delete().catch(() => {});
      logger.error("SMS de confirmation non envoyé", { leadId });
      return;
    }
    logger.info("SMS de confirmation lead envoyé", { leadId });
    // Trace dans le chat de la fiche CRM (si la fiche existe déjà ; jamais de création ici).
    try {
      await db.doc(`crm_leads/${leadId}`).update({
        notes: FieldValue.arrayUnion({
          id: Math.random().toString(36).slice(2, 10),
          text: `💬 SMS envoyé : « ${body} »`,
          by: "automation",
          at: new Date().toISOString(),
          kind: "message",
        }),
      });
    } catch {
      /* la fiche CRM n'est pas encore créée : pas de trace, sans importance */
    }
  },
);

// Demandes incomplètes : un visiteur qui a donné ses coordonnées (nom, téléphone, e-mail) et
// accepté d'être recontacté, puis n'a pas fini le simulateur, a une fiche dans « Nouveaux leads »
// de Pac Pac, avec un message « Demande incomplète » dans la bulle (historique de la fiche), mise à
// jour à chaque réponse. Sans coordonnées complètes et sans accord, rien n'est enregistré (pas de
// démarchage de personnes qui n'ont rien demandé). La fiche part à la corbeille quand la demande
// complète arrive (voir copyLeadToCrm), la vraie fiche prenant sa place.
const TRACK_LABELS = {
  housingType: "Logement",
  ownerStatus: "Propriétaire",
  currentHeating: "Chauffage",
  department: "Département",
  householdSize: "Foyer",
  incomeBracket: "Revenus",
  projectTiming: "Échéance",
  projectType: "Projet",
};
let incompleteSetupDone = false;
async function cleanupOldIncomplete() {
  if (incompleteSetupDone) return;
  // Anciennes fiches anonymes (ancien tableau « Demandes incomplètes ») : à la corbeille (30 jours).
  const old = await db.collection("crm_leads").where("board", "==", "board_incomplets").get();
  await Promise.all(
    old.docs.filter((d) => !d.get("deletedAt")).map((d) =>
      d.ref.update({ deletedAt: FieldValue.serverTimestamp(), deletedBy: "fiche sans coordonnées", updatedBy: "site incomplet" }),
    ),
  );
  incompleteSetupDone = true;
}

exports.trackSimulatorStep = onRequest({ region: "europe-west9", cors: true, maxInstances: 5 }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(204).end();
      return;
    }
    let b = req.body;
    if (typeof b === "string") b = JSON.parse(b);
    const sid = String(b?.sid ?? "");
    if (!/^[a-z0-9]{16,40}$/.test(sid)) {
      res.status(400).end();
      return;
    }
    const answers = b.answers && typeof b.answers === "object" ? b.answers : {};
    const firstName = String(answers.firstName ?? "").trim().slice(0, 60);
    const lastName = String(answers.lastName ?? "").trim().slice(0, 60);
    const phone = String(answers.phone ?? "").trim().slice(0, 30);
    const email = String(answers.email ?? "").trim().toLowerCase().slice(0, 120);
    const hasContact =
      answers.consent === true &&
      !answers.company &&
      firstName.length >= 2 &&
      lastName.length >= 2 &&
      /^(?:\+33|0)\s*[1-9](?:[\s.\-]*\d{2}){4}$/.test(phone) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (!hasContact) {
      res.status(204).end();
      return;
    }
    const details = {};
    for (const [k, label] of Object.entries(TRACK_LABELS)) {
      const v = String(answers[k] ?? "").trim().slice(0, 80);
      if (v) details[label] = v;
    }
    const surface = Number(answers.surface);
    if (surface > 0 && surface < 5000 && details["Logement"]) details["Surface"] = `${Math.round(surface)} m²`;
    const step = Math.max(1, Math.min(12, Number(b.step) || 1));
    details["Progression"] = `Arrêté à l'étape ${step} sur 8 du simulateur`;
    const source = String(b.source ?? "site").slice(0, 60);

    await cleanupOldIncomplete();
    const ref = db.doc(`crm_leads/site_${sid}`);
    const contact = { name: `${firstName} ${lastName}`, phone, email, postalCode: String(answers.department ?? "").slice(0, 2) };
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        if (snap.get("deletedAt")) return; // demande déjà complétée
        tx.update(ref, { ...contact, details, updatedAt: FieldValue.serverTimestamp(), updatedBy: "site incomplet" });
      } else {
        tx.create(ref, {
          ...contact,
          city: "",
          type: crmTypeForSource({ source }),
          source: `Site (incomplet) : ${source}`,
          projet: String(answers.projectType ?? ""),
          status: "nouveau_lead",
          group: "nouveaux",
          rappelLe: "",
          details,
          notes: [
            {
              id: `inc${sid.slice(0, 6)}`,
              text: "⚠️ Demande incomplète : coordonnées laissées sur le site, mais le simulateur n'a pas été terminé. Les réponses déjà données sont dans la fiche (Progression = dernière étape atteinte).",
              by: "Site",
              at: new Date().toISOString(),
              kind: "note",
            },
          ],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: "site incomplet",
        });
      }
    });
  } catch (err) {
    logger.warn("trackSimulatorStep", { error: err.message });
  }
  res.status(204).end();
});

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

// CRM maison (onglet Leads de /admin) : chaque lead du site est copié dans
// crm_leads avec le même identifiant que dans ip5_leads. Tourne en parallèle
// de Monday pendant la période de transition ; une erreur ici ne doit jamais
// toucher les autres déclencheurs (mails, Monday), d'où le try/catch.
const crmTypeForSource = (f) => {
  const s = `${f.source ?? ""} ${f.projectType ?? ""}`.toLowerCase();
  if (s.includes("gonflage")) return "Gonflage";
  if (s.includes("sms")) return "SMS";
  if (s.includes("solaire")) return "Solaire";
  if (s.includes("pac") || s.includes("pompe") || s.includes("chaleur")) return "PAC";
  return "Autre";
};

exports.copyLeadToCrm = onDocumentCreated(
  {
    document: "ip5_leads/{leadId}",
    region: "europe-west9",
  },
  async (event) => {
    const f = event.data?.data();
    const leadId = event.params.leadId;
    if (!f) return;

    const details = {
      "Revenus": f.incomeBracket,
      "Foyer": f.householdSize,
      "Chauffage": f.currentHeating,
      "Surface": f.surface ? `${f.surface} m²` : "",
      "Logement": f.housingType,
      "Propriétaire": f.ownerStatus,
      "Échéance": f.projectTiming,
      "Demande": f.requestType,
      "Résultat simulation": f.simulationResult,
      "Contact pro": f.contact,
      "Type de site": f.typeSite,
      "Véhicules": f.nbVehicules,
      "Message": f.message,
    };
    for (const k of Object.keys(details)) {
      const v = String(details[k] ?? "").trim();
      if (v) details[k] = v;
      else delete details[k];
    }

    try {
      // create() échoue si la fiche existe déjà : pas d'écrasement des notes
      // si l'événement est rejoué.
      await db.doc(`crm_leads/${leadId}`).create({
        name: String(f.name ?? "").trim(),
        phone: String(f.phone ?? "").trim(),
        email: String(f.email ?? "").trim().toLowerCase(),
        postalCode: String(f.postalCode ?? f.department ?? "").trim(),
        city: "",
        type: crmTypeForSource(f),
        source: String(f.source ?? "site-internet"),
        projet: String(f.projectType ?? ""),
        status: "nouveau_lead",
        group: "nouveaux",
        rappelLe: "",
        details,
        notes: [],
        createdAt: f.createdAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "",
      });
      logger.info("Lead copié dans le CRM", { leadId });
    } catch (err) {
      if (err.code !== 6) logger.error("Échec de la copie du lead dans le CRM", { leadId, error: err.message });
    }
    // La demande est maintenant complète : la fiche « incomplète » de la même visite part à la corbeille (30 jours).
    const sid = String(f.sessionId ?? "");
    if (/^[a-z0-9]{16,40}$/.test(sid)) {
      await db
        .doc(`crm_leads/site_${sid}`)
        .update({ deletedAt: FieldValue.serverTimestamp(), deletedBy: "demande complétée", updatedBy: "site incomplet" })
        .catch(() => {});
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

// Mail libre écrit depuis le CRM : le message, puis la même signature que celle de la
// boîte contact@ dans Gmail (logo, nom, société, téléphone, adresse).
function buildFreeMailHtml({ bodyText }) {
  const logoUrl = `${SITE_URL}/images/email/logo-ip5-energie.png`;
  const PURPLE = "#8e7cc3";
  return `<!DOCTYPE html>
<html lang="fr"><body style="margin:0; padding:0; background:#ffffff; font-family:Arial,Helvetica,sans-serif; color:#202124;">
<div style="padding:16px 24px; max-width:640px; font-size:14px; line-height:1.6;">
  <div style="white-space:pre-wrap;">${escapeHtmlText(bodyText)}</div>
  <div style="margin-top:28px; color:#202124;">--</div>
  <img src="${logoUrl}" width="120" alt="IP5 Énergie" style="display:block; height:auto; margin:8px 0;" />
  <div style="font-size:14px; font-weight:bold; line-height:1.7; color:${PURPLE};">
    Carole Sitbon<br/>
    IP5 Énergie<br/>
    06 95 92 04 09<br/>
    45 rue de Maubeuge, 75009 Paris
  </div>
</div></body></html>`;
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
    : `sous réserve de votre éligibilité`;
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
  return res.ok;
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

// ── CRM maison : envoi de mail / SMS depuis la fiche lead ────────────────
// Réutilise les modèles de MONDAY_EMAIL_TEMPLATES. Appelable uniquement par
// les comptes Google autorisés (même liste blanche que client/src/pages/
// OutilDevis.tsx — à tenir à jour des deux côtés). L'envoi est tracé dans
// les notes de la fiche.
const CRM_ALLOWED_EMAILS = [
  "jonassitbon8@gmail.com",
  "alexis.sitbon@gmail.com",
  "carol.sitbon05@gmail.com",
];

// Membre du CRM : administrateur d'origine (liste ci-dessus) ou personne
// ajoutée depuis la page « Équipe » (revendication crm sur son compte).
const isCrmMember = (request) => {
  const t = request.auth?.token;
  if (!t?.email_verified) return false;
  return CRM_ALLOWED_EMAILS.includes(String(t.email ?? "").toLowerCase()) || t.crm === true;
};

// Modèles proposés dans le CRM (clé = libellé Monday). « confirmation +
// fiche technique » est exclu : il exige un reste à charge calculé.
const crmTemplates = () =>
  Object.entries(MONDAY_EMAIL_TEMPLATES)
    .filter(([, t]) => !t.requiresResolvedRac)
    .map(([key, t]) => ({ key, subject: t.subject, sms: t.buildSms ? t.buildSms({}) : "" }));

exports.sendLeadMessage = onCall(
  {
    secrets: [
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REFRESH_TOKEN,
      GMAIL_SENDER_EMAIL,
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
    ],
    region: "europe-west9",
  },
  async (request) => {
    const caller = String(request.auth?.token?.email ?? "").toLowerCase();
    if (!isCrmMember(request)) {
      throw new HttpsError("permission-denied", "Accès refusé.");
    }
    const { leadId, channel, template, text, subject: freeSubject, body: freeBody, files: freeFiles } = request.data ?? {};
    if (typeof leadId !== "string" || !leadId || !["mail", "sms"].includes(channel)) {
      throw new HttpsError("invalid-argument", "Requête invalide.");
    }
    const ref = db.doc(`crm_leads/${leadId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Lead introuvable.");
    const lead = snap.data();
    const nomComplet = String(lead.name ?? "").trim();
    const tpl = template ? MONDAY_EMAIL_TEMPLATES[template] : undefined;
    if (template && (!tpl || tpl.requiresResolvedRac)) {
      throw new HttpsError("invalid-argument", "Modèle inconnu.");
    }

    let summary;
    if (channel === "mail") {
      const to = String(lead.email ?? "").trim();
      const customSubject = String(freeSubject ?? "").trim().slice(0, 150);
      const customBody = String(freeBody ?? "").trim().slice(0, 5000);
      if (!tpl && (!customSubject || !customBody)) {
        throw new HttpsError("invalid-argument", "Choisissez un modèle ou écrivez un objet et un message.");
      }
      if (!to) throw new HttpsError("failed-precondition", "Ce lead n'a pas d'adresse e-mail.");
      // Pièces jointes (mail libre) : 5 fichiers et 6 Mo au total au maximum.
      const customAttachments = [];
      if (!tpl && Array.isArray(freeFiles)) {
        let total = 0;
        for (const f of freeFiles.slice(0, 5)) {
          const content = Buffer.from(String(f?.data ?? ""), "base64");
          total += content.length;
          const filename = String(f?.name ?? "fichier").replace(/[^\w .()\-À-ÿ]/g, "_").slice(0, 100) || "fichier";
          if (/\.(exe|bat|cmd|com|scr|js|vbs|msi|jar)$/i.test(filename)) {
            throw new HttpsError("invalid-argument", "Ce type de fichier ne peut pas être envoyé par mail.");
          }
          if (content.length) customAttachments.push({ filename, mimeType: String(f?.type || "application/octet-stream").slice(0, 100), content });
        }
        if (total > 6 * 1024 * 1024) throw new HttpsError("invalid-argument", "Pièces jointes trop lourdes (6 Mo maximum au total).");
      }
      const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
      oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const raw = tpl
        ? buildRawMessageWithAttachment({
            to,
            from: GMAIL_SENDER_EMAIL.value(),
            subject: tpl.subject,
            html: tpl.buildHtml({ nomComplet, rac: undefined }),
            attachments: tpl.attachments,
          })
        : buildRawMessageWithAttachment({
            to,
            from: GMAIL_SENDER_EMAIL.value(),
            subject: customSubject,
            html: buildFreeMailHtml({ bodyText: customBody }),
            attachments: customAttachments,
          });
      try {
        await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      } catch (err) {
        logger.error("Échec de l'envoi du mail CRM", { leadId, error: err.message });
        throw new HttpsError("internal", "Échec de l'envoi du mail (voir les journaux).");
      }
      summary = `✉️ Mail envoyé : « ${tpl ? tpl.subject : customSubject} »${customAttachments.length ? ` (📎 ${customAttachments.map((a) => a.filename).join(", ")})` : ""}`;
    } else {
      const to = toE164French(lead.phone);
      if (!to || !to.startsWith("+")) {
        throw new HttpsError("failed-precondition", "Ce lead n'a pas de numéro valide.");
      }
      const body = String(text ?? (tpl?.buildSms ? tpl.buildSms({}) : "")).trim();
      if (!body || body.length > 480) {
        throw new HttpsError("invalid-argument", "Message vide ou trop long (480 caractères max).");
      }
      const ok = await sendTwilioSms({
        to,
        body,
        accountSid: TWILIO_ACCOUNT_SID.value(),
        authToken: TWILIO_AUTH_TOKEN.value(),
      });
      if (!ok) throw new HttpsError("internal", "Échec de l'envoi du SMS (voir les journaux).");
      summary = `💬 SMS envoyé : « ${body} »`;
    }

    await ref.update({
      notes: FieldValue.arrayUnion({
        id: Math.random().toString(36).slice(2, 10),
        text: summary,
        by: caller,
        at: new Date().toISOString(),
        kind: "message",
      }),
      lastContactAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller,
    });
    logger.info("Message CRM envoyé", { leadId, channel, template: template ?? null, by: caller });
    return { ok: true };
  },
);

exports.listLeadTemplates = onCall({ region: "europe-west9" }, async (request) => {
  const caller = String(request.auth?.token?.email ?? "").toLowerCase();
  if (!isCrmMember(request)) {
    throw new HttpsError("permission-denied", "Accès refusé.");
  }
  return { templates: crmTemplates() };
});

// Espace client (désactivé tant que le document crm_settings/client_space n'a pas { enabled: true }).
// Le client connecté (e-mail VÉRIFIÉ) ne voit que son propre dossier, sous forme d'étapes :
// jamais de notes internes ni d'autres clients.
exports.getClientSpace = onCall({ region: "europe-west9" }, async (request) => {
  const flag = await db.doc("crm_settings/client_space").get();
  if (!flag.exists || flag.get("enabled") !== true) return { enabled: false };
  const t = request.auth?.token;
  if (!t?.email || !t.email_verified) {
    throw new HttpsError("unauthenticated", "Connectez-vous avec une adresse e-mail vérifiée.");
  }
  const email = String(t.email).toLowerCase();
  const snap = await db.collection("crm_leads").where("email", "==", email).limit(10).get();
  const lead = snap.docs
    .map((d) => d.data())
    .filter((d) => !d.deletedAt && (!d.board || d.board === "leads"))
    .sort((a, b) => Number(b.createdAt?.toMillis?.() ?? 0) - Number(a.createdAt?.toMillis?.() ?? 0))[0];
  if (!lead) return { enabled: true, view: null };
  return { enabled: true, view: require("./clientSpace").buildClientView(lead) };
});

// Solde du compte Twilio (crédits restants), affiché dans le chat du CRM.
exports.getTwilioBalance = onCall(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN], region: "europe-west9" },
  async (request) => {
    if (!isCrmMember(request)) {
      throw new HttpsError("permission-denied", "Accès refusé.");
    }
    const sid = TWILIO_ACCOUNT_SID.value();
    const auth = Buffer.from(`${sid}:${TWILIO_AUTH_TOKEN.value()}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.error("Solde Twilio illisible", { status: res.status, error: JSON.stringify(data) });
      throw new HttpsError("unavailable", "Solde Twilio indisponible.");
    }
    return { balance: Number(data.balance), currency: String(data.currency ?? "") };
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

// ─── Avis clients (page /avis, QR code) ──────────────────────────────────
// Enregistre l'avis dans Firestore (ip5_avis, statut "a_moderer") et prévient
// l'équipe par mail. Rien n'est publié automatiquement sur le site. Tous les
// avis sont acceptés, bons comme mauvais : pas de filtrage selon la note.
const escapeHtmlText = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

exports.submitReview = onRequest(
  {
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL],
    region: "europe-west9",
    cors: [SITE_URL, "https://www.ip5energie.fr", "https://ip5-energie.web.app"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("method not allowed");
      return;
    }
    const b = req.body ?? {};
    if (b.company) {
      res.status(200).send("ok"); // champ piège anti-robot
      return;
    }
    const rating = Number(b.rating);
    const clip = (v, n) => String(v ?? "").trim().slice(0, n);
    const review = {
      rating,
      name: clip(b.name, 60),
      city: clip(b.city, 60),
      work: clip(b.work, 60),
      comment: clip(b.comment, 2000),
      publishConsent: b.publishConsent === true,
    };
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !review.name || review.comment.length < 3) {
      res.status(400).send("invalid");
      return;
    }
    await db.collection("ip5_avis").add({ ...review, status: "a_moderer", createdAt: FieldValue.serverTimestamp() });

    try {
      const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
      oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const contactEmail = GMAIL_SENDER_EMAIL.value();
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#122f4d">
        <p style="font-size:20px;color:#f59e0b;margin:0 0 8px">${stars}</p>
        <p><b>${escapeHtmlText(review.name)}</b>${review.city ? ` — ${escapeHtmlText(review.city)}` : ""}${review.work ? `<br>Travaux : ${escapeHtmlText(review.work)}` : ""}</p>
        <p style="white-space:pre-wrap;border-left:3px solid #2b5a8f;padding-left:10px">${escapeHtmlText(review.comment)}</p>
        <p style="color:#5b6b7d;font-size:12px">Publication sur le site autorisée : ${review.publishConsent ? "oui" : "non"}</p>
      </div>`;
      const raw = buildRawMessage({ to: contactEmail, from: contactEmail, subject: `⭐ Nouvel avis ${rating}/5 — ${review.name}`, html });
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    } catch (err) {
      logger.error("Avis enregistré mais notification mail échouée", { error: err.message });
    }
    res.status(200).send("ok");
  },
);

// Copie un lead Facebook dans le CRM maison (crm_leads). Utilisé par le
// webhook Monday ci-dessous (intégration native Meta → Monday) et par le
// webhook Meta direct (functions/metaLeads.js). Anti-doublon : un lead
// Facebook de même téléphone déjà dans le CRM n'est pas recréé, ce qui évite
// les doubles quand les deux circuits tournent en parallèle.
const phoneKeyOf = (raw) => {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("33") && d.length === 11) d = "0" + d.slice(2);
  return d;
};

async function createCrmFacebookLead({ docId, name, phone, email, postalCode, city, details, createdAt }) {
  try {
    const phoneKey = phoneKeyOf(phone);
    if (phoneKey) {
      const dup = await db
        .collection("crm_leads")
        .where("phoneKey", "==", phoneKey)
        .where("source", "==", "formulaire-facebook")
        .limit(1)
        .get();
      if (!dup.empty) return false;
    }
    await db.doc(`crm_leads/${docId}`).create({
      name: String(name ?? "").trim(),
      phone: String(phone ?? "").trim(),
      phoneKey,
      email: String(email ?? "").trim().toLowerCase(),
      postalCode: String(postalCode ?? "").trim(),
      city: String(city ?? "").trim(),
      type: "PAC",
      source: "formulaire-facebook",
      projet: "Pompe à chaleur",
      status: "nouveau_lead",
      group: "nouveaux",
      rappelLe: "",
      details: details ?? {},
      notes: [],
      createdAt: createdAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "",
    });
    return true;
  } catch (err) {
    if (err.code !== 6) logger.error("Lead Facebook : copie CRM échouée", { docId, error: err.message });
    return false;
  }
}

// ─── Alerte mail pour les leads du formulaire Facebook ───────────────────
// Les leads du formulaire instantané Meta arrivent dans Monday par
// l'intégration native Meta → Monday, sans passer par Firestore : ils ne
// déclenchent donc pas notifyNewLead. Un webhook Monday "create_item" sur le
// tableau PAC appelle cette fonction, qui envoie la même notification interne
// et complète Source + Type de lead.
// Pas de clé dans l'URL : la fonction relit l'item via l'API Monday et n'agit
// que sur un item récent du groupe « Nouveaux leads », sans Source (les leads
// du site en ont toujours une) et avec un téléphone ou un e-mail. Remplir la
// Source rend l'opération idempotente si Monday renvoie le webhook.
const FB_LEAD_SOURCE = "formulaire-facebook";
const FB_LEAD_MAX_AGE_MS = 30 * 60 * 1000;

exports.notifyMondayFacebookLead = onRequest(
  {
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL, MONDAY_API_TOKEN],
    region: "europe-west9",
  },
  async (req, res) => {
    if (req.body?.challenge) {
      res.json({ challenge: req.body.challenge });
      return;
    }
    const pulseId = req.body?.event?.pulseId;
    if (!pulseId) {
      res.status(200).send("ignored");
      return;
    }

    const token = MONDAY_API_TOKEN.value();
    const query = `query ($ids: [ID!]) {
      items(ids: $ids) {
        id name created_at
        board { id }
        group { id }
        column_values(ids: ["${MONDAY_COL.source}", "${MONDAY_COL.telephone}", "email_mm2qmb9n", "${MONDAY_COL.codePostal}"]) { id text }
      }
    }`;
    const r = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json", "API-Version": "2024-10" },
      body: JSON.stringify({ query, variables: { ids: [String(pulseId)] } }),
    });
    const item = (await r.json().catch(() => ({})))?.data?.items?.[0];
    if (!item) {
      res.status(200).send("not found");
      return;
    }
    const col = Object.fromEntries((item.column_values ?? []).map((c) => [c.id, (c.text ?? "").trim()]));
    const phone = col[MONDAY_COL.telephone];
    const email = col["email_mm2qmb9n"];
    const isFacebookLead =
      item.board?.id === MONDAY_BOARD_ID &&
      item.group?.id === MONDAY_GROUP_LEADS &&
      !col[MONDAY_COL.source] &&
      (phone || email) &&
      Date.now() - new Date(item.created_at).getTime() < FB_LEAD_MAX_AGE_MS;
    if (!isFacebookLead) {
      res.status(200).send("ignored");
      return;
    }

    const changeQuery = `mutation ($board: ID!, $item: ID!, $values: JSON!) {
      change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values) { id }
    }`;
    await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json", "API-Version": "2024-10" },
      body: JSON.stringify({
        query: changeQuery,
        variables: {
          board: MONDAY_BOARD_ID,
          item: String(pulseId),
          values: JSON.stringify({
            [MONDAY_COL.source]: FB_LEAD_SOURCE,
            [MONDAY_COL.typeLead]: { index: typeLeadIndexForSource("pac") },
          }),
        },
      }),
    }).catch((err) => logger.error("Lead Facebook : mise à jour Source/Type échouée", { pulseId, error: err.message }));

    await createCrmFacebookLead({
      docId: `monday_${pulseId}`,
      name: item.name,
      phone,
      email,
      postalCode: col[MONDAY_COL.codePostal],
      createdAt: Timestamp.fromDate(new Date(item.created_at)),
    });

    const data = {
      requestType: "Formulaire Facebook",
      name: escapeHtmlText(item.name),
      phone: escapeHtmlText(phone),
      email: escapeHtmlText(email),
      postalCode: escapeHtmlText(col[MONDAY_COL.codePostal]),
      source: FB_LEAD_SOURCE,
      via: "le formulaire Facebook",
    };
    const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
    oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const contactEmail = GMAIL_SENDER_EMAIL.value();
    const raw = buildRawMessage({
      to: contactEmail,
      from: contactEmail,
      subject: `📘 Lead Formulaire Facebook — ${item.name || "sans nom"}`,
      html: buildLeadNotificationEmailHtml(data),
    });
    try {
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      logger.info("Notification lead Facebook envoyée", { pulseId });
      res.status(200).send("sent");
    } catch (err) {
      logger.error("Échec notification lead Facebook", { pulseId, error: err.message });
      res.status(500).send("error");
    }
  },
);

// ─── Recrutement des artisans poseurs (espace /espace-pro) ───────────────
// 1) submitArtisanGrid : la page /espace-pro (sans compte) poste la grille
//    remplie avec prénom, nom, SIRET et e-mail. La fonction l'enregistre,
//    range l'artisan dans le groupe « ✅ Grilles remplies » du tableau Monday
//    de recrutement (fiche existante déplacée, sinon nouvelle fiche) et
//    envoie le PDF à IP5 et à l'artisan.
// 2) sendRecruitmentEmail : webhook Monday sur la colonne « Mail auto » du
//    tableau de recrutement ; envoie le mail correspondant (sans aucun tarif
//    IP5) avec le lien vers /espace-pro, puis met à jour « Statut ».
const ARTISAN = require("./artisanGrid");

function buildArtisanGridPdf(grid) {
  const PDFDocument = require("pdfkit");
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const NAVY = "#0f2b4a";
    const GREY = "#607083";
    const prices = grid.prices ?? {};
    const travel = grid.travel ?? {};
    const val = (v) => String(v ?? "").trim();

    doc.image(path.join(__dirname, "assets", "logo-ip5-energie.png"), 48, 40, { width: 110 });
    doc.fillColor(NAVY).fontSize(18).font("Helvetica-Bold").text("Grille de prix de pose", 200, 50, { align: "right" });
    doc.fillColor(GREY).fontSize(9).font("Helvetica").text(
      `Transmise le ${new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} via ip5energie.fr/espace-pro`,
      200, 74, { align: "right" },
    );
    doc.moveDown(3);
    doc.x = 48;

    const heading = (t) => {
      if (doc.y > 740) doc.addPage();
      doc.moveDown(0.6).fillColor(NAVY).font("Helvetica-Bold").fontSize(12).text(t, 48);
      doc.moveTo(48, doc.y + 2).lineTo(547, doc.y + 2).strokeColor("#dfe7e3").stroke();
      doc.moveDown(0.4);
    };
    const row = (label, value, unit) => {
      if (doc.y > 770) doc.addPage();
      const y = doc.y;
      doc.font("Helvetica").fontSize(10).fillColor("#1d2b3a").text(label, 56, y, { width: 330 });
      const shown = value ? `${value} ${unit ?? ""}`.trim() : "—";
      doc.font(value ? "Helvetica-Bold" : "Helvetica").fillColor(value ? NAVY : "#a0aab4")
        .text(shown, 390, y, { width: 157, align: "right" });
      doc.y = Math.max(doc.y, y + 14);
    };

    const id = grid.identity ?? {};
    heading("Artisan");
    row("Nom", `${val(id.prenom)} ${val(id.nom)}`.trim(), "");
    if (val(grid.mondayName)) row("Entreprise (Monday)", val(grid.mondayName), "");
    if (val(grid.mondayZone)) row("Zone", val(grid.mondayZone), "");
    row("Ville", val(id.ville), "");
    row("SIRET", val(id.siret), "");
    row("E-mail", val(id.email), "");
    if (val(id.telephone)) row("Téléphone", val(id.telephone), "");

    heading("Déplacements");
    for (const f of ARTISAN.TRAVEL_FIELDS) row(f.label, val(travel[f.id]), f.unit);

    for (const s of ARTISAN.ARTISAN_GRID_SECTIONS) {
      heading(s.title);
      for (const l of s.lines) row(l.label, val(prices[l.id]), l.unit);
    }

    if (val(grid.comment)) {
      heading("Commentaire");
      doc.font("Helvetica").fontSize(10).fillColor("#1d2b3a").text(val(grid.comment), 56, doc.y, { width: 490 });
    }

    doc.moveDown(1.5).font("Helvetica").fontSize(8.5).fillColor(GREY).text(
      "Prix de pose hors taxes indiqués par l'artisan. Matériel (Atlantic ; Chappée prochainement) fourni et livré par IP5 Énergie. " +
        "Document informatif, sans engagement des parties tant qu'un contrat de sous-traitance n'est pas signé.",
      48, doc.y, { width: 499 },
    );
    doc.end();
  });
}

const RECRUIT_BOARD_ID = "18435041484";
const RECRUIT_COL = {
  zone: "text_mm8232wx",
  email: "email_mm82w6sr",
  statut: "color_mm82r5tz",
  mailAuto: "color_mm8211c8",
  relance: "date_mm82zjr3",
  telephone: "text_mm825e9m",
  siret: "text_mm82j894",
  ville: "text_mm82ax38",
};
const RECRUIT_GROUP_GRILLES = "group_mm829371"; // ✅ Grilles remplies

const normalizeLabel = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function recruitButton(label) {
  return `<p style="margin:22px 0;"><a href="${SITE_URL}/espace-pro" style="display:inline-block;background:#f28c28;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:bold;font-size:16px;">${label}</a></p>`;
}
const RECRUIT_STOP = `<p style="margin:18px 0 0 0;color:#8a94a3;font-size:12px;">Vous ne souhaitez plus recevoir nos messages ? Répondez simplement « STOP » à ce mail.</p>`;

// Clés = libellés de « Mail auto » normalisés (sans accents ni ponctuation).
// « Proposition » = nouveau nom de l'étiquette « Mail 1 (avant l'appel) ».
const RECRUIT_TEMPLATES = {
  "mail 1 avant l appel": {
    statut: "Mail 1 envoye",
    relanceInDays: 3,
    subject: (zone) => `Des chantiers de pompes à chaleur${zone ? ` en ${zone}` : " dans votre secteur"} — partenariat IP5 Énergie`,
    body: () => `
      <img src="${SITE_URL}/images/email/artisans-hero.jpg" width="520" alt="Un installateur partenaire IP5 Énergie avec des propriétaires satisfaits" style="display:block; width:100%; max-width:520px; height:auto; border-radius:12px; margin:0 0 20px 0;" />
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour,</p>
      <p style="margin:0 0 12px 0;"><b>IP5 Énergie</b> accompagne des particuliers qui remplacent leur chaudière fioul ou gaz par une pompe à chaleur. Nous cherchons des <b>artisans RGE QualiPAC</b> dans votre secteur pour réaliser la pose.</p>
      <p style="margin:0 0 6px 0; font-weight:bold;">Ce que nous vous proposons :</p>
      <ul style="margin:0 0 14px 18px; padding:0;">
        <li style="margin-bottom:4px;"><b>Des chantiers près de chez vous</b> : nous trouvons les clients, vous n'avez pas à démarcher.</li>
        <li style="margin-bottom:4px;"><b>Matériel fourni et livré</b> (Atlantic, et Chappée prochainement) : vous n'avancez rien.</li>
        <li style="margin-bottom:4px;"><b>Zéro administratif</b> : dossiers d'aides, devis et suivi client sont gérés par notre équipe.</li>
        <li><b>Vos prix, vos conditions</b> : vous fixez vos tarifs de pose et votre rayon d'intervention.</li>
      </ul>
      <p style="margin:0 0 12px 0;">Pour que nous puissions vous proposer des chantiers adaptés, il suffit de remplir <b>votre grille de tarifs de pose</b> (5 minutes, sur téléphone ou ordinateur, sans créer de compte) :</p>
      ${recruitButton("Remplir ma grille de tarifs")}
      <p style="margin:0;">Nous revenons vers vous dès réception. Une question ? Répondez simplement à ce mail.<br>Bien cordialement,<br>L'équipe IP5 Énergie</p>`,
  },
  relance: {
    statut: "Relance envoyee",
    relanceInDays: 4,
    subject: () => "Partenariat pose de pompes à chaleur — IP5 Énergie",
    body: () => `
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour,</p>
      <p style="margin:0 0 12px 0;">Je reviens vers vous au sujet de notre recherche d'artisans RGE QualiPAC pour la pose de pompes à chaleur dans votre secteur (matériel fourni et livré par IP5 Énergie, dossiers gérés par nos soins).</p>
      <p style="margin:0 0 12px 0;">Si le sujet vous intéresse, vous pouvez indiquer vos tarifs de pose en quelques minutes :</p>
      ${recruitButton("Indiquer mes tarifs de pose")}
      <p style="margin:0;">Bien cordialement,<br>L'équipe IP5 Énergie</p>`,
  },
  "dernier message": {
    statut: "Dernier message envoye",
    relanceInDays: null,
    subject: () => "Dernier message — partenariat pose PAC IP5 Énergie",
    body: () => `
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour,</p>
      <p style="margin:0 0 12px 0;">Sans retour de votre part, ce sera mon dernier message. Si un partenariat pour la pose de pompes à chaleur vous intéresse plus tard, notre espace partenaires reste ouvert :</p>
      ${recruitButton("Accéder à l'espace partenaires")}
      <p style="margin:0;">Bonne continuation,<br>L'équipe IP5 Énergie</p>`,
  },
  "mail apres appel": {
    statut: null,
    relanceInDays: 3,
    subject: () => "Suite à notre échange — partenariat IP5 Énergie",
    body: () => `
      <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour,</p>
      <p style="margin:0 0 12px 0;">Merci pour notre échange téléphonique. Comme convenu, voici le lien pour indiquer vos tarifs de pose (matériel Atlantic fourni et livré par IP5 Énergie) :</p>
      ${recruitButton("Indiquer mes tarifs de pose")}
      <p style="margin:0 0 12px 0;">Une fois votre grille complétée, vous recevrez une copie en PDF et nous reviendrons vers vous rapidement.</p>
      <p style="margin:0;">Bien cordialement,<br>L'équipe IP5 Énergie</p>`,
  },
};

RECRUIT_TEMPLATES.proposition = RECRUIT_TEMPLATES["mail 1 avant l appel"];

exports.sendRecruitmentEmail = onRequest(
  {
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL, MONDAY_API_TOKEN, MONDAY_WEBHOOK_SECRET],
    region: "europe-west9",
  },
  async (req, res) => {
    if (req.body?.challenge) {
      res.json({ challenge: req.body.challenge });
      return;
    }
    if (req.query.key !== MONDAY_WEBHOOK_SECRET.value()) {
      res.status(403).send("forbidden");
      return;
    }
    const event = req.body?.event;
    if (!event || String(event.boardId) !== RECRUIT_BOARD_ID || event.columnId !== RECRUIT_COL.mailAuto) {
      res.status(200).send("ignored");
      return;
    }
    const key = normalizeLabel(event.value?.label?.text);
    const template = RECRUIT_TEMPLATES[key];
    if (!template) {
      res.status(200).send("unknown template");
      return;
    }
    const itemId = String(event.pulseId);
    const token = MONDAY_API_TOKEN.value();

    // Un même modèle n'est jamais envoyé deux fois au même artisan
    // (Monday peut renvoyer un webhook).
    let sendRef = null;
    try {
      const data = await mondayQuery(
        `query ($ids: [ID!]) { items(ids: $ids) { name column_values(ids: ["${RECRUIT_COL.zone}", "${RECRUIT_COL.email}", "${RECRUIT_COL.statut}"]) { id text value } } }`,
        { ids: [itemId] },
        token,
      );
      const item = data.items?.[0];
      const cols = Object.fromEntries((item?.column_values ?? []).map((c) => [c.id, c]));
      let email;
      try {
        email = JSON.parse(cols[RECRUIT_COL.email]?.value ?? "null")?.email;
      } catch {
        email = undefined;
      }
      email = String(email ?? cols[RECRUIT_COL.email]?.text ?? "").trim();
      const statut = normalizeLabel(cols[RECRUIT_COL.statut]?.text);
      if (!EMAIL_RE.test(email)) {
        await postMondayUpdate(itemId, "⚠️ Mail non envoyé : adresse e-mail manquante ou invalide.", token);
        res.status(200).send("no email");
        return;
      }
      if (statut === "dead" || statut === "signe" || (await db.doc(`email_optouts/${emailKey(email.toLowerCase())}`).get()).exists) {
        await postMondayUpdate(itemId, "⚠️ Mail non envoyé : artisan marqué Dead / Signé ou désinscrit.", token);
        res.status(200).send("skipped");
        return;
      }
      const zone = String(cols[RECRUIT_COL.zone]?.text ?? "").trim();

      // Un même modèle n'est jamais envoyé deux fois à la même adresse pour
      // la même fiche (Monday peut renvoyer un webhook). Changer l'e-mail de
      // la fiche permet un nouvel envoi.
      sendRef = db.doc(`recruit_sends/${itemId}_${key.replace(/ /g, "_")}_${emailKey(email.toLowerCase()).slice(0, 16)}`);
      try {
        await sendRef.create({ at: FieldValue.serverTimestamp(), template: key });
      } catch {
        sendRef = null;
        await postMondayUpdate(itemId, "ℹ️ Mail déjà envoyé à cette adresse pour ce modèle : pas de second envoi.", token);
        res.status(200).send("already sent");
        return;
      }

      const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
      oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: buildRawMessage({
            to: email,
            from: GMAIL_SENDER_EMAIL.value(),
            subject: template.subject(zone),
            html: buildBrandedEmailShell({ bodyHtml: template.body() + RECRUIT_STOP }),
          }),
        },
      });
      logger.info("Mail de recrutement artisan envoyé", { itemId, template: key });

      const values = {};
      if (template.statut) values[RECRUIT_COL.statut] = { label: template.statut };
      if (template.relanceInDays) {
        const d = new Date(Date.now() + template.relanceInDays * 86400000);
        values[RECRUIT_COL.relance] = { date: d.toISOString().slice(0, 10) };
      }
      if (Object.keys(values).length) {
        await mondayQuery(
          `mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }`,
          { b: RECRUIT_BOARD_ID, i: itemId, v: JSON.stringify(values) },
          token,
        ).catch((err) => logger.error("Recrutement : mise à jour Statut échouée", { itemId, error: err.message }));
      }
      res.status(200).send("sent");
    } catch (err) {
      if (sendRef) await sendRef.delete().catch(() => {});
      logger.error("Échec du mail de recrutement artisan", { itemId, error: err.message });
      res.status(500).send("error");
    }
  },
);

// ── CRM maison : artisans (collection crm_artisans) ─────────────────────
// Étape de suivi CRM correspondant à l'étiquette Monday posée par un modèle.
const CRM_ARTISAN_STATUS_BY_MONDAY = {
  "Mail 1 envoye": "mail1",
  "Relance envoyee": "relance",
  "Dernier message envoye": "dernier",
};

// Enregistre une grille reçue dans le CRM : met à jour la fiche existante
// (même e-mail, y compris importée de Monday) ou en crée une. Ne bloque
// jamais la réponse à l'artisan : les erreurs sont seulement journalisées.
async function upsertCrmArtisanGrid({ identity, prices, travel, comment, mondayItemId }) {
  try {
    const grille = { prices, travel, comment, submittedAt: new Date().toISOString() };
    const note = {
      id: Math.random().toString(36).slice(2, 10),
      text: "🧰 Grille de prix de pose remplie sur ip5energie.fr/espace-pro",
      by: "espace-pro",
      at: new Date().toISOString(),
      kind: "statut",
    };
    const found = await db.collection("crm_artisans").where("email", "==", identity.email).limit(1).get();
    if (!found.empty) {
      await found.docs[0].ref.update({
        status: "grille",
        grille,
        siret: identity.siret,
        ville: identity.ville,
        ...(identity.telephone && !found.docs[0].get("telephone") ? { telephone: identity.telephone } : {}),
        notes: FieldValue.arrayUnion(note),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "espace-pro",
      });
      return;
    }
    await db.doc(`crm_artisans/web_${emailKey(identity.email).slice(0, 20)}`).set({
      name: `${identity.prenom} ${identity.nom}`.trim(),
      email: identity.email,
      telephone: identity.telephone,
      siret: identity.siret,
      ville: identity.ville,
      zone: "",
      status: "grille",
      relanceLe: "",
      rgeVerifie: false,
      grille,
      notes: [note],
      source: "espace-pro",
      mondayItemId: mondayItemId ? String(mondayItemId) : "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "espace-pro",
    });
  } catch (err) {
    logger.error("Grille artisan : copie dans le CRM échouée", { error: err.message });
  }
}

// Mails de recrutement envoyés depuis la fiche artisan du CRM (mêmes
// modèles et même anti-doublon que sendRecruitmentEmail côté Monday).
exports.sendArtisanMessage = onCall(
  {
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL],
    region: "europe-west9",
  },
  async (request) => {
    const caller = String(request.auth?.token?.email ?? "").toLowerCase();
    if (!isCrmMember(request)) {
      throw new HttpsError("permission-denied", "Accès refusé.");
    }
    const { artisanId, template } = request.data ?? {};
    const tplKey = normalizeLabel(template);
    const tpl = RECRUIT_TEMPLATES[tplKey];
    if (typeof artisanId !== "string" || !artisanId || !tpl) {
      throw new HttpsError("invalid-argument", "Requête invalide.");
    }
    const ref = db.doc(`crm_artisans/${artisanId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Artisan introuvable.");
    const a = snap.data();
    const email = String(a.email ?? "").trim();
    if (!EMAIL_RE.test(email)) throw new HttpsError("failed-precondition", "Adresse e-mail manquante ou invalide.");
    if (["dead", "signe"].includes(a.status)) {
      throw new HttpsError("failed-precondition", "Artisan marqué Dead / Signé : envoi bloqué.");
    }
    if ((await db.doc(`email_optouts/${emailKey(email.toLowerCase())}`).get()).exists) {
      throw new HttpsError("failed-precondition", "Cet artisan s'est désinscrit.");
    }
    const sendRef = db.doc(`recruit_sends/crm_${artisanId}_${tplKey.replace(/ /g, "_")}_${emailKey(email.toLowerCase()).slice(0, 16)}`);
    try {
      await sendRef.create({ at: FieldValue.serverTimestamp(), template: tplKey });
    } catch {
      throw new HttpsError("already-exists", "Ce modèle a déjà été envoyé à cette adresse.");
    }
    try {
      const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
      oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const subject = tpl.subject(String(a.zone ?? "").trim());
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: buildRawMessage({
            to: email,
            from: GMAIL_SENDER_EMAIL.value(),
            subject,
            html: buildBrandedEmailShell({ bodyHtml: tpl.body() + RECRUIT_STOP }),
          }),
        },
      });
      const patch = {
        notes: FieldValue.arrayUnion({
          id: Math.random().toString(36).slice(2, 10),
          text: `✉️ Mail envoyé : « ${subject} »`,
          by: caller,
          at: new Date().toISOString(),
          kind: "message",
        }),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: caller,
      };
      const newStatus = CRM_ARTISAN_STATUS_BY_MONDAY[tpl.statut];
      if (newStatus && a.status !== "grille" && a.status !== "potentiel") patch.status = newStatus;
      if (tpl.relanceInDays) {
        patch.relanceLe = new Date(Date.now() + tpl.relanceInDays * 86400000).toISOString().slice(0, 10);
      }
      await ref.update(patch);
      logger.info("Mail artisan CRM envoyé", { artisanId, template: tplKey, by: caller });
      return { ok: true };
    } catch (err) {
      await sendRef.delete().catch(() => {});
      logger.error("Échec du mail artisan CRM", { artisanId, error: err.message });
      throw new HttpsError("internal", "Échec de l'envoi du mail (voir les journaux).");
    }
  },
);

// Recherche d'une fiche du tableau de recrutement par e-mail (toutes pages).
async function findRecruitItemByEmail(email, token) {
  const fields = `cursor items { id name column_values(ids: ["${RECRUIT_COL.email}", "${RECRUIT_COL.zone}", "${RECRUIT_COL.telephone}"]) { id text value } }`;
  let data = await mondayQuery(`query ($b: [ID!]) { boards(ids: $b) { items_page(limit: 500) { ${fields} } } }`, { b: [RECRUIT_BOARD_ID] }, token);
  let page = data.boards?.[0]?.items_page;
  const items = [...(page?.items ?? [])];
  while (page?.cursor) {
    data = await mondayQuery(`query ($c: String!) { next_items_page(limit: 500, cursor: $c) { ${fields} } }`, { c: page.cursor }, token);
    page = data.next_items_page;
    items.push(...(page?.items ?? []));
  }
  return (
    items.find((it) => {
      const col = it.column_values.find((c) => c.id === RECRUIT_COL.email);
      let mail;
      try {
        mail = JSON.parse(col?.value ?? "null")?.email;
      } catch {
        mail = undefined;
      }
      return String(mail ?? col?.text ?? "").trim().toLowerCase() === email;
    }) ?? null
  );
}

// Fiche Monday de l'artisan dans « ✅ Grilles remplies » : la fiche
// prospect existante (même e-mail) y est déplacée, sinon une nouvelle fiche
// est créée. Statut = « Grille remplie », SIRET et téléphone renseignés,
// résumé de la grille en commentaire.
async function upsertRecruitGridItem({ identity, summary }, token) {
  const existing = await findRecruitItemByEmail(identity.email, token);
  const values = {
    [RECRUIT_COL.statut]: { label: "Grille remplie" },
    [RECRUIT_COL.siret]: identity.siret,
    [RECRUIT_COL.ville]: identity.ville,
  };
  const existingTel = existing?.column_values.find((c) => c.id === RECRUIT_COL.telephone)?.text;
  if (identity.telephone && !existingTel) values[RECRUIT_COL.telephone] = identity.telephone;
  let itemId;
  if (existing) {
    itemId = existing.id;
    await mondayQuery(
      `mutation ($i: ID!, $g: String!) { move_item_to_group(item_id: $i, group_id: $g) { id } }`,
      { i: itemId, g: RECRUIT_GROUP_GRILLES },
      token,
    );
    await mondayQuery(
      `mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v, create_labels_if_missing: true) { id } }`,
      { b: RECRUIT_BOARD_ID, i: itemId, v: JSON.stringify(values) },
      token,
    );
  } else {
    values[RECRUIT_COL.email] = { email: identity.email, text: identity.email };
    if (identity.telephone) values[RECRUIT_COL.telephone] = identity.telephone;
    const data = await mondayQuery(
      `mutation ($b: ID!, $g: String!, $n: String!, $v: JSON!) { create_item(board_id: $b, group_id: $g, item_name: $n, column_values: $v, create_labels_if_missing: true) { id } }`,
      { b: RECRUIT_BOARD_ID, g: RECRUIT_GROUP_GRILLES, n: `${identity.prenom} ${identity.nom}`, v: JSON.stringify(values) },
      token,
    );
    itemId = data.create_item.id;
  }
  await postMondayUpdate(itemId, summary, token);
  return {
    id: itemId,
    created: !existing,
    name: existing?.name ?? `${identity.prenom} ${identity.nom}`,
    zone: existing?.column_values.find((c) => c.id === RECRUIT_COL.zone)?.text ?? "",
  };
}

const ARTISAN_LINE_IDS = new Set(ARTISAN.ARTISAN_GRID_SECTIONS.flatMap((s) => s.lines.map((l) => l.id)));
const ARTISAN_TRAVEL_IDS = new Set(ARTISAN.TRAVEL_FIELDS.map((f) => f.id));
const cleanAmount = (v) => String(v ?? "").replace(/[^0-9.,\s]/g, "").trim().slice(0, 12);

exports.submitArtisanGrid = onRequest(
  {
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL, MONDAY_API_TOKEN],
    region: "europe-west9",
    cors: [SITE_URL, "https://www.ip5energie.fr", "https://ip5-energie.web.app"],
    timeoutSeconds: 120,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("method not allowed");
      return;
    }
    const b = req.body ?? {};
    if (b.company) {
      res.status(200).send("ok"); // champ piège anti-robot
      return;
    }
    const clip = (v, n) => String(v ?? "").trim().slice(0, n);
    const identity = {
      prenom: clip(b.identity?.prenom, 60),
      nom: clip(b.identity?.nom, 60),
      siret: clip(b.identity?.siret, 20).replace(/\s/g, ""),
      ville: clip(b.identity?.ville, 80),
      email: clip(b.identity?.email, 120).toLowerCase(),
      telephone: clip(b.identity?.telephone, 30),
    };
    const prices = {};
    for (const [k, v] of Object.entries(b.prices ?? {})) if (ARTISAN_LINE_IDS.has(k) && cleanAmount(v)) prices[k] = cleanAmount(v);
    const travel = {};
    for (const [k, v] of Object.entries(b.travel ?? {})) if (ARTISAN_TRAVEL_IDS.has(k) && cleanAmount(v)) travel[k] = cleanAmount(v);
    const comment = clip(b.comment, 2000);
    if (!identity.prenom || !identity.nom || !identity.ville || !/^\d{14}$/.test(identity.siret) || !EMAIL_RE.test(identity.email) || !Object.keys(prices).length) {
      res.status(400).send("invalid");
      return;
    }

    // Anti-abus : au plus un envoi toutes les 5 minutes par adresse e-mail.
    const lockRef = db.doc(`artisan_grid_sends/${emailKey(identity.email)}`);
    const lock = await lockRef.get();
    if (lock.exists && Date.now() - (lock.data().at?.toMillis?.() ?? 0) < 5 * 60 * 1000) {
      res.status(429).send("too many");
      return;
    }
    await lockRef.set({ at: FieldValue.serverTimestamp() });
    await db.collection("artisan_submissions").add({ identity, prices, travel, comment, createdAt: FieldValue.serverTimestamp() });

    const lineLabel = Object.fromEntries(
      ARTISAN.ARTISAN_GRID_SECTIONS.flatMap((s) => s.lines.map((l) => [l.id, `${s.title.replace(/^Pose — /, "")} ${l.label}`])),
    );
    const summary = [
      `🧰 Grille remplie sur ip5energie.fr/espace-pro`,
      `${identity.prenom} ${identity.nom} · ${identity.ville} · SIRET ${identity.siret} · ${identity.email}${identity.telephone ? ` · ${identity.telephone}` : ""}`,
      ...ARTISAN.TRAVEL_FIELDS.filter((f) => travel[f.id]).map((f) => `${f.label} : ${travel[f.id]} ${f.unit}`),
      ...Object.entries(prices).map(([k, v]) => `${lineLabel[k]} : ${v} €`),
      comment ? `Commentaire : ${comment}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    let mondayItem = null;
    try {
      mondayItem = await upsertRecruitGridItem({ identity, summary }, MONDAY_API_TOKEN.value());
    } catch (err) {
      logger.error("Grille artisan : mise à jour Monday échouée", { error: err.message });
    }
    await upsertCrmArtisanGrid({ identity, prices, travel, comment, mondayItemId: mondayItem?.id });

    try {
      const pdf = await buildArtisanGridPdf({ identity, prices, travel, comment, mondayName: mondayItem?.name, mondayZone: mondayItem?.zone });
      const nomBrut = `${identity.prenom} ${identity.nom}`;
      const filename = `Grille-pose-${nomBrut.replace(/[^A-Za-z0-9-]+/g, "-").slice(0, 40)}.pdf`;
      const attachments = [{ content: pdf, filename, mimeType: "application/pdf" }];
      const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
      oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const from = GMAIL_SENDER_EMAIL.value();
      const mondayLine = mondayItem
        ? mondayItem.created
          ? "Nouvelle fiche créée dans Monday (groupe « ✅ Grilles remplies »)."
          : `Fiche Monday existante « ${escapeHtmlText(mondayItem.name)} »${mondayItem.zone ? ` (${escapeHtmlText(mondayItem.zone)})` : ""} déplacée dans « ✅ Grilles remplies ».`
        : "⚠️ Mise à jour Monday échouée : fiche à créer à la main.";
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: buildRawMessageWithAttachment({
            to: from,
            from,
            subject: `🧰 Grille artisan reçue — ${nomBrut}`,
            html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#122f4d">
              <p><b>${escapeHtmlText(nomBrut)}</b> vient de transmettre sa grille de prix de pose (PDF joint).</p>
              <p>${escapeHtmlText(identity.ville)} · SIRET ${escapeHtmlText(identity.siret)} · ${escapeHtmlText(identity.email)}${identity.telephone ? ` · ${escapeHtmlText(identity.telephone)}` : ""}</p>
              <p>${mondayLine}</p>
            </div>`,
            attachments,
          }),
        },
      });
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: buildRawMessageWithAttachment({
            to: identity.email,
            from,
            subject: "IP5 Énergie — Copie de votre grille de prix de pose",
            html: buildBrandedEmailShell({
              bodyHtml: `
                <p style="margin:0 0 12px 0; font-weight:bold;">Bonjour ${escapeHtmlText(identity.prenom)},</p>
                <p style="margin:0 0 12px 0;">Merci d'avoir complété votre grille de prix de pose. Vous en trouverez une copie en PDF dans ce mail.</p>
                <p style="margin:0 0 12px 0;">Nous l'étudions et revenons vers vous très rapidement.</p>
                <p style="margin:0;">À très vite,<br>L'équipe IP5 Énergie</p>`,
            }),
            attachments,
          }),
        },
      });
      logger.info("Grille artisan envoyée", { monday: mondayItem?.id ?? null });
    } catch (err) {
      logger.error("Grille artisan : envoi du PDF échoué", { error: err.message });
    }
    res.status(200).send("ok");
  },
);

// ── Webhook Meta Lead Ads → CRM (étape 6) ────────────────────────────────
// DÉSACTIVÉ tant que les 3 secrets META_* n'existent pas dans Secret
// Manager (voir « Activer le webhook Meta » dans functions/README.md) :
// décommenter alors le bloc ci-dessous.
//
// Object.assign(
//   exports,
//   require("./metaLeads")({
//     createCrmFacebookLead,
//     buildLeadNotificationEmailHtml,
//     buildRawMessage,
//     escapeHtmlText,
//     GMAIL_CLIENT_ID,
//     GMAIL_CLIENT_SECRET,
//     GMAIL_REFRESH_TOKEN,
//     GMAIL_SENDER_EMAIL,
//   }),
// );

// ── Boîte mail contact@ ↔ CRM ────────────────────────────────────────────
// Range les mails reçus/envoyés (et leurs pièces jointes) dans la fiche du
// lead ou de l'artisan correspondant. Voir functions/crmMail.js.
Object.assign(
  exports,
  require("./crmMail")({
    db,
    logger,
    google,
    FieldValue: require("firebase-admin/firestore").FieldValue,
    getStorage: require("firebase-admin/storage").getStorage,
    onDocumentCreated,
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN,
    GMAIL_SENDER_EMAIL,
  }),
);

// ── Équipe du CRM et mises à jour des fiches (functions/crmTeam.js) ──────
Object.assign(
  exports,
  require("./crmTeam")({
    db,
    logger,
    google,
    FieldValue: require("firebase-admin/firestore").FieldValue,
    getAuth: require("firebase-admin/auth").getAuth,
    onCall,
    HttpsError,
    CRM_ALLOWED_EMAILS,
    isCrmMember,
    buildRawMessage,
    buildBrandedEmailShell,
    escapeHtmlText,
    SITE_URL,
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN,
    GMAIL_SENDER_EMAIL,
  }),
);

// ── Automatisations du CRM (functions/crmAutomations.js) ─────────────────
Object.assign(
  exports,
  require("./crmAutomations")({
    computeResteACharge,
    db,
    logger,
    google,
    FieldValue: require("firebase-admin/firestore").FieldValue,
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN,
    GMAIL_SENDER_EMAIL,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    CRM_ALLOWED_EMAILS,
    EMAIL_RE,
    SITE_URL,
    MONDAY_EMAIL_TEMPLATES,
    buildRawMessage,
    buildRawMessageWithAttachment,
    buildBrandedEmailShell,
    escapeHtmlText,
    sendTwilioSms,
    toE164French,
    normalizeLabel,
  }),
);

// ── Intégration Praimy (Dossiers PAC Gary) ────────────────────────────────
exports.listPraimyDossiers = onCall(
  {
    secrets: [PRAIMY_API_KEY],
    region: "europe-west9",
  },
  async (request) => {
    if (!isCrmMember(request)) {
      throw new HttpsError("permission-denied", "Accès refusé.");
    }
    const key = String(PRAIMY_API_KEY.value()).trim();
    const url = "https://portail.praimy.fr/api/v1/dossiers/";
    const res = await fetch(url, {
      headers: {
        "X-API-Key": key,
        "Accept": "application/json",
      },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.error("Erreur API Praimy listPraimyDossiers", { status: res.status, err: errText });
      throw new HttpsError("internal", `Erreur Praimy: ${res.status}`);
    }
    return await res.json();
  }
);

exports.exportLeadToPraimy = onCall(
  {
    secrets: [PRAIMY_API_KEY],
    region: "europe-west9",
  },
  async (request) => {
    if (!isCrmMember(request)) {
      throw new HttpsError("permission-denied", "Accès refusé.");
    }
    const { leadId } = request.data ?? {};
    if (typeof leadId !== "string" || !leadId) {
      throw new HttpsError("invalid-argument", "ID lead manquant.");
    }
    const snap = await db.doc(`crm_leads/${leadId}`).get();
    if (!snap.exists) throw new HttpsError("not-found", "Lead introuvable.");
    const lead = snap.data();

    // Découpage Prénom / Nom
    const fullName = String(lead.name ?? "").trim();
    const parts = fullName.split(/\s+/);
    const firstName = parts.length > 1 ? parts[0] : "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : fullName || "Client";

    // Réponses de qualification (simulateur / appel) → champs du prospect Praimy.
    const d = lead.details ?? {};
    const fl = lead.fields ?? {};
    const pick = (...keys) => {
      for (const k of keys) {
        const v = String(d[k] ?? fl[k] ?? "").trim();
        if (v) return v;
      }
      return "";
    };
    const norm = (v) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const num = (v) => {
      const m = String(v).replace(",", ".").match(/\d+(\.\d+)?/);
      return m ? Math.round(Number(m[0])) : null;
    };
    const owner = norm(pick("Propriétaire"));
    const statutOccupation = owner.includes("bailleur")
      ? "bailleur"
      : owner.includes("locataire")
        ? "loc"
        : owner.includes("propri")
          ? "prop"
          : null;
    const heat = norm(pick("Chauffage", "chauffage"));
    const chauffage = !heat
      ? null
      : heat.includes("gaz")
        ? "gaz"
        : heat.includes("fioul") || heat.includes("mazout")
          ? "fioul"
          : heat.includes("charbon")
            ? "charbon"
            : "autre";
    const logement = norm(pick("Logement"));
    const typologie = logement.includes("maison") ? "Maison individuelle" : null;
    const surface = num(pick("Surface", "surface"));
    const foyer = num(pick("Foyer", "foyer"));

    // Résumé de tout ce qui n'a pas de case dédiée chez Praimy.
    const resume = [];
    for (const [k, v] of Object.entries(d)) {
      if (v && k !== "Progression") resume.push(`${k} : ${v}`);
    }
    if (lead.projet) resume.push(`Projet : ${lead.projet}`);
    const lastNotes = (Array.isArray(lead.notes) ? lead.notes : [])
      .filter((n) => !n.kind || n.kind === "note")
      .slice(-5)
      .map((n) => `• ${n.text}`);
    const notes = [
      "Envoyé depuis le CRM IP5 Énergie.",
      ...resume,
      ...(lastNotes.length ? ["Notes :", ...lastNotes] : []),
    ].join("\n").slice(0, 3000);

    const payload = {
      civility: null,
      first_name: firstName || null,
      last_name: lastName || null,
      phone: lead.phone || "",
      email: lead.email || null,
      code_postal: lead.postalCode || null,
      ville: lead.city || null,
      source: "IP5 Énergie – CRM",
      notes,
      statut_occupation: statutOccupation,
      typologie,
      surface_m2: surface && surface < 5000 ? surface : null,
      chauffage_actuel: chauffage,
      foyer_size: foyer && foyer < 20 ? foyer : null,
      force: request.data?.force === true,
    };
    if (!payload.phone) {
      throw new HttpsError("failed-precondition", "Praimy exige un numéro de téléphone : ajoutez-le sur la fiche.");
    }

    const key = String(PRAIMY_API_KEY.value()).trim();
    const post = (body) =>
      fetch("https://portail.praimy.fr/api/v1/leads/", {
        method: "POST",
        headers: { "X-API-Key": key, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
    let res = await post(payload);
    let data = await res.json().catch(() => ({}));
    // Valeur refusée par le formulaire de qualification : on renvoie sans la typologie (le reste passe).
    if (res.status === 422 && payload.typologie) {
      res = await post({ ...payload, typologie: null });
      data = await res.json().catch(() => ({}));
    }
    if (res.status === 409) {
      logger.warn("Prospect Praimy déjà existant", { leadId, data });
      throw new HttpsError(
        "already-exists",
        "Ce contact existe déjà chez Praimy (même téléphone ou e-mail). Rien n'a été créé.",
      );
    }
    if (!res.ok) {
      logger.error("Erreur création prospect Praimy", { status: res.status, data });
      const detail = typeof data.detail === "string" ? data.detail : `code ${res.status}`;
      throw new HttpsError("internal", `Praimy a refusé l'envoi : ${detail}`);
    }

    // Trace dans la fiche du lead + mise à jour de la colonne Pipeline et Poseur
    const caller = String(request.auth?.token?.email ?? "").toLowerCase();
    const praimyId = String(data.id ?? data.lead?.id ?? "");
    await db.doc(`crm_leads/${leadId}`).update({
      praimyClientId: praimyId || "envoye",
      praimyExportedAt: new Date().toISOString(),
      "fields.pipeline": "PRAIMY",
      "fields.poseur": "PRAIMY",
      notes: require("firebase-admin/firestore").FieldValue.arrayUnion({
        id: Math.random().toString(36).slice(2, 9),
        text: `Envoyé à PRAIMY comme prospect${praimyId ? ` (Réf : ${praimyId})` : ""}`,
        by: caller,
        at: new Date().toISOString(),
        kind: "statut",
      }),
    });

    return { success: true, clientId: praimyId };
  }
);

exports.syncPraimyToPacPac = onCall(
  {
    secrets: [PRAIMY_API_KEY],
    region: "europe-west9",
  },
  async (request) => {
    if (!isCrmMember(request)) {
      throw new HttpsError("permission-denied", "Accès refusé.");
    }
    const key = String(PRAIMY_API_KEY.value()).trim();
    const url = "https://portail.praimy.fr/api/v1/dossiers/";
    const res = await fetch(url, {
      headers: {
        "X-API-Key": key,
        "Accept": "application/json",
      },
    });
    if (!res.ok) {
      throw new HttpsError("internal", `Erreur API Praimy: ${res.status}`);
    }
    const data = await res.json();
    const dossiers = data.items || [];

    // Lecture des leads existants dans Firestore
    const leadsSnap = await db.collection("crm_leads").get();
    const leads = [];
    leadsSnap.forEach((doc) => leads.push({ id: doc.id, ...doc.data() }));

    let updatedCount = 0;
    const batch = db.batch();

    // Mapping du statut global Praimy vers l'étiquette Pipeline de Pac Pac
    const mapToPipeline = (d) => {
      const g = (d.global_status || "").toLowerCase();
      const s = (d.statut || "").toLowerCase();
      if (s === "abandonne" || g === "abandonne") return "Pas bon";
      if (s === "pose" || s === "termine") return "Installé";
      if (g === "mandat_mpr_a_signer") return "Mandat MPR à signer";
      if (g === "en_signature_commerciale" || s === "signature") return "Devis en signature";
      if (g === "en_audit_pre_installation" || s === "signe") return "Audit / Validé";
      if (s === "visite") return "VT programmée";
      return "PRAIMY";
    };

    for (const d of dossiers) {
      const clientNom = (d.client_nom || "").toLowerCase().trim();
      const refDossier = (d.reference || "").toLowerCase().trim();

      // Recherche par nom ou par référence
      const match = leads.find((l) => {
        const lName = String(l.name || "").toLowerCase().trim();
        return (
          (clientNom && lName.includes(clientNom)) ||
          (clientNom && clientNom.includes(lName) && lName.length > 3) ||
          l.praimyClientId === d.client_id ||
          l.fields?.refPraimy === d.reference
        );
      });

      if (match) {
        const newPipeline = mapToPipeline(d);
        const updates = {
          "fields.pipeline": newPipeline,
          "fields.poseur": "PRAIMY",
          "fields.refPraimy": d.reference || "",
          praimyStatut: d.statut || "",
          praimyGlobalStatus: d.global_status || "",
          praimyDossierId: d.id,
        };
        if (typeof d.reste_a_charge_ttc === "number") {
          updates["fields.montant"] = d.reste_a_charge_ttc;
        }
        batch.update(db.doc(`crm_leads/${match.id}`), updates);
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
    }

    return { success: true, updatedCount, totalPraimy: dossiers.length };
  }
);




