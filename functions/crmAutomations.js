// Automatisations du CRM (bouton « Automatiser » de /admin), façon Monday :
// « quand <colonne> devient <valeur> (ou quand un lead est créé), alors <actions> ».
//
// Les règles sont dans Firestore (crm_automations/<id>), créées depuis le CRM.
// Cette fonction se déclenche à chaque écriture d'un lead (crm_leads/<id>),
// compare l'avant et l'après, et exécute les règles activées qui correspondent.
//
// Garde-fous :
// - les écritures faites par une automatisation (updatedBy = « automation ») et
//   l'import Monday ne redéclenchent rien : pas de boucle ;
// - chaque événement n'est traité qu'une fois (automation_events/<id d'événement>),
//   même si Firestore le rejoue ;
// - une action qui échoue n'empêche pas les suivantes ; le résultat de chaque
//   automatisation est noté dans l'historique de la fiche.

const { onDocumentWritten } = require("firebase-functions/v2/firestore");

// Colonne du CRM → champ principal de la fiche (les autres sont dans fields.<clé>).
const CORE = {
  status: "status",
  rappel: "rappelLe",
  phone: "phone",
  email: "email",
  cp: "postalCode",
  type: "type",
  source: "source",
  projet: "projet",
  name: "name",
};

const valueOf = (d, col) => (CORE[col] ? String(d?.[CORE[col]] ?? "") : String(d?.fields?.[col] ?? ""));
const writeCol = (col, value) => (CORE[col] ? { [CORE[col]]: value } : { [`fields.${col}`]: value });

const parisToday = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};

const fill = (text, d) =>
  String(text ?? "")
    .replace(/\{nom\}/g, d.name ?? "")
    .replace(/\{telephone\}/g, d.phone ?? "")
    .replace(/\{email\}/g, d.email ?? "")
    .replace(/\{ville\}/g, d.city || d.postalCode || "");

module.exports = function buildCrmAutomations({
  db,
  logger,
  google,
  FieldValue,
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
}) {
  async function teamRecipients() {
    const [team, profiles] = await Promise.all([db.collection("crm_team").get(), db.collection("crm_profiles").get()]);
    const muted = new Set(profiles.docs.filter((p) => p.get("notify") === false).map((p) => p.id));
    return [...CRM_ALLOWED_EMAILS, ...team.docs.map((d) => d.id)].filter((e) => !muted.has(e));
  }

  const runAutomations = onDocumentWritten(
    {
      document: "crm_leads/{leadId}",
      secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN],
      region: "europe-west9",
      timeoutSeconds: 120,
    },
    async (event) => {
      const before = event.data?.before?.exists ? event.data.before.data() : null;
      const after = event.data?.after?.exists ? event.data.after.data() : null;
      if (!after) return; // suppression : rien à faire
      if (["automation", "import Monday"].includes(String(after.updatedBy))) return;

      const created = !before;
      const autos = (await db.collection("crm_automations").where("enabled", "==", true).get()).docs.filter((d) => {
        const t = d.get("trigger") ?? {};
        if (t.type === "created") return created;
        if (t.type === "column_changes" && !created) {
          const was = valueOf(before, t.col);
          const now = valueOf(after, t.col);
          return was !== now && (!t.value || t.value === now);
        }
        return false;
      });
      if (!autos.length) return;

      // Une seule exécution par événement (Firestore peut le rejouer).
      try {
        await db.doc(`automation_events/${event.id}`).create({ at: FieldValue.serverTimestamp() });
      } catch {
        return;
      }

      const ref = event.data.after.ref;
      const leadId = event.params.leadId;
      const patch = {};
      const notes = [];
      let gmail = null;
      const getGmail = () => {
        if (!gmail) {
          const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID.value(), GMAIL_CLIENT_SECRET.value());
          oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
          gmail = google.gmail({ version: "v1", auth: oauth2Client });
        }
        return gmail;
      };
      const lead = { ...after };

      for (const auto of autos.slice(0, 5)) {
        const done = [];
        for (const a of auto.get("actions") ?? []) {
          try {
            switch (a.type) {
              case "notify_team": {
                const to = await teamRecipients();
                const html = buildBrandedEmailShell({
                  bodyHtml: `<p style="margin:0 0 12px 0;"><b>⚡ ${escapeHtmlText(auto.get("name") || "Automatisation")}</b></p>
                    <p style="margin:0 0 12px 0;">Lead : <b>${escapeHtmlText(lead.name)}</b>${lead.phone ? ` — ${escapeHtmlText(lead.phone)}` : ""}</p>
                    ${a.message ? `<p style="margin:0 0 16px 0; padding:12px 14px; background:#f3f6fb; border-left:4px solid #2b5a8f; white-space:pre-wrap;">${escapeHtmlText(fill(a.message, lead))}</p>` : ""}
                    <p style="margin:0;"><a href="${SITE_URL}/admin#leads" style="display:inline-block; background:#2b5a8f; color:#fff; text-decoration:none; padding:10px 18px; border-radius:999px; font-weight:bold;">Ouvrir le CRM</a></p>`,
                });
                for (const addr of to) {
                  await getGmail().users.messages.send({
                    userId: "me",
                    requestBody: { raw: buildRawMessage({ to: addr, from: GMAIL_SENDER_EMAIL.value(), subject: `⚡ ${auto.get("name") || "Automatisation"} — ${lead.name}`, html }) },
                  });
                }
                done.push("équipe prévenue par e-mail");
                break;
              }
              case "send_template": {
                const tpl = MONDAY_EMAIL_TEMPLATES[a.template] ?? MONDAY_EMAIL_TEMPLATES[String(a.template ?? "").toLowerCase()];
                if (!tpl || tpl.requiresResolvedRac) {
                  done.push(`modèle « ${a.template} » indisponible`);
                  break;
                }
                if (a.mail !== false) {
                  const to = String(lead.email ?? "").trim();
                  if (EMAIL_RE.test(to)) {
                    await getGmail().users.messages.send({
                      userId: "me",
                      requestBody: {
                        raw: buildRawMessageWithAttachment({
                          to,
                          from: GMAIL_SENDER_EMAIL.value(),
                          subject: tpl.subject,
                          html: tpl.buildHtml({ nomComplet: String(lead.name ?? "").trim(), rac: undefined }),
                          attachments: tpl.attachments,
                        }),
                      },
                    });
                    done.push(`mail « ${tpl.subject} » envoyé`);
                  } else done.push("mail non envoyé (pas d'adresse e-mail)");
                }
                if (a.sms !== false && tpl.buildSms) {
                  const to = toE164French(lead.phone);
                  if (to && to.startsWith("+")) {
                    const ok = await sendTwilioSms({ to, body: tpl.buildSms({}), accountSid: TWILIO_ACCOUNT_SID.value(), authToken: TWILIO_AUTH_TOKEN.value() });
                    done.push(ok ? "SMS envoyé" : "SMS en échec");
                  } else done.push("SMS non envoyé (pas de téléphone)");
                }
                break;
              }
              case "send_sms": {
                const to = toE164French(lead.phone);
                const body = fill(a.text, lead).slice(0, 480);
                if (to && to.startsWith("+") && body) {
                  const ok = await sendTwilioSms({ to, body, accountSid: TWILIO_ACCOUNT_SID.value(), authToken: TWILIO_AUTH_TOKEN.value() });
                  done.push(ok ? "SMS envoyé" : "SMS en échec");
                } else done.push("SMS non envoyé");
                break;
              }
              case "move_group":
                patch.group = String(a.groupId ?? "");
                lead.group = patch.group;
                done.push("déplacé dans un groupe");
                break;
              case "set_column": {
                Object.assign(patch, writeCol(a.col, String(a.value ?? "")));
                done.push("colonne modifiée");
                break;
              }
              case "set_date": {
                Object.assign(patch, writeCol(a.col, parisToday(Number(a.days) || 0)));
                done.push("date posée");
                break;
              }
              case "add_note":
                notes.push({
                  id: Math.random().toString(36).slice(2, 10),
                  text: fill(a.text, lead),
                  by: "automation",
                  at: new Date().toISOString(),
                  kind: "note",
                });
                done.push("note ajoutée");
                break;
              default:
                done.push(`action inconnue (${a.type})`);
            }
          } catch (err) {
            logger.error("Automatisation : action échouée", { auto: auto.id, leadId, type: a.type, error: err.message });
            done.push(`échec : ${a.type}`);
          }
        }
        notes.push({
          id: Math.random().toString(36).slice(2, 10),
          text: `⚡ Automatisation « ${auto.get("name") || auto.id} » : ${done.join(", ") || "rien à faire"}`,
          by: "automation",
          at: new Date().toISOString(),
          kind: "statut",
        });
        await auto.ref.update({ runs: FieldValue.increment(1), lastRunAt: FieldValue.serverTimestamp() }).catch(() => {});
      }

      await ref.update({
        ...patch,
        notes: FieldValue.arrayUnion(...notes),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "automation",
      });
      logger.info("Automatisations exécutées", { leadId, count: autos.length });
    },
  );

  return { runAutomations };
};
