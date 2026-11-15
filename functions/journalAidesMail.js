// « 📰 Le Journal des aides » : dès que la veille du soir est publiée dans crm_news/{AAAA-MM-JJ}
// (page « Actualités aides » du CRM), un mail récapitulatif part sur contact@ (demandé par Jonas le 15/11/2026).
// Un seul mail par jour (trace rappel_mails/journal_<date>) : un complément publié le même jour ne renvoie rien.
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

module.exports = function buildJournalAidesMail({ db, logger, google, buildRawMessage, escapeHtmlText, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL }) {
  const journalAidesMail = onDocumentWritten(
    {
      document: "crm_news/{day}",
      region: "europe-west9",
      secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL],
      timeoutSeconds: 60,
    },
    async (event) => {
      const n = event.data?.after?.exists ? event.data.after.data() : null;
      if (!n) return;
      const day = event.params.day;
      try {
        await db.doc(`rappel_mails/journal_${day}`).create({ at: new Date().toISOString() });
      } catch {
        return; // déjà envoyé pour ce jour
      }
      const e = (v) => escapeHtmlText(String(v ?? ""));
      const dateFr = new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
      const items = Array.isArray(n.items) ? n.items : [];
      const imp = items.filter((x) => x.importance === "haute").length;
      const cartes = items
        .map(
          (x) => `<div style="border:1px solid #e5e7eb;border-left:4px solid ${x.importance === "haute" ? "#dc2626" : "#122f4d"};border-radius:8px;padding:12px 14px;margin:0 0 12px">
<p style="margin:0 0 4px;font-size:12px;color:#6b7280">${e(x.category)}${x.importance === "haute" ? ' · <b style="color:#dc2626">⚠️ Important</b>' : ""}</p>
<p style="margin:0 0 6px;font-size:16px;font-weight:bold;color:#111827">${e(x.title)}</p>
<p style="margin:0 0 8px;font-size:14px;color:#374151">${e(x.summary)}</p>
${x.impact ? `<p style="margin:0 0 8px;font-size:14px;background:#fff7ed;padding:8px 10px;border-radius:6px"><b>👉 Pour IP5 :</b> ${e(x.impact)}</p>` : ""}
${x.url ? `<p style="margin:0;font-size:13px"><a href="${e(x.url)}" style="color:#122f4d">Source : ${e(x.sourceName || "lire l'article")}</a></p>` : ""}
</div>`,
        )
        .join("");
      const html = `<div style="font-family:Arial,sans-serif;max-width:600px">
<p style="margin:0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px">📰 Le Journal des aides · IP5 Énergie</p>
<h2 style="color:#122f4d;margin:4px 0 4px">${e(n.title || "Les nouvelles du jour")}</h2>
<p style="margin:0 0 14px;font-size:13px;color:#6b7280">Édition du ${e(dateFr)}${items.length ? ` · ${items.length} actualité${items.length > 1 ? "s" : ""}${imp ? ` dont ${imp} importante${imp > 1 ? "s" : ""}` : ""}` : ""}</p>
${n.summary ? `<p style="font-size:15px;color:#111827;margin:0 0 16px">${e(n.summary)}</p>` : ""}
${n.nothingNew || !items.length ? `<p style="font-size:15px;color:#374151">Rien de nouveau aujourd'hui sur MaPrimeRénov', les CEE et les pompes à chaleur.</p>` : cartes}
<p style="margin-top:16px"><a href="https://ip5energie.fr/admin#actus" style="background:#122f4d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Ouvrir les Actualités dans le CRM</a></p>
</div>`;
      const subject = `📰 Le Journal des aides du ${new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" })}${imp ? " · ⚠️ à lire" : ""} : ${n.nothingNew || !items.length ? "rien de nouveau" : String(n.title || "").slice(0, 90)}`;
      try {
        const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
        oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const from = GMAIL_SENDER_EMAIL.value();
        await gmail.users.messages.send({ userId: "me", requestBody: { raw: buildRawMessage({ to: from, from, subject, html }) } });
        logger.info("Journal des aides envoyé", { day, items: items.length });
      } catch (err) {
        logger.error("Journal des aides : envoi échoué", { day, error: err.message });
      }
    },
  );
  return { journalAidesMail };
};
