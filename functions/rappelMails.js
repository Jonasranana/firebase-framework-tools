// Mail « ⏰ À rappeler dans 20 min » (nom de fonction gardé : rappelMail10min) : toutes les 2 minutes, cherche les fiches
// dont le rappel (rappelLe + fields.rappelHeure, heure de Paris) tombe dans les
// 20 prochaines minutes et prévient la personne qui doit rappeler (« Attribué
// à », sinon « Commercial ») + la boîte contact@. Un seul mail par rappel
// (trace dans rappel_mails/<fiche>_<date>_<heure>). Rappels sans heure : rien.
// Minuterie Cloud Scheduler : rôle « Administrateur Cloud Scheduler » donné au
// compte de déploiement le 04/11/2026.
const { onSchedule } = require("firebase-functions/v2/scheduler");

const EMAILS = {
  mebarek: "mebarouk2012@gmail.com",
  carole: "carol.sitbon05@gmail.com",
  alexis: "alexis.sitbon@gmail.com",
  jonas: "jonassitbon8@gmail.com",
};

module.exports = function buildRappelMails({ db, logger, google, buildRawMessage, escapeHtmlText, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL, sendPush }) {
  const paris = () => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date())
        .map((x) => [x.type, x.value]),
    );
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
  };

  const rappelMail10min = onSchedule(
    {
      schedule: "every 2 minutes",
      timeZone: "Europe/Paris",
      region: "europe-west1",
      secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL],
      timeoutSeconds: 120,
    },
    async () => {
      const now = paris();
      const snap = await db.collection("crm_leads").where("rappelLe", "==", now.date).get();
      const due = [];
      for (const d of snap.docs) {
        const x = d.data();
        if (x.deletedAt) continue;
        const m = /^(\d{1,2}):(\d{2})/.exec(String(x.fields?.rappelHeure ?? ""));
        if (!m) continue;
        const until = Number(m[1]) * 60 + Number(m[2]) - now.minutes;
        if (until > 0 && until <= 20) due.push({ d, x, heure: `${m[1].padStart(2, "0")}:${m[2]}`, until });
      }
      if (!due.length) return;

      const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
      oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const from = GMAIL_SENDER_EMAIL.value();

      for (const { d, x, heure, until } of due) {
        // Un seul mail par rappel, même si la fonction tourne deux fois.
        try {
          await db.doc(`rappel_mails/${d.id}_${now.date}_${heure.replace(":", "h")}`).create({ at: new Date().toISOString(), leadId: d.id });
        } catch {
          continue;
        }
        const qui = String(x.fields?.attribue || x.fields?.commercial || "").trim();
        const perso = EMAILS[qui.toLowerCase()];
        const to = [from, perso].filter(Boolean).join(", ");
        const name = String(x.name || "Client").trim();
        const notes = (Array.isArray(x.notes) ? x.notes : []).filter((n) => n && n.kind !== "ia" && String(n.text ?? "").trim());
        const last = notes.length ? String(notes[notes.length - 1].text).slice(0, 500) : "";
        const tel = String(x.phone ?? "").trim();
        const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
<h2 style="color:#122f4d;margin:0 0 8px">⏰ À rappeler dans ${until} min, à ${escapeHtmlText(heure.replace(":", "h"))}</h2>
<p style="font-size:16px;margin:0 0 12px">À rappeler par : <b style="color:#c2410c">${escapeHtmlText(qui || "personne n'est désigné (à voir avec l'équipe)")}</b></p>
<table style="border-collapse:collapse;width:100%">
<tr><td style="padding:6px 10px;color:#666">Client</td><td style="padding:6px 10px;font-weight:bold">${escapeHtmlText(name)}</td></tr>
<tr><td style="padding:6px 10px;color:#666">Téléphone</td><td style="padding:6px 10px;font-weight:bold">${tel ? `<a href="tel:${escapeHtmlText(tel.replace(/\s/g, ""))}">${escapeHtmlText(tel)}</a>` : "—"}</td></tr>
<tr><td style="padding:6px 10px;color:#666">Code postal</td><td style="padding:6px 10px">${escapeHtmlText(x.postalCode || "—")}</td></tr>
${last ? `<tr><td style="padding:6px 10px;color:#666;vertical-align:top">Dernier message</td><td style="padding:6px 10px">${escapeHtmlText(last)}</td></tr>` : ""}
</table>
<p style="margin-top:14px"><a href="https://ip5energie.fr/admin" style="background:#122f4d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Ouvrir le CRM</a></p>
</div>`;
        try {
          await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: buildRawMessage({ to, from, subject: `⏰ À rappeler dans ${until} min à ${heure.replace(":", "h")} : ${name}${qui ? ` (par ${qui})` : ""}`, html }) },
          });
          logger.info("Mail de rappel envoyé", { leadId: d.id, heure, qui });
        } catch (err) {
          logger.error("Mail de rappel : envoi échoué", { leadId: d.id, error: err.message });
        }
        // Notification sur le téléphone de la personne qui doit rappeler (sinon : tous ceux qui ont choisi « rappels »).
        if (sendPush) {
          await sendPush({
            kind: "rappels",
            emails: perso ? [perso] : undefined,
            title: `⏰ À rappeler dans ${until} min : ${name}`,
            body: [heure.replace(":", "h"), tel, qui && `par ${qui}`].filter(Boolean).join(" · "),
            url: `/admin?lead=${encodeURIComponent(d.id)}`,
            tag: `rappel-${d.id}`,
            leadId: d.id,
          });
        }
      }
    },
  );

  // Chaque dimanche 10 h (Paris) : mail sur contact@ pour penser à envoyer à Claude l'export Excel
  // d'Ads Manager, qui met à jour la page « Rentabilité Meta » (demandé par Jonas le 15/11/2026).
  const rappelExcelMeta = onSchedule(
    {
      schedule: "every sunday 10:00",
      timeZone: "Europe/Paris",
      region: "europe-west1",
      secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL],
      timeoutSeconds: 60,
    },
    async () => {
      const { date } = paris();
      try {
        await db.doc(`rappel_mails/excel_meta_${date}`).create({ at: new Date().toISOString() });
      } catch {
        return; // déjà envoyé aujourd'hui
      }
      const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
      oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const from = GMAIL_SENDER_EMAIL.value();
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
<h2 style="color:#122f4d;margin:0 0 8px">📊 C'est dimanche : envoie l'Excel des pubs Meta à Claude</h2>
<p style="font-size:15px;margin:0 0 12px">Pour mettre à jour la page <b>« Rentabilité Meta »</b> du CRM (dépense pub, coût par lead, bénéfice net).</p>
<ol style="font-size:15px;line-height:1.6;padding-left:20px;margin:0 0 14px">
<li>Sur l'ordi, ouvre <b>Ads Manager</b> → onglet <b>Publicités</b>.</li>
<li>Période : <b>du 1er septembre à aujourd'hui</b>.</li>
<li><b>Exporter</b> en Excel (même format que la dernière fois).</li>
<li>Envoie le fichier à Claude dans la conversation du CRM.</li>
</ol>
<p style="margin-top:14px"><a href="https://adsmanager.facebook.com" style="background:#122f4d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Ouvrir Ads Manager</a>
&nbsp; <a href="https://ip5energie.fr/admin#renta" style="color:#122f4d">Voir la page Rentabilité</a></p>
</div>`;
      try {
        await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw: buildRawMessage({ to: from, from, subject: "📊 Dimanche : envoyer l'Excel des pubs Meta (Rentabilité)", html }) },
        });
        logger.info("Mail rappel Excel Meta envoyé", { date });
      } catch (err) {
        logger.error("Mail rappel Excel Meta : envoi échoué", { error: err.message });
      }
    },
  );

  return { rappelMail10min, rappelExcelMeta };
};
