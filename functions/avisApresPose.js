// ─────────────────────────────────────────────────────────────────────────
// Demande d'avis Google automatique après la pose. Chaque jour vers 11 h (Paris) :
// les clients installés depuis 1 à 30 jours reçoivent UNE fois la demande d'avis
// (les mêmes textes que « ⭐ demande d'avis Google » dans la fiche) : SMS s'il y a un
// portable, e-mail s'il y a une adresse. Jamais deux fois (repère avis_demande/<id>),
// ni si la demande a déjà été envoyée à la main depuis la fiche. Trace dans la fiche.
// Seulement les poses à partir de DEPUIS (les anciens clients ne sont pas relancés d'un coup).
// COUPÉ le 28/11/2026 à la demande de Jonas : ne rien envoyer tant qu'il ne dit pas d'activer.
// ─────────────────────────────────────────────────────────────────────────
const ACTIF = false;
const DEPUIS = "2026-11-28";

module.exports = ({ db, logger, FieldValue, onSchedule, google, toE164French, sendTwilioSms, buildRawMessageWithAttachment, EMAIL_RE, MONDAY_EMAIL_TEMPLATES, secrets }) => {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = secrets;
  const J = 86400000;

  // Étiquettes ajoutées dans le CRM (clés o_…) : noms relus à chaque passage.
  async function libelles() {
    const out = {};
    try {
      const cfg = (await db.doc("crm_boards/leads_columns").get()).data()?.config ?? {};
      const visit = (v) => {
        if (Array.isArray(v)) for (const o of v) { if (o && typeof o === "object" && o.key && o.label) out[o.key] = o.label; visit(o); }
        else if (v && typeof v === "object") for (const x of Object.values(v)) visit(x);
      };
      visit(cfg);
    } catch {
      /* sans les noms : seule la colonne Pipeline compte */
    }
    return out;
  }

  const demandeAvisApresPose = onSchedule(
    {
      schedule: "7 11 * * *",
      timeZone: "Europe/Paris",
      region: "europe-west9",
      secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN],
      timeoutSeconds: 300,
    },
    async () => {
      if (!ACTIF) return;
      const tpl = MONDAY_EMAIL_TEMPLATES["⭐ demande d'avis Google"];
      if (!tpl) return logger.warn("Modèle « demande d'avis Google » introuvable");
      const noms = await libelles();
      const now = Date.now();
      const snap = await db.collection("crm_leads").get();
      let gmail = null;
      const getGmail = () => {
        if (!gmail) {
          const o = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
          o.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
          gmail = google.gmail({ version: "v1", auth: o });
        }
        return gmail;
      };
      let n = 0;
      for (const d of snap.docs) {
        const x = d.data();
        if (x.deletedAt || (x.board ?? "leads") !== "leads") continue;
        const installe = x.fields?.pipeline === "Installé" || /^\s*install/i.test(String(noms[x.status] ?? x.status ?? ""));
        if (!installe) continue;
        // Date de pose : colonne « Date de pose » sinon dernier changement de statut.
        const pose = String(x.fields?.datePose ?? "").slice(0, 10) || (x.statusChangedAt?.toDate ? x.statusChangedAt.toDate().toISOString().slice(0, 10) : String(x.statusChangedAt ?? "").slice(0, 10));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(pose) || pose < DEPUIS) continue;
        const age = now - Date.parse(`${pose}T12:00:00Z`);
        if (age < J || age > 30 * J) continue;
        if ((x.notes ?? []).some((nt) => /avis Google/i.test(String(nt?.text ?? "")))) continue; // déjà demandé à la main
        const tel = toE164French(x.phone);
        const portable = tel && /^\+33[67]/.test(tel);
        const email = String(x.email ?? "").trim();
        if (!portable && !EMAIL_RE.test(email)) continue;
        const marker = db.doc(`avis_demande/${d.id}`);
        try {
          await marker.create({ at: new Date().toISOString() });
        } catch (e) {
          if (e.code === 6) continue;
          throw e;
        }
        const fait = [];
        try {
          if (portable) {
            const ok = await sendTwilioSms({ to: tel, body: tpl.buildSms({}), accountSid: TWILIO_ACCOUNT_SID.value(), authToken: TWILIO_AUTH_TOKEN.value() });
            fait.push(ok ? "SMS" : "SMS en échec");
          }
          if (EMAIL_RE.test(email)) {
            await getGmail().users.messages.send({
              userId: "me",
              requestBody: { raw: buildRawMessageWithAttachment({ to: email, from: GMAIL_SENDER_EMAIL.value(), subject: tpl.subject, html: tpl.buildHtml({ nomComplet: String(x.name ?? "").trim() }), attachments: tpl.attachments }) },
            });
            fait.push("e-mail");
          }
        } catch (e) {
          logger.warn("Demande d'avis : envoi en échec", { id: d.id, error: e.message });
          fait.push("erreur d'envoi");
        }
        if (!fait.some((f) => f === "SMS" || f === "e-mail")) {
          await marker.delete().catch(() => {}); // rien n'est parti : on réessaiera demain
          continue;
        }
        n++;
        await d.ref.update({
          notes: FieldValue.arrayUnion({ id: Math.random().toString(36).slice(2, 10), text: `⭐ Demande d'avis Google envoyée automatiquement (${fait.join(" + ")}), ${Math.round(age / J)} j après la pose.`, by: "automation", at: new Date().toISOString(), kind: "message" }),
        });
      }
      if (n) logger.info("Demandes d'avis Google envoyées", { n });
    },
  );
  return { demandeAvisApresPose };
};
